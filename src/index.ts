import type {
  IntentsConfig,
  ShortcutsConfig,
  ShortcutInvocation,
  ShortcutListener,
  ShortcutDefinition,
  ShortcutResponse,
  RespondCallback,
  StateDialog,
  AppState,
  AppStateValue,
} from './types';
import type {
  LiveActivityDefinition,
  LiveActivityFieldDef,
  LiveActivityData,
  LiveActivityButtonAction,
  LayoutNode,
} from './liveactivity-types';
import type { RunningActivityInfo } from './LiveActivity.nitro';
import { SiriShortcutsManager } from './SiriShortcutsManager';
import { LiveActivitiesManager } from './LiveActivitiesManager';

// Export types
export type {
  IntentsConfig,
  ShortcutsConfig,
  ShortcutInvocation,
  ShortcutListener,
  ShortcutDefinition,
  ShortcutResponse,
  RespondCallback,
  StateDialog,
  AppState,
  AppStateValue,
  LiveActivityDefinition,
  LiveActivityFieldDef,
  LiveActivityData,
  LiveActivityButtonAction,
  LayoutNode,
  RunningActivityInfo,
};

// Singleton manager instance - ensures all listeners share the same state
// and native callback registration
const manager = new SiriShortcutsManager();

/**
 * Main API for iOS Siri Shortcuts
 *
 * Shortcuts are defined in intents.config.ts at the root of your app project
 * and are automatically generated as Swift code at build time.
 *
 * This API allows you to:
 * - Listen for shortcut invocations from Siri
 * - Update app state for smart confirmations (iOS 18+)
 * - Clean up shortcuts state
 *
 * @example
 * ```typescript
 * import { SiriShortcuts } from 'react-native-ios-intents';
 *
 * // In your component:
 * useEffect(() => {
 *   // Listen for Siri invocations
 *   const subscription = SiriShortcuts.addEventListener('shortcut', async (shortcut, respond) => {
 *     if (shortcut.identifier === 'startTimer') {
 *       // Can do async operations
 *       await checkPermissions();
 *
 *       // Start the timer
 *       startTimer();
 *
 *       // Send feedback to Siri
 *       respond({ message: "Timer started successfully!" });
 *     }
 *   });
 *
 *   // Cleanup on unmount
 *   return () => subscription.remove();
 * }, []);
 * ```
 *
 * For type-safe autocomplete with your specific shortcuts:
 * ```typescript
 * import type { ShortcutInvocation } from './shortcuts.generated';
 *
 * const subscription = SiriShortcuts.addEventListener<ShortcutInvocation>('shortcut', (shortcut, respond) => {
 *   // Now you get autocomplete for shortcut.identifier and shortcut.parameters!
 *   if (shortcut.identifier === 'addTask') {
 *     console.log(shortcut.parameters.taskName); // TypeScript knows this exists
 *   }
 * });
 * ```
 *
 * Users can now say "Hey Siri, start timer in [Your App Name]" and Siri will respond with your message!
 *
 * Note: To add or modify shortcuts, edit intents.config.ts
 * and run `npx react-native-ios-intents generate`, then rebuild your iOS app.
 */
export const SiriShortcuts = {
  /**
   * Adds a listener for shortcut invocations from Siri
   * Returns a subscription object with a remove() method
   *
   * @param event - Event name ('shortcut')
   * @param listener - Callback function to handle shortcut invocations
   * @returns Subscription object with remove() method
   *
   * @template T - Generic type for type-safe shortcuts (use generated ShortcutInvocation type)
   */
  addEventListener: <T extends { identifier: string; nonce: string; parameters?: Record<string, unknown>; userConfirmed?: boolean } = ShortcutInvocation>(
    event: 'shortcut',
    listener: (shortcut: T, respond: RespondCallback) => void | Promise<void>
  ) => manager.addEventListener<T>(event, listener),

  /**
   * Cleans up all shortcuts state
   * Use this for logout, feature disable, or full teardown
   *
   * @param stateKeys - Optional array of app state keys to clear. If omitted, clears all tracked keys.
   */
  cleanup: (stateKeys?: string[]) => manager.cleanup(stateKeys),

  /**
   * Updates app state for smart App Intent confirmations
   * Syncs current app state to shared UserDefaults so Swift can read it
   * for dynamic confirmation dialogs (e.g., "Are you sure you want to stop the timer?")
   *
   * @param state - Key-value pairs of app state
   *
   * @example
   * ```typescript
   * // Update state when timer starts/stops
   * SiriShortcuts.updateAppState({ timerRunning: true });
   * SiriShortcuts.updateAppState({ timerRunning: false });
   * ```
   */
  updateAppState: (state: AppState) => manager.updateAppState(state),
};

export default SiriShortcuts;

// Live Activities singleton instance
const liveActivitiesManager = new LiveActivitiesManager();

/**
 * API for iOS Live Activities (iOS 16.1+)
 *
 * Live Activities are defined in intents.config.ts and generated as Swift code.
 * Use this API to start, update, and end Live Activities at runtime.
 *
 * @example
 * ```typescript
 * import { LiveActivities } from 'react-native-ios-intents';
 *
 * // Start a timer Live Activity
 * const id = LiveActivities.startActivity('timerActivity',
 *   { taskName: 'Work' },
 *   { elapsedSeconds: 0, isRunning: true }
 * );
 *
 * // Update every second
 * LiveActivities.updateActivity(id, 'timerActivity', { elapsedSeconds: seconds });
 *
 * // Stop
 * LiveActivities.endActivity(id, 'timerActivity');
 * ```
 */
export const LiveActivities = {
  /**
   * Adds a listener for Live Activity button tap events
   *
   * Unlike Siri shortcuts, button events are fire-and-forget — there is no
   * `respond` callback. The listener receives just the action identifier and nonce.
   *
   * @param event - Event name ('button')
   * @param listener - Callback receiving the button action
   * @returns Subscription object with remove() method
   *
   * @template T - Generic type for type-safe button actions (use generated LiveActivityButtonAction)
   *
   * @example
   * ```typescript
   * const sub = LiveActivities.addEventListener('button', (action) => {
   *   if (action.identifier === 'pauseTimer') handlePause();
   *   else if (action.identifier === 'resumeTimer') handleResume();
   * });
   * return () => sub.remove();
   * ```
   */
  addEventListener: <T extends LiveActivityButtonAction = LiveActivityButtonAction>(
    event: 'button',
    listener: (action: T) => void
  ) => liveActivitiesManager.addEventListener<T>(event, listener),

  /**
   * Start a new Live Activity
   *
   * @param type - Activity type identifier (from config)
   * @param attributes - Static attributes (set once)
   * @param state - Initial content state (can be updated)
   * @param staleDate - Optional date after which the system dims the activity
   * @returns Activity ID or null on failure
   */
  startActivity: (
    type: string,
    attributes: LiveActivityData,
    state: LiveActivityData,
    staleDate?: Date
  ) => liveActivitiesManager.startActivity(type, attributes, state, staleDate),

  /**
   * Update a running Live Activity's content state
   *
   * @param activityId - ID from startActivity
   * @param type - Activity type identifier
   * @param state - New content state
   * @param staleDate - Optional date after which the system dims the activity
   * @returns true if activity was found and update was dispatched (actual update completes asynchronously)
   */
  updateActivity: (
    activityId: string,
    type: string,
    state: LiveActivityData,
    staleDate?: Date
  ) => liveActivitiesManager.updateActivity(activityId, type, state, staleDate),

  /**
   * End a running Live Activity
   *
   * @param activityId - ID from startActivity
   * @param type - Activity type identifier
   * @returns true if activity was found and end was dispatched (actual dismissal completes asynchronously)
   */
  endActivity: (activityId: string, type: string) =>
    liveActivitiesManager.endActivity(activityId, type),

  /**
   * Get info about currently running Live Activities
   * 
   * @returns Array of running Live Activity info objects
   */
  getRunningActivities: () => liveActivitiesManager.getRunningActivities(),
};
