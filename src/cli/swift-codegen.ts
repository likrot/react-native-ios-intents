/**
 * Swift code generation utilities for iOS App Intents
 *
 * This module contains functions that generate Swift source code from shortcut definitions.
 * These functions build AppIntent structs, state-based dialogs, and the complete Swift file.
 */

import type { ShortcutsConfig, ShortcutDefinition, StateDialog, ShortcutParameter } from '../types';
import {
  pascalCase,
  escapeForSwift,
  extractVariables,
  generateSwiftCondition,
} from './utils';

/**
 * Generates Swift code to interpolate variables into a message
 *
 * Variables in the format ${varName} are replaced with values from app state stored in UserDefaults.
 * Handles both string and numeric app state values. If localization is enabled,
 * the message is first loaded from localized strings before interpolation occurs.
 *
 * @param message - Template message with ${variable} placeholders (e.g., "Timer ${taskName} is running")
 * @param localizationKey - Localization key to use (only applied if useLocalization=true)
 * @param useLocalization - If true, load message from localized strings first, then interpolate
 * @returns Swift code that assigns the interpolated message to a 'message' variable
 *
 * @example
 * // Input: "Timer ${taskName} is running"
 * // Output: Swift code that reads appState_taskName from UserDefaults and replaces ${taskName}
 */
export function generateMessageInterpolation(
  message: string,
  localizationKey: string,
  useLocalization: boolean
): string {
  const variables = extractVariables(message);

  if (variables.length === 0) {
    if (useLocalization) {
      return `String(localized: "${localizationKey}", defaultValue: "${escapeForSwift(message)}")`;
    }
    return `"${escapeForSwift(message)}"`;
  }

  let swiftCode = '';

  if (useLocalization) {
    swiftCode += `var message = String(localized: "${localizationKey}", defaultValue: "${escapeForSwift(message)}")\n`;
  } else {
    swiftCode += `var message = "${escapeForSwift(message)}"\n`;
  }

  variables.forEach((varName) => {
    swiftCode += `        // Interpolate ${varName}\n`;
    swiftCode += `        if let value = defaults.string(forKey: "appState_${varName}") {\n`;
    swiftCode += `            message = message.replacingOccurrences(of: "\${${varName}}", with: value)\n`;
    swiftCode += `        } else if let numValue = defaults.object(forKey: "appState_${varName}") as? NSNumber {\n`;
    swiftCode += `            message = message.replacingOccurrences(of: "\${${varName}}", with: "\\(numValue)")\n`;
    swiftCode += `        }\n`;
  });

  return swiftCode;
}

/**
 * Generates Swift code for a single state dialog (confirmation or message-only)
 *
 * State dialogs are shown to the user when specific app state conditions are met.
 * For example, showing a confirmation when a timer is already running.
 * Supports both confirmation dialogs (requiring user approval) and message-only dialogs.
 *
 * @param params - Configuration object for dialog generation
 * @param params.index - Zero-based index of this dialog in the shortcut's stateDialogs array
 * @param params.className - PascalCase name of the Intent class (e.g., "StartTimerIntent")
 * @param params.dialog - The StateDialog definition from shortcuts config
 * @param params.condition - Swift boolean condition to check (e.g., "appState_timerRunning == true")
 * @param params.localizationKey - Localization key for this dialog message
 * @param params.useLocalization - Whether to generate localized strings or hard-coded text
 * @returns Object containing generated Swift code and whether it requires user confirmation
 */
export function generateStateDialogSwift(params: {
  index: number;
  className: string;
  dialog: StateDialog;
  condition: string;
  localizationKey: string;
  useLocalization: boolean;
}): { code: string; isConfirmation: boolean } {
  const { index, className, dialog, condition, localizationKey, useLocalization } = params;
  const requiresConfirmation = dialog.requiresConfirmation !== false;
  const hasInterpolation = extractVariables(dialog.message).length > 0;

  // Generate dialog string or interpolation code
  let messageCode: string;
  let dialogValue: string;

  if (hasInterpolation) {
    const messageInterpolation = generateMessageInterpolation(
      dialog.message,
      localizationKey,
      useLocalization
    );
    messageCode = `// Interpolate message with current app state
            ${messageInterpolation}
            `;
    dialogValue = 'message';
  } else {
    messageCode = '';
    dialogValue = useLocalization
      ? `String(localized: "${localizationKey}", defaultValue: "${escapeForSwift(dialog.message)}")`
      : `"${escapeForSwift(dialog.message)}"`;
  }

  const actionType = requiresConfirmation ? 'confirmation' : 'message and return';
  const logMessage = requiresConfirmation ? 'Confirmation required' : 'Showing message (no confirmation)';

  const actionCode = requiresConfirmation
    ? `do {
                try await requestConfirmation(
                    result: .result(dialog: IntentDialog(stringLiteral: ${dialogValue}))
                )
                // User confirmed - set flag and continue
                userConfirmedOverride = true
            } catch {
                // User cancelled - abort execution (React Native will not be invoked)
                print("[${className}] User cancelled confirmation")
                throw error
            }`
    : `return .result(dialog: IntentDialog(stringLiteral: ${dialogValue}))`;

  return {
    code: `
        // State dialog #${index + 1}: Show ${actionType} when ${dialog.stateKey} == ${dialog.showWhen}
        if ${condition} {
            print("[${className}] ${logMessage}: ${dialog.stateKey} is ${dialog.showWhen}")
            ${messageCode}${actionCode}
        }`,
    isConfirmation: requiresConfirmation
  };
}

/**
 * Maps TypeScript parameter type to Swift type
 *
 * All parameter types are optional in Swift (marked with ?) because
 * Siri handles required vs optional parameter logic. Even if a parameter
 * is marked as `optional: false` in the config, it's still `Type?` in Swift.
 *
 * @param type - TypeScript type from ShortcutParameter
 * @returns Swift type string with optional marker (e.g., "String?")
 */
function mapParameterTypeToSwift(type: ShortcutParameter['type']): string {
  switch (type) {
    case 'string':
      return 'String?';
    case 'number':
      return 'Double?';
    case 'boolean':
      return 'Bool?';
    case 'date':
      return 'Date?';
  }
}

/**
 * Generates Swift @Parameter property declarations
 *
 * Creates @Parameter-decorated properties for each parameter in the shortcut config.
 * These properties allow Siri to prompt the user for input values.
 *
 * @param parameters - Array of parameter definitions from shortcut config
 * @param useLocalization - Whether to use localized parameter titles
 * @param shortcutIdentifier - Identifier for localization keys
 * @returns Swift code for parameter declarations (empty string if no parameters)
 *
 * @example
 * // Input: [{ name: 'taskName', title: 'Task Name', type: 'string', description: 'The task' }]
 * // Output:
 * // @Parameter(title: "Task Name", description: "The task")
 * // var taskName: String?
 */
function generateParameterDeclarations(
  parameters: ShortcutParameter[] | undefined,
  useLocalization: boolean,
  shortcutIdentifier: string
): string {
  if (!parameters || parameters.length === 0) {
    return '';
  }

  const declarations = parameters
    .map((param, index) => {
      const swiftType = mapParameterTypeToSwift(param.type);

      // Generate title using LocalizedStringResource when localization is enabled
      const titleValue = useLocalization
        ? `LocalizedStringResource("${shortcutIdentifier}.parameters.${index}.title", defaultValue: "${escapeForSwift(param.title)}")`
        : `LocalizedStringResource("${escapeForSwift(param.title)}")`;

      // Generate description if provided (use LocalizedStringResource, not IntentDescription)
      const descriptionPart = param.description
        ? useLocalization
          ? `, description: LocalizedStringResource("${shortcutIdentifier}.parameters.${index}.description", defaultValue: "${escapeForSwift(param.description)}")`
          : `, description: LocalizedStringResource("${escapeForSwift(param.description)}")`
        : '';

      return `    @Parameter(title: ${titleValue}${descriptionPart})
    var ${param.name}: ${swiftType}`;
    })
    .join('\n');

  return `\n${declarations}\n`;
}

/**
 * Generates Swift initializers for AppIntent with parameters
 *
 * App Intents with parameters require both a default init() and a parameterized init().
 * Without these, the intent may silently fail to execute.
 *
 * @param parameters - Array of parameter definitions from shortcut config
 * @returns Swift code for initializers (empty string if no parameters)
 *
 * @example
 * // Input: [{ name: 'taskName', type: 'string' }]
 * // Output:
 * // init() {}
 * // init(taskName: String?) {
 * //     self.taskName = taskName
 * // }
 */
function generateInitializers(
  parameters: ShortcutParameter[] | undefined
): string {
  if (!parameters || parameters.length === 0) {
    return '';
  }

  // Build parameter list for parameterized init
  const paramList = parameters
    .map((param) => {
      const swiftType = mapParameterTypeToSwift(param.type);
      return `${param.name}: ${swiftType}`;
    })
    .join(', ');

  // Build property assignments
  const assignments = parameters
    .map((param) => `        self.${param.name} = ${param.name}`)
    .join('\n');

  return `
    init() {}

    init(${paramList}) {
${assignments}
    }
`;
}

/**
 * Generates Swift code to request parameter values from user
 *
 * When a parameter is nil, this code prompts Siri to ask the user for the value.
 * Uses the $parameter.requestValue() method to show a prompt and capture input.
 *
 * @param parameters - Array of parameter definitions from shortcut config
 * @param useLocalization - Whether to use localized prompt strings
 * @param shortcutIdentifier - The shortcut identifier for localization keys
 * @returns Swift code for requesting parameters (empty string if no parameters)
 *
 * @example
 * // Input: [{ name: 'taskName', type: 'string', title: 'Task Name' }]
 * // Output:
 * // if taskName == nil {
 * //     taskName = try await $taskName.requestValue("What task name?")
 * // }
 */
function generateParameterRequests(
  parameters: ShortcutParameter[] | undefined,
  useLocalization: boolean,
  shortcutIdentifier: string
): string {
  if (!parameters || parameters.length === 0) {
    return '';
  }

  const requests = parameters
    .map((param, index) => {
      // Generate prompt message
      const promptKey = `${shortcutIdentifier}.parameters.${index}.prompt`;
      const defaultPrompt = `What ${param.title.toLowerCase()}?`;

      const promptValue = useLocalization
        ? `IntentDialog(stringLiteral: String(localized: "${promptKey}", defaultValue: "${escapeForSwift(defaultPrompt)}"))`
        : `IntentDialog(stringLiteral: "${escapeForSwift(defaultPrompt)}")`;

      return `        // Request ${param.name} if not provided
        if ${param.name} == nil {
            ${param.name} = try await $${param.name}.requestValue(${promptValue})
        }`;
    })
    .join('\n');

  return `\n${requests}\n`;
}

/**
 * Generates Swift code to write parameter values to UserDefaults
 *
 * Creates if-let blocks that unwrap optional parameters and write them to
 * shared UserDefaults with keys in the format: IosIntentsParam_<paramName>
 *
 * Different types are handled appropriately:
 * - String: Written directly
 * - Number (Double): Written directly
 * - Boolean (Bool): Written directly
 * - Date: Converted to Unix timestamp (timeIntervalSince1970) before writing
 *
 * @param parameters - Array of parameter definitions from shortcut config
 * @returns Swift code for writing parameters to UserDefaults (empty string if no parameters)
 *
 * @example
 * // Input: [{ name: 'dueDate', type: 'date' }]
 * // Output:
 * // if let dueDate = dueDate {
 * //     defaults.set(dueDate.timeIntervalSince1970, forKey: "IosIntentsParam_dueDate")
 * // }
 */
function generateParameterWrites(
  parameters: ShortcutParameter[] | undefined
): string {
  if (!parameters || parameters.length === 0) {
    return '';
  }

  const writes = parameters
    .map((param) => {
      const key = `IosIntentsParam_${param.name}`;
      const typeKey = `IosIntentsParamType_${param.name}`;

      // Date type requires conversion to Unix timestamp + type marker
      if (param.type === 'date') {
        return `        if let ${param.name} = ${param.name} {
            print("[AddTaskIntent] Writing parameter ${param.name} (Date): \\(${param.name})")
            defaults.set(${param.name}.timeIntervalSince1970, forKey: "${key}")
            defaults.set("date", forKey: "${typeKey}")
        } else {
            print("[AddTaskIntent] Parameter ${param.name} is nil")
        }`;
      }

      // Boolean type needs type marker for reliable detection
      if (param.type === 'boolean') {
        return `        if let ${param.name} = ${param.name} {
            print("[AddTaskIntent] Writing parameter ${param.name}: \\(${param.name})")
            defaults.set(${param.name}, forKey: "${key}")
            defaults.set("boolean", forKey: "${typeKey}")
        } else {
            print("[AddTaskIntent] Parameter ${param.name} is nil")
        }`;
      }

      // String and number types can be written directly (no type marker needed)
      return `        if let ${param.name} = ${param.name} {
            print("[AddTaskIntent] Writing parameter ${param.name}: \\(${param.name})")
            defaults.set(${param.name}, forKey: "${key}")
        } else {
            print("[AddTaskIntent] Parameter ${param.name} is nil")
        }`;
    })
    .join('\n');

  return `\n        // Write parameter values to shared UserDefaults
${writes}\n`;
}

/**
 * Generates a complete Swift AppIntent struct for a single shortcut
 *
 * This function creates the Swift code for an AppIntent that:
 * 1. Declares @Parameter properties for Siri input capture (if parameters defined)
 * 2. Checks app state for conditional dialogs/confirmations
 * 3. Writes parameter values to shared UserDefaults (if parameters defined)
 * 4. Writes a pending command to shared UserDefaults
 * 5. Posts a Darwin notification to wake the React Native app
 * 6. Polls UserDefaults for a response from React Native
 * 7. Returns the response to Siri as a dialog
 *
 * The generated Intent uses inter-process communication (IPC) via:
 * - Shared UserDefaults (App Groups) for data exchange
 * - Darwin notifications for cross-process signaling
 * - Nonce-based response keys to prevent race conditions
 *
 * @param shortcut - The shortcut definition from shortcuts config
 * @param useLocalization - Whether to generate localized strings or hard-coded text
 * @returns Complete Swift struct implementing AppIntent protocol
 */
export function generateIntentStruct(
  shortcut: ShortcutDefinition,
  useLocalization: boolean
): string {
  const className = `${pascalCase(shortcut.identifier)}Intent`;

  // Generate parameter declarations
  const parameterDeclarations = generateParameterDeclarations(
    shortcut.parameters,
    useLocalization,
    shortcut.identifier
  );

  // Generate initializers (required for parameters to work)
  const initializers = generateInitializers(shortcut.parameters);

  // Generate parameter request calls (prompts user for missing values)
  const parameterRequests = generateParameterRequests(
    shortcut.parameters,
    useLocalization,
    shortcut.identifier
  );

  // Generate parameter writes
  const parameterWrites = generateParameterWrites(shortcut.parameters);

  // Generate state-based dialog checks
  // State dialogs allow showing confirmations or messages based on current app state
  // For example: "Are you sure you want to stop the timer?" when timer is running
  let dialogCode = '';
  let hasConfirmationDialogs = false;

  if (shortcut.stateDialogs && shortcut.stateDialogs.length > 0) {
    // Step 1: Generate Swift condition checks for each state dialog
    // Each dialog checks UserDefaults for a specific state key (synced from React Native)
    const checks = shortcut.stateDialogs
      .map((dialog, index) => {
        // Convert state key to UserDefaults key format (e.g., "timerRunning" → "appState_timerRunning")
        const stateKey = `appState_${dialog.stateKey}`;
        // Generate Swift condition (e.g., appState_timerRunning == "true")
        const condition = generateSwiftCondition(stateKey, dialog.showWhen);
        // Create localization key for translation system
        const localizationKey = `${shortcut.identifier}.stateDialogs.${index}.message`;

        const result = generateStateDialogSwift({
          index,
          className,
          dialog,
          condition,
          localizationKey,
          useLocalization,
        });

        // Track if any dialog requires confirmation (affects code generation below)
        if (result.isConfirmation) {
          hasConfirmationDialogs = true;
        }

        return result.code;
      })
      .join('\n');

    // Step 2: Declare userConfirmedOverride variable if any dialog requires confirmation
    // This tracks whether user approved state-based confirmation dialogs
    // and is written to UserDefaults for React Native to read
    const variableDeclaration = hasConfirmationDialogs
      ? `
        // Track whether user confirmed any state-based dialogs
        var userConfirmedOverride = false
        `
      : '';

    dialogCode = `
        // Check app state for state-based dialogs
        ${variableDeclaration}${checks}
    `;
  }

  // Generate title and description
  const titleValue = useLocalization
    ? `"${shortcut.identifier}.title"`
    : `"${escapeForSwift(shortcut.title)}"`;

  const descriptionValue = shortcut.description
    ? useLocalization
      ? `static var description = IntentDescription("${shortcut.identifier}.description")`
      : `static var description = IntentDescription("${escapeForSwift(shortcut.description)}")`
    : '';

  // Error and timeout messages
  const errorMessage = useLocalization
    ? `String(localized: "system.error.appGroupFailed", defaultValue: "Failed to communicate with app")`
    : `"Failed to communicate with app"`;

  const timeoutMessage = useLocalization
    ? `String(localized: "system.timeout", defaultValue: "Done")`
    : `"Done"`;

  return `
@available(iOS 16.0, *)
struct ${className}: AppIntent {
    static var title: LocalizedStringResource = ${titleValue}
    ${descriptionValue}
    static var openAppWhenRun: Bool { true }
${parameterDeclarations}${initializers}
    func perform() async throws -> some IntentResult & ProvidesDialog {
        print("[${className}] Performing shortcut: ${shortcut.identifier}")

        // App Intents run in a separate process with sandbox restrictions.
        // Inter-process communication happens via UserDefaults with App Groups
        // (configured via App Capabilities in Xcode: group.<bundle-id>).
        // This allows data exchange between the App Intent extension and React Native app.
        guard let defaults = UserDefaults(suiteName: APP_GROUP_ID) else {
            print("[${className}] ERROR: Failed to access App Group")
            return .result(dialog: IntentDialog(stringLiteral: ${errorMessage}))
        }
${parameterRequests}${dialogCode}
        let nonce = UUID().uuidString
${parameterWrites}
        defaults.set("${shortcut.identifier}", forKey: "IosIntentsPendingCommand")
        defaults.set(nonce, forKey: "IosIntentsCommandNonce")
        defaults.set(Date().timeIntervalSince1970, forKey: "IosIntentsCommandTimestamp")${
          hasConfirmationDialogs
            ? `
        defaults.set(userConfirmedOverride, forKey: "IosIntentsUserConfirmed")`
            : ''
        }

        print("[${className}] Command written to shared UserDefaults")

        // Post Darwin notification to wake up main app (cross-process notification)
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName("eu.eblank.likrot.iosintents.shortcut" as CFString),
            nil, nil, true
        )

        print("[${className}] Darwin notification posted")

        // Poll UserDefaults for response from React Native (with timeout)
        // This is necessary because App Intents and React Native run in separate processes.
        // The nonce ensures we don't receive stale responses from previous executions.
        // Note: \\(nonce) is Swift string interpolation syntax in the generated code (not JS)
        let responseKey = "IosIntentsResponse_\\(nonce)"
        let timeout: TimeInterval = 5.0      // 5 second timeout (balance between UX and resource usage)
        let pollInterval: TimeInterval = 0.1  // Check every 100ms (frequent but not CPU-intensive)
        let startTime = Date()

        print("[${className}] Waiting for response...")

        while Date().timeIntervalSince(startTime) < timeout {
            // Check for response with this specific nonce
            if let responseMessage = defaults.string(forKey: responseKey) {
                print("[${className}] Received response: \\(responseMessage)")

                // Clean up to prevent memory leaks and duplicate processing
                defaults.removeObject(forKey: responseKey)

                // Return result with dialog
                // NOTE: When responseMessage is empty (""), Siri typically speaks a default
                // response like "Done" or "OK". This is observed iOS behavior - Apple's
                // documentation does not specify what happens with empty IntentDialog strings.
                // See: https://developer.apple.com/forums/thread/124730
                return .result(dialog: IntentDialog(stringLiteral: responseMessage))
            }

            // Non-blocking sleep to reduce CPU usage while polling
            try? await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))
        }

        print("[${className}] Timeout waiting for response")

        // Timeout reached - this could indicate app crashed, handler error, or slow response
        return .result(dialog: IntentDialog(stringLiteral: ${timeoutMessage}))
    }
}`;
}

/**
 * Generates Swift AppShortcut definition for registering a shortcut with Siri
 *
 * AppShortcuts define how users invoke shortcuts via Siri voice commands.
 * Each shortcut includes:
 * - Phrases that trigger the shortcut (voice commands)
 * - Display title and icon for Shortcuts app
 * - Reference to the AppIntent that performs the action
 *
 * Important: All phrases MUST include .applicationName per Apple's requirement.
 * Phrases must be string literals (not String(localized:)) because Siri extracts
 * them at compile-time for voice recognition training.
 *
 * @param shortcut - The shortcut definition from shortcuts config
 * @param useLocalization - Whether to generate localized shortTitle
 * @returns Swift AppShortcut(...) initialization code
 */
export function generateAppShortcut(
  shortcut: ShortcutDefinition,
  useLocalization: boolean
): string {
  const className = `${pascalCase(shortcut.identifier)}Intent`;

  // Every phrase MUST include .applicationName per Apple's requirement.
  // Omitting this causes Siri to reject the phrase during voice training.
  // Phrases must be string literals (not String(localized:)) because AppShortcutPhraseToken
  // requires compile-time strings for Siri to extract them for voice recognition.
  // Xcode automatically extracts these string literals for localization.
  const phrases = shortcut.phrases
    .map((phrase) => {
      if (phrase.includes('applicationName')) {
        // If phrase already has applicationName, use it as-is
        return `"${escapeForSwift(phrase)}"`;
      }
      // Add .applicationName to all phrases (required by Apple)
      return `"${escapeForSwift(phrase)} in \\(.applicationName)"`;
    })
    .join(',\n                ');

  const shortTitle = useLocalization
    ? `LocalizedStringResource("${shortcut.identifier}.title", defaultValue: "${escapeForSwift(shortcut.title)}")`
    : `"${escapeForSwift(shortcut.title)}"`;

  return `        AppShortcut(
            intent: ${className}(),
            phrases: [
                ${phrases}
            ],
            shortTitle: ${shortTitle},
            systemImageName: "${shortcut.systemImageName || 'app'}"
        )`;
}

/**
 * Generates the complete GeneratedAppIntents.swift file
 *
 * This function assembles all components into a complete Swift source file:
 * - File header with generation warning
 * - Import statements (Foundation, AppIntents)
 * - App Group ID configuration
 * - All AppIntent structs (one per shortcut)
 * - AppShortcutsProvider with all shortcuts registered
 *
 * The generated file is standalone and ready to be added to an Xcode project.
 *
 * @param config - Complete shortcuts configuration
 * @param useLocalization - Whether to generate localized strings
 * @returns Complete Swift source code as a string
 */
export function generateSwiftFile(
  config: ShortcutsConfig,
  useLocalization: boolean
): string {
  const intents = config.shortcuts
    .map((s) => generateIntentStruct(s, useLocalization))
    .join('\n');
  // Note: No separator needed between AppShortcuts - the @resultBuilder on
  // AppShortcutsProvider's appShortcuts property automatically combines them
  const appShortcuts = config.shortcuts
    .map((s) => generateAppShortcut(s, useLocalization))
    .join('\n');

  return `//
// GeneratedAppIntents.swift
//
// AUTO-GENERATED - DO NOT EDIT
// Generated from shortcuts.config.ts
// Run 'npx react-native-ios-intents generate' to regenerate
//

import Foundation
import AppIntents

// App Group for inter-process communication
// App Intents run in a separate process, so we use UserDefaults with App Group
// The App Group ID should be configured in your app's capabilities:
// Format: group.<bundle-identifier>
${
  config.appGroupId
    ? `private let APP_GROUP_ID = "${config.appGroupId}"`
    : `private var APP_GROUP_ID: String {
    guard let bundleId = Bundle.main.bundleIdentifier else {
        fatalError("Cannot determine bundle identifier")
    }
    return "group.\\(bundleId)"
}`
}

${intents}

@available(iOS 16.0, *)
struct GeneratedAppShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
${appShortcuts}
    }
}
`;
}
