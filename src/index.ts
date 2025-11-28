import type {
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
import { SiriShortcutsManager } from './SiriShortcutsManager';

// Export types
export type {
  ShortcutsConfig,
  ShortcutInvocation,
  ShortcutListener,
  ShortcutDefinition,
  ShortcutResponse,
  RespondCallback,
  StateDialog,
  AppState,
  AppStateValue,
};

// Singleton manager instance - ensures all listeners share the same state
// and native callback registration
const manager = new SiriShortcutsManager();

/**
 * Main API for iOS Siri Shortcuts
 *
 * Shortcuts are defined in shortcuts.config.ts at the root of your app project
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
 * Note: To add or modify shortcuts, edit shortcuts.config.ts
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
  addEventListener: <T extends { identifier: string; nonce: string; parameters?: any; userConfirmed?: boolean } = ShortcutInvocation>(
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
