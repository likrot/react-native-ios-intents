import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Shortcut data passed from native to JS
 */
export interface NativeShortcutData {
  /** The shortcut identifier that was invoked */
  identifier: string;
  /** Unique nonce for this invocation (used for response matching) */
  nonce: string;
  /**
   * Parameters captured from Siri voice interaction
   * Keys match parameter names, values match parameter types
   * - string parameters → string
   * - number parameters → number
   * - boolean parameters → boolean
   * - date parameters → Date
   */
  parameters?: Record<string, string | number | boolean | Date>;
  /**
   * Whether user confirmed a state-based dialog
   * true = confirmed, false = cancelled, undefined = no dialog shown
   */
  userConfirmed?: boolean;
}

/**
 * Native bridge for iOS App Intents functionality
 *
 * This interface defines the low-level native operations.
 * High-level API is exposed through the SiriShortcuts class.
 *
 * Note: Shortcuts are defined in shortcuts.config.ts and generated
 * as Swift code at build time. No runtime registration is needed.
 */
export interface IosIntents extends HybridObject<{ ios: 'swift' }> {
  /**
   * Sets a callback to be invoked when a shortcut is triggered by Siri
   *
   * @param callback - Function to call with shortcut data
   */
  setShortcutCallback(callback: (shortcut: NativeShortcutData) => void): void;

  /**
   * Reads a string value from the shared UserDefaults (App Group)
   *
   * App Intents run in a separate process and write to a shared container.
   * This method accesses the same container to read pending commands.
   *
   * @param key - The key to read
   * @returns The string value, or null if not found
   */
  getSharedString(key: string): string | null;
  /**
   * Writes a string value to the shared UserDefaults (App Group)
   *
   * @param key - The key to write
   * @param value - The value to write, or null to remove
   */
  setSharedString(key: string, value: string | null): void;
  /**
   * Reads a number value from the shared UserDefaults (App Group)
   *
   * @param key - The key to read
   * @returns The number value, or null if not found
   */
  getSharedNumber(key: string): number | null;
  /**
   * Writes a number value to the shared UserDefaults (App Group)
   *
   * @param key - The key to write
   * @param value - The value to write, or null to remove
   */
  setSharedNumber(key: string, value: number | null): void;
}
