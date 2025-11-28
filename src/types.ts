/**
 * Allowed value types for app state
 * - boolean: stored as number (0 or 1)
 * - number: stored directly
 * - string: stored directly
 * - null/undefined: clears the key
 * - object/array: serialized as JSON string
 */
export type AppStateValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | object
  | Array<unknown>;

/**
 * App state record type for updateAppState
 */
export type AppState = Record<string, AppStateValue>;

/**
 * Siri parameter definition for App Intents
 * Allows capturing user input through voice interaction
 */
export interface ShortcutParameter {
  /**
   * Parameter identifier (used as Swift property name)
   * Must be camelCase and valid Swift identifier (e.g., 'taskName', 'dueDate')
   */
  name: string;
  /**
   * Human-readable title shown to user by Siri
   * Example: "Task Name" → Siri asks "What task name?"
   */
  title: string;
  /**
   * Parameter type - determines what kind of input Siri accepts
   * - string: Text input from user
   * - number: Numeric input
   * - boolean: Yes/no question
   * - date: Date/time input (e.g., "tomorrow at 3pm", "next Friday")
   */
  type: 'string' | 'number' | 'boolean' | 'date';
  /**
   * If true, parameter is optional (user can skip)
   * If false, Siri will require the parameter before proceeding
   * Default: true
   */
  optional?: boolean;
  /**
   * Optional description for additional context
   * Helps Siri understand the parameter's purpose
   */
  description?: string;
}

/**
 * State-based dialog - shows messages to users based on app state
 * Can be used for confirmations (user must confirm) or simple feedback (just show message)
 */
export interface StateDialog {
  /** App state key to check (synced via updateAppState) */
  stateKey: string;
  /** Show this dialog when state equals this value */
  showWhen: boolean | string | number;
  /**
   * Message to show to the user via Siri
   * Supports dynamic interpolation using ${variableName} syntax
   * Example: "Timer '${taskName}' is already running for ${elapsedTime} minutes"
   */
  message: string;
  /**
   * If true: Shows confirmation dialog, user must confirm/cancel. If confirmed, continues to React Native. If cancelled, action is aborted.
   * If false: Shows informational message, then continues to React Native.
   * Default: true
   */
  requiresConfirmation?: boolean;
}

/**
 * Configuration for a Siri Shortcut (App Intents)
 */
export interface ShortcutDefinition {
  /** Unique identifier for the shortcut (e.g., 'startTimer') */
  identifier: string;
  /** Display title shown to users */
  title: string;
  /** Siri phrases that trigger this shortcut. Ideally as unique as possible */
  phrases: string[];
  /** Optional SF Symbol icon name (e.g., 'play.circle') */
  systemImageName?: string;
  /** Optional description */
  description?: string;
  /** Optional state-based dialogs - show messages/confirmations based on app state */
  stateDialogs?: StateDialog[];
  /**
   * Optional parameters that Siri will request from the user
   * Example: { name: 'taskName', title: 'Task Name', type: 'string' }
   * Siri will ask "What task name?" and pass the response to your handler
   */
  parameters?: ShortcutParameter[];
}

/**
 * Configuration options for initializing shortcuts
 */
export interface ShortcutsConfig {
  /** Array of shortcut definitions to register */
  shortcuts: ShortcutDefinition[];
  /**
   * Enable localization support (optional, default: false)
   * When true, generates a .xcstrings file for translations
   * and uses String(localized:) in Swift code.
   *
   * Note: You'll need to add the generated Localizable.xcstrings
   * file to your Xcode project to use translations.
   */
  localization?: boolean; //TODO: we should generate only if not exists, otherwise we should probably edit existing file to prevent user from losing progress
  /** Optional App Group ID (defaults to group.<bundle-id>) */
  appGroupId?: string;
}

/**
 * Data received when a shortcut is invoked by Siri
 */
export interface ShortcutInvocation {
  /** The shortcut identifier that was invoked */
  identifier: string;
  /**
   * Parameters captured from Siri voice interaction
   * Keys match the parameter names defined in ShortcutDefinition
   * Values are typed according to parameter type:
   * - string → string
   * - number → number
   * - boolean → boolean
   * - date → Date object
   */
  parameters?: Record<string, string | number | boolean | Date>;
  /** Unique nonce for this invocation (used for response matching) */
  nonce: string;
  /**
   * Indicates whether user confirmed a dialog (from stateDialogs)
   * - true: User confirmed
   * - false: User cancelled (shortcut still runs, but you can check this)
   * - undefined: No confirmation dialog was shown
   */
  userConfirmed?: boolean;
}

/**
 * Response to send back to Siri after handling a shortcut
 */
export interface ShortcutResponse {
  /**
   * Message to speak/display to the user via Siri.
   * If empty string or undefined, Siri will use a default feedback message (eg. Done).
   */
  message?: string;
}

/**
 * Function to send a response back to Siri
 * Call this after handling the shortcut to provide user feedback
 */
export type RespondCallback = (response: ShortcutResponse) => void;

/**
 * Listener callback for shortcut invocations
 * Can be async to handle asynchronous operations before responding
 *
 * @param shortcut - The invoked shortcut data
 * @param respond - Callback to send response back to Siri
 *
 * @example
 * ```typescript
 * SiriShortcuts.addEventListener('shortcut', async (shortcut, respond) => {
 *   if (shortcut.identifier === 'startTimer') {
 *     await checkPermissions();
 *     startTimer();
 *     respond({ message: "Timer started successfully!" });
 *   }
 * });
 * ```
 */
export type ShortcutListener = (
  shortcut: ShortcutInvocation,
  respond: RespondCallback
) => void | Promise<void>;
