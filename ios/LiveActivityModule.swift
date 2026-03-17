import ActivityKit
import Foundation
import NitroModules

/// Native module for iOS Live Activities (iOS 16.2+)
///
/// Uses GenericActivityAttributes with dictionary-based storage to call ActivityKit
/// directly.
///
/// Thread Safety:
/// - All public methods: Thread-safe (ActivityKit handles its own synchronization)
class LiveActivityModule: HybridLiveActivityModuleSpec {

    // MARK: - Initialization

    public override init() {
        super.init()
        print("[LiveActivityModule] Initialized")
    }

    // MARK: - Protocol Implementation

    /// Starts a Live Activity with the given type, attributes, and content state
    public func startActivity(data: NativeLiveActivityData) throws -> String? {
        print("[LiveActivityModule] Starting activity: \(data.activityType)")

        if #available(iOS 16.2, *) {
            // Inject _activityType into attributes for widget dispatch
            var attrData = convertToCodableDict(data.attributes)
            attrData["_activityType"] = .string(data.activityType)

            let attributes = GenericActivityAttributes(data: attrData)
            let state = GenericActivityAttributes.ContentState(
                data: convertToCodableDict(data.contentState)
            )
            let staleDate: Date? = data.staleDateTimestamp.map { Date(timeIntervalSince1970: $0) }
            let content = ActivityContent(state: state, staleDate: staleDate)

            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
                print("[LiveActivityModule] Activity started with ID: \(activity.id)")
                return activity.id
            } catch {
                print("[LiveActivityModule] Failed to start activity: \(error)")
                return nil
            }
        } else {
            print("[LiveActivityModule] Live Activities require iOS 16.2+")
            return nil
        }
    }

    /// Updates a running Live Activity's content state.
    /// Returns true if the activity was found and the update was dispatched.
    /// The actual ActivityKit update completes asynchronously.
    public func updateActivity(
        activityType: String,
        activityId: String,
        contentState: Dictionary<String, Variant_Bool_String_Double>,
        staleDateTimestamp: Double?
    ) throws -> Bool {
        print("[LiveActivityModule] Updating activity: \(activityId)")

        if #available(iOS 16.2, *) {
            let state = GenericActivityAttributes.ContentState(
                data: convertToCodableDict(contentState)
            )
            let staleDate: Date? = staleDateTimestamp.map { Date(timeIntervalSince1970: $0) }
            let content = ActivityContent(state: state, staleDate: staleDate)

            for activity in Activity<GenericActivityAttributes>.activities {
                if activity.id == activityId {
                    Task {
                        await activity.update(content)
                    }
                    print("[LiveActivityModule] Update dispatched for: \(activityId)")
                    return true
                }
            }

            print("[LiveActivityModule] Activity not found: \(activityId)")
            return false
        } else {
            print("[LiveActivityModule] Live Activities require iOS 16.2+")
            return false
        }
    }

    /// Returns all currently running Live Activities
    public func getRunningActivities() throws -> [RunningActivityInfo] {
        if #available(iOS 16.2, *) {
            return Activity<GenericActivityAttributes>.activities.compactMap { activity in
                guard let activityType = activity.attributes.data["_activityType"]?.stringValue else {
                    return nil
                }
                return RunningActivityInfo(activityId: activity.id, activityType: activityType)
            }
        }
        return []
    }

    /// Ends a running Live Activity.
    /// Returns true if the activity was found and the end was dispatched.
    /// The actual ActivityKit dismissal completes asynchronously.
    public func endActivity(activityType: String, activityId: String) throws -> Bool {
        print("[LiveActivityModule] Ending activity: \(activityId)")

        if #available(iOS 16.2, *) {
            for activity in Activity<GenericActivityAttributes>.activities {
                if activity.id == activityId {
                    Task {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                    print("[LiveActivityModule] End dispatched for: \(activityId)")
                    return true
                }
            }

            print("[LiveActivityModule] Activity not found: \(activityId)")
            return false
        } else {
            print("[LiveActivityModule] Live Activities require iOS 16.2+")
            return false
        }
    }

    // MARK: - Private Helpers

    /// Converts a Nitro Variant dictionary to CodableValue dictionary
    @available(iOS 16.2, *)
    private func convertToCodableDict(
        _ dict: Dictionary<String, Variant_Bool_String_Double>
    ) -> [String: CodableValue] {
        var result: [String: CodableValue] = [:]
        for (key, variant) in dict {
            switch variant {
            case .first(let boolValue):
                result[key] = .bool(boolValue)
            case .second(let stringValue):
                result[key] = .string(stringValue)
            case .third(let doubleValue):
                result[key] = .double(doubleValue)
            }
        }
        return result
    }
}
