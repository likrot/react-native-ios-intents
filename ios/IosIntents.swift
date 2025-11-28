import Foundation
import AppIntents

///TODO: add tests if possible

/// Native module for iOS App Intents integration
/// Handles shortcut invocation callbacks from generated AppIntents
///
/// Thread Safety:
/// - `setShortcutCallback`: Thread-safe (uses serial queue)
/// - `getShared*` / `setShared*`: Thread-safe (UserDefaults is thread-safe)
/// - Darwin notification callback: Dispatches to main queue for callback invocation
/// - All public methods: Thread-safe
class IosIntents: HybridIosIntentsSpec {

    // MARK: - Constants

    /// Darwin notification name for cross-process communication
    private static let darwinNotificationName = "eu.eblank.likrot.iosintents.shortcut" as CFString

    // MARK: - App Group Configuration

    /// App Group ID for shared UserDefaults between main app and App Intents
    /// App Intents run in a separate process, so they need a shared container
    /// Format: group.<bundle-identifier>
    static var appGroupId: String {
        guard let bundleId = Bundle.main.bundleIdentifier else {
            fatalError("[IosIntents] FATAL: Cannot determine bundle identifier. App Intents require a valid bundle ID to configure App Groups.")
        }
        return "group.\(bundleId)"
    }

    /// Shared UserDefaults instance for communication with App Intents
    private static var sharedDefaults: UserDefaults? {
        let groupId = appGroupId
        guard let defaults = UserDefaults(suiteName: groupId) else {
            print("[IosIntents] ERROR: Failed to access App Group: \(groupId)")
            print("[IosIntents] Make sure App Group capability is enabled in Xcode!")
            print("[IosIntents] The App Group ID should be: \(groupId)")
            return nil
        }
        return defaults
    }

    // MARK: - Thread Safety

    /// Serial queue for thread-safe access to callback and shared instance
    private let callbackQueue = DispatchQueue(label: "eu.eblank.likrot.iosintents.callback")
    private static let sharedQueue = DispatchQueue(label: "eu.eblank.likrot.iosintents.shared")

    /// Darwin notification observer pointer (stored to ensure proper cleanup)
    private var notificationObserver: UnsafeMutableRawPointer?

    // MARK: - Callback

    private var _shortcutCallback: ((NativeShortcutData) -> Void)?
    private var shortcutCallback: ((NativeShortcutData) -> Void)? {
        get { callbackQueue.sync { _shortcutCallback } }
        // Using .sync instead of .async to ensure callback is set immediately
        // This prevents race condition where handleDarwinNotification() is called
        // before the callback has been set. Safe because setShortcutCallback()
        // is only called from main queue, never from callbackQueue.
        set { callbackQueue.sync { self._shortcutCallback = newValue } }
    }

    // MARK: - Shared Instance

    private static var _shared: IosIntents?
    static var shared: IosIntents? {
        get { sharedQueue.sync { _shared } }
        set { sharedQueue.async(flags: .barrier) { _shared = newValue } }
    }

    // MARK: - Initialization & Cleanup

    public override init() {
        super.init()
        IosIntents.shared = self
        print("[IosIntents] Initialized")
        print("[IosIntents] App Group ID: \(IosIntents.appGroupId)")

        // Set up Darwin notification listener for cross-process events from App Intents
        setupDarwinNotificationListener()
    }

    deinit {
        // Remove Darwin notification observer to prevent memory leaks and crashes
        // Use the stored observer pointer to ensure it matches the registered one
        if let observer = notificationObserver {
            CFNotificationCenterRemoveObserver(
                CFNotificationCenterGetDarwinNotifyCenter(),
                observer,
                CFNotificationName(IosIntents.darwinNotificationName),
                nil
            )
            print("[IosIntents] Darwin notification observer removed")
        }
        print("[IosIntents] Deinitialized")
    }

    /// Sets up Darwin notification listener to receive events from App Intents
    private func setupDarwinNotificationListener() {
        // Create observer context and store it for later cleanup
        notificationObserver = Unmanaged.passUnretained(self).toOpaque()

        // Darwin notification callback
        let callback: CFNotificationCallback = { _, observer, name, _, _ in
            guard let observer = observer else { return }
            let instance = Unmanaged<IosIntents>.fromOpaque(observer).takeUnretainedValue()

            print("[IosIntents] Darwin notification received: \(name?.rawValue as String? ?? "unknown")")
            instance.handleDarwinNotification()
        }

        // Register for Darwin notifications (cross-process) using stored pointer
        CFNotificationCenterAddObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            notificationObserver,
            callback,
            IosIntents.darwinNotificationName,
            nil,
            .deliverImmediately
        )

        print("[IosIntents] Darwin notification listener registered")
    }

    /// Handles Darwin notification by reading UserDefaults and invoking callback
    private func handleDarwinNotification() {
        guard let defaults = IosIntents.sharedDefaults else {
            print("[IosIntents] ERROR: Cannot access shared UserDefaults")
            return
        }

        // Read pending command atomically
        guard let pendingCommand = defaults.string(forKey: "IosIntentsPendingCommand"),
              let commandNonce = defaults.string(forKey: "IosIntentsCommandNonce") else {
            print("[IosIntents] No pending command found")
            return
        }

        // Read timestamp to detect race conditions
        let timestamp = defaults.double(forKey: "IosIntentsCommandTimestamp")

        print("[IosIntents] Pending command found: \(pendingCommand), nonce: \(commandNonce), timestamp: \(timestamp)")

        // Read user confirmation status
        var userConfirmed: Bool? = nil
        if let userConfirmedValue = defaults.object(forKey: "IosIntentsUserConfirmed") as? NSNumber {
            userConfirmed = userConfirmedValue.boolValue
            print("[IosIntents] User confirmation: \(userConfirmed!)")
        }

        // Read all parameters from shared UserDefaults
        // Parameters are written by generated App Intents with keys like "IosIntentsParam_taskName"
        var parameters: [String: Any] = [:]
        let allKeys = defaults.dictionaryRepresentation().keys
        for key in allKeys {
            if key.hasPrefix("IosIntentsParam_") {
                let paramName = String(key.dropFirst("IosIntentsParam_".count))

                // Check for type marker to determine correct parameter type
                // Type markers are written by generated App Intents to ensure correct type conversion
                let typeKey = "IosIntentsParamType_\(paramName)"
                let paramType = defaults.string(forKey: typeKey)

                // Try different value types based on type marker or stored value
                if paramType == "date" {
                    // Date parameter stored as Unix timestamp - convert to Date object
                    let timestamp = defaults.double(forKey: key)
                    let date = Date(timeIntervalSince1970: timestamp)
                    parameters[paramName] = date
                    print("[IosIntents] Parameter \(paramName) (Date): \(date)")
                } else if paramType == "boolean", let boolValue = defaults.object(forKey: key) as? NSNumber {
                    // Boolean parameter with explicit type marker
                    parameters[paramName] = boolValue.boolValue
                    print("[IosIntents] Parameter \(paramName) (Bool): \(boolValue.boolValue)")
                } else if let stringValue = defaults.string(forKey: key) {
                    // String parameter
                    parameters[paramName] = stringValue
                    print("[IosIntents] Parameter \(paramName) (String): \(stringValue)")
                } else if let numberValue = defaults.object(forKey: key) as? NSNumber {
                    // Regular number parameter
                    parameters[paramName] = numberValue.doubleValue
                    print("[IosIntents] Parameter \(paramName) (Number): \(numberValue.doubleValue)")
                }
            }
        }

        // Clear the pending command and parameters
        // Note: Only clear if nonce matches (prevents race condition where a new command
        // is written while we're processing the old one). Using nonce instead of timestamp
        // because nonces are UUIDs and guaranteed unique, avoiding cache-related issues.
        let currentNonce = defaults.string(forKey: "IosIntentsCommandNonce")
        if currentNonce == commandNonce {
            defaults.removeObject(forKey: "IosIntentsPendingCommand")
            defaults.removeObject(forKey: "IosIntentsCommandNonce")
            defaults.removeObject(forKey: "IosIntentsCommandTimestamp")
            defaults.removeObject(forKey: "IosIntentsUserConfirmed")

            // Clean up all parameter keys and their type markers
            for key in allKeys {
                if key.hasPrefix("IosIntentsParam_") || key.hasPrefix("IosIntentsParamType_") {
                    defaults.removeObject(forKey: key)
                }
            }

            print("[IosIntents] Pending command and parameters cleared")
        } else {
            print("[IosIntents] WARNING: Nonce mismatch, skipping clear (race condition detected)")
        }

        // Invoke the shortcut callback with parameters and userConfirmed
        IosIntents.invokeShortcut(
            identifier: pendingCommand,
            nonce: commandNonce,
            parameters: parameters.isEmpty ? nil : parameters,
            userConfirmed: userConfirmed
        )
    }

    // MARK: - Protocol Implementation

    /// Sets a callback to be invoked when a shortcut is triggered
    ///
    /// - Parameter callback: Function to call with shortcut data
    /// - Thread Safety: Can be called from any thread
    public func setShortcutCallback(callback: @escaping (NativeShortcutData) -> Void) throws {
        self.shortcutCallback = callback
        print("[IosIntents] Shortcut callback registered")

        // Check for pending commands immediately after callback is registered
        // This handles cold starts where the app was launched by Siri
        print("[IosIntents] Checking for pending commands (callback now ready)...")
        handleDarwinNotification()
    }

    /// Reads a string value from the shared UserDefaults (App Group)
    ///
    /// - Parameter key: The key to read
    /// - Returns: The string value, or nil if not found
    /// - Throws: IosIntentsError.appGroupAccessFailed if App Group is not accessible
    /// - Thread Safety: Thread-safe (UserDefaults is thread-safe)
    public func getSharedString(key: String) throws -> String? {
        guard let defaults = IosIntents.sharedDefaults else {
            throw IosIntentsError.appGroupAccessFailed
        }
        let value = defaults.string(forKey: key)
        print("[IosIntents] getSharedString(\(key)) = \(value ?? "nil")")
        return value
    }

    /// Writes a string value to the shared UserDefaults (App Group)
    ///
    /// - Parameters:
    ///   - key: The key to write
    ///   - value: The value to write, or nil to remove
    /// - Throws: IosIntentsError.appGroupAccessFailed if App Group is not accessible
    /// - Thread Safety: Thread-safe (UserDefaults is thread-safe)
    public func setSharedString(key: String, value: String?) throws {
        guard let defaults = IosIntents.sharedDefaults else {
            throw IosIntentsError.appGroupAccessFailed
        }
        if let value = value {
            defaults.set(value, forKey: key)
            print("[IosIntents] setSharedString(\(key)) = \(value)")
        } else {
            defaults.removeObject(forKey: key)
            print("[IosIntents] setSharedString(\(key)) = nil (removed)")
        }
    }

    /// Reads a number value from the shared UserDefaults (App Group)
    ///
    /// - Parameter key: The key to read
    /// - Returns: The number value, or nil if not found
    /// - Throws: IosIntentsError.appGroupAccessFailed if App Group is not accessible
    /// - Thread Safety: Thread-safe (UserDefaults is thread-safe)
    public func getSharedNumber(key: String) throws -> Double? {
        guard let defaults = IosIntents.sharedDefaults else {
            throw IosIntentsError.appGroupAccessFailed
        }
        if defaults.object(forKey: key) == nil {
            print("[IosIntents] getSharedNumber(\(key)) = nil")
            return nil
        }
        let value = defaults.double(forKey: key)
        print("[IosIntents] getSharedNumber(\(key)) = \(value)")
        return value
    }

    /// Writes a number value to the shared UserDefaults (App Group)
    ///
    /// - Parameters:
    ///   - key: The key to write
    ///   - value: The value to write, or nil to remove
    /// - Throws: IosIntentsError.appGroupAccessFailed if App Group is not accessible
    /// - Thread Safety: Thread-safe (UserDefaults is thread-safe)
    public func setSharedNumber(key: String, value: Double?) throws {
        guard let defaults = IosIntents.sharedDefaults else {
            throw IosIntentsError.appGroupAccessFailed
        }
        if let value = value {
            defaults.set(value, forKey: key)
            print("[IosIntents] setSharedNumber(\(key)) = \(value)")
        } else {
            defaults.removeObject(forKey: key)
            print("[IosIntents] setSharedNumber(\(key)) = nil (removed)")
        }
    }

    // MARK: - Public Helpers

    /// Handles shortcut invocation from generated App Intents
    /// Called by generated Intent structs when Siri triggers a shortcut
    ///
    /// - Parameters:
    ///   - identifier: The shortcut identifier
    ///   - nonce: Unique identifier to prevent duplicate execution
    ///   - parameters: Optional dictionary of parameter values from Siri
    ///   - userConfirmed: Optional boolean indicating if user confirmed a dialog
    /// - Thread Safety: Thread-safe, dispatches callback to main queue
    public static func invokeShortcut(
        identifier: String,
        nonce: String,
        parameters: [String: Any]? = nil,
        userConfirmed: Bool? = nil
    ) {
        guard let instance = IosIntents.shared else {
            print("[IosIntents] ERROR: No shared instance available")
            return
        }

        print("[IosIntents] Invoking shortcut: \(identifier) with nonce: \(nonce)")
        if let params = parameters {
            print("[IosIntents] Parameters: \(params)")
        }
        if let confirmed = userConfirmed {
            print("[IosIntents] User confirmed: \(confirmed)")
        }

        // Convert parameters dictionary to variant type
        // Variant cases: .first(Bool), .second(String), .third(Double), .fourth(Date)
        var convertedParams: [String: Variant_Bool_String_Double_Date]? = nil
        if let params = parameters {
            convertedParams = [:]
            for (key, value) in params {
                if let boolValue = value as? Bool {
                    convertedParams?[key] = .first(boolValue)
                } else if let stringValue = value as? String {
                    convertedParams?[key] = .second(stringValue)
                } else if let doubleValue = value as? Double {
                    convertedParams?[key] = .third(doubleValue)
                } else if let dateValue = value as? Date {
                    convertedParams?[key] = .fourth(dateValue)
                }
            }
        }

        // Create typed shortcut data with parameters and userConfirmed
        let shortcutData = NativeShortcutData(
            identifier: identifier,
            nonce: nonce,
            parameters: convertedParams,
            userConfirmed: userConfirmed
        )

        // Dispatch callback to main queue for thread safety
        DispatchQueue.main.async {
            instance.shortcutCallback?(shortcutData)
            print("[IosIntents] Shortcut callback invoked on main queue")
        }
    }
}

// MARK: - Error Types

/// Errors that can occur in IosIntents operations
enum IosIntentsError: Error, LocalizedError {
    case appGroupAccessFailed
    case noSharedInstance
    case noPendingCommand

    var errorDescription: String? {
        switch self {
        case .appGroupAccessFailed:
            return "Failed to access App Group. Make sure App Groups capability is enabled in Xcode and the App Group ID matches: \(IosIntents.appGroupId)"
        case .noSharedInstance:
            return "No IosIntents shared instance available. Make sure the module is initialized."
        case .noPendingCommand:
            return "No pending command found in shared UserDefaults."
        }
    }
}
