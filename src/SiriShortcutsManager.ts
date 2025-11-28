import { NitroModules } from 'react-native-nitro-modules';
import { Platform } from 'react-native';
import type { IosIntents as IIosIntents, NativeShortcutData } from './IosIntents.nitro';
import type {
  ShortcutInvocation,
  ShortcutListener,
  ShortcutResponse,
  RespondCallback,
  AppState,
} from './types';
import { logger } from './Logger';

// Event key constant to prevent typos
const EVENT_SHORTCUT = 'shortcut' as const;

// Get Nitro module instance
const IosIntentsModule = Platform.OS === 'ios'
  ? NitroModules.createHybridObject<IIosIntents>('IosIntents')
  : null;

/**
 * Internal listener type that accepts any shortcut shape
 * We use 'any' for the shortcut parameter because:
 * 1. Runtime data is always the base ShortcutInvocation shape
 * 2. Generic types (T) are compile-time refinements (more specific types)
 * 3. Type safety is enforced at the addEventListener() API boundary
 * 4. This allows storing listeners with different generic types in the same Set
 */
type AnyShortcutListener = (shortcut: any, respond: RespondCallback) => void | Promise<void>; //TODO: check if this any can/should be replaced with some generiv maybe

/**
 * Singleton manager for Siri Shortcuts
 *
 * Shortcuts are defined in shortcuts.config.ts and generated as Swift code at build time.
 * This manager only handles listening for shortcut invocations.
 */
export class SiriShortcutsManager {
  private listeners: Map<string, Set<AnyShortcutListener>> = new Map();
  private nativeCallbackRegistered: boolean = false;
  private trackedStateKeys: Set<string> = new Set();

  /**
   * Gets native module if available (iOS only)
   * Returns the module for proper TypeScript type narrowing
   */
  private getNativeModule(): IIosIntents | null {
    if (Platform.OS === 'ios' && IosIntentsModule !== null) {
      return IosIntentsModule;
    }
    return null;
  }

  /**
   * Ensures the native callback is registered to receive shortcut invocations
   * via Darwin notifications (cross-process events)
   */
  private ensureNativeCallback(): void {
    if (this.nativeCallbackRegistered) {
      return;
    }

    const module = this.getNativeModule();
    if (!module) {
      return;
    }

    logger.info('Registering native callback for Darwin notifications...');

    // Register callback with native module to receive shortcut events
    module.setShortcutCallback((nativeData: NativeShortcutData) => {
      logger.debug('Received shortcut from native:', JSON.stringify(nativeData));

      const shortcut: ShortcutInvocation = {
        identifier: nativeData.identifier,
        nonce: nativeData.nonce,
        parameters: nativeData.parameters || {},
        userConfirmed: nativeData.userConfirmed,
      };

      this.handleShortcutInvocation(shortcut);
    });

    this.nativeCallbackRegistered = true;
    logger.info('Native callback registered successfully');
  }

  /**
   * Adds a listener for shortcut invocations from Siri
   * Returns a subscription object with a remove() method
   *
   * @example
   * ```typescript
   * // Basic usage with default types
   * const subscription = SiriShortcuts.addEventListener('shortcut', (shortcut) => {
   *   console.log('Shortcut invoked:', shortcut.identifier);
   * });
   *
   * // Type-safe usage with generated types (autocomplete for identifiers and parameters)
   * import type { ShortcutInvocation } from './shortcuts.generated';
   * const subscription = SiriShortcuts.addEventListener<ShortcutInvocation>('shortcut', (shortcut, respond) => {
   *   // TypeScript now knows exact shortcut identifiers and parameter shapes
   *   if (shortcut.identifier === 'addTask') {
   *     console.log(shortcut.parameters.taskName); // Autocomplete works!
   *   }
   * });
   *
   * // Later, remove the listener:
   * subscription.remove();
   * ```
   */
  addEventListener<T extends { identifier: string; nonce: string; parameters?: any; userConfirmed?: boolean } = ShortcutInvocation>(
    event: 'shortcut',
    listener: (shortcut: T, respond: RespondCallback) => void | Promise<void>
  ): { remove: () => void } {
    const eventKey = EVENT_SHORTCUT;

    if (!this.listeners.has(eventKey)) {
      this.listeners.set(eventKey, new Set());
    }

    // Cast to base listener type for storage
    this.listeners.get(eventKey)!.add(listener as ShortcutListener);
    logger.debug(`Added listener for ${event}`);

    // Set up native callback to receive Darwin notifications
    this.ensureNativeCallback();

    // Return subscription object
    return {
      remove: () => {
        const eventListeners = this.listeners.get(eventKey);
        if (eventListeners) {
          eventListeners.delete(listener);
          logger.debug(`Removed listener for ${event}`);

          // Reset native callback registration if no more listeners
          if (eventListeners.size === 0) {
            this.nativeCallbackRegistered = false;
          }
        }
      },
    };
  }

  /**
   * Cleans up all shortcuts state
   * Use this for logout, feature disable, or full teardown
   *
   * @param stateKeys - Optional array of specific keys to clear. If omitted, clears all tracked keys.
   *
   * @example
   * ```typescript
   * // On logout - clear everything (listeners + all tracked app state)
   * SiriShortcuts.cleanup();
   *
   * // Clear only specific keys
   * SiriShortcuts.cleanup(['timerRunning', 'taskName']);
   * ```
   */
  cleanup(stateKeys?: string[]): void {
    this.listeners.clear();
    this.nativeCallbackRegistered = false;

    // Use tracked keys if none specified
    const keysToClean = stateKeys ?? Array.from(this.trackedStateKeys);

    // Clear app state keys
    if (keysToClean.length > 0) {
      const module = this.getNativeModule();
      if (module) {
        keysToClean.forEach((key) => {
          module.setSharedString(`appState_${key}`, null);
        });
      }
    }

    // Clear tracked keys on full cleanup
    if (!stateKeys) {
      this.trackedStateKeys.clear();
    }

    logger.info('Shortcuts cleanup completed');
  }

  /**
   * Updates app state in shared UserDefaults
   * This allows App Intents (Swift) to read current app state for smart confirmations
   *
   * **UserDefaults Limitations:**
   * - Keep total data small (< 1MB recommended by Apple)
   * - Only property list types supported (strings, numbers, booleans, arrays, objects)
   * - Not suitable for large data, sensitive data (use Keychain), or frequently changing data
   * - App Groups required for cross-process access (App + App Intents)
   *
   * This is appropriate for small state sync (booleans, short strings, small numbers).
   *
   * @example
   * ```typescript
   * // Sync timer state
   * SiriShortcuts.updateAppState({ timerRunning: true, taskName: 'Work' });
   *
   * // Swift can now read this state for confirmations
   * ```
   */
  updateAppState(state: AppState): void {
    const module = this.getNativeModule();
    if (!module) {
      logger.warn('updateAppState: Not available on this platform');
      return;
    }

    try {
      logger.debug('Updating app state:', state);

      Object.entries(state).forEach(([key, value]) => {
        const stateKey = `appState_${key}`;

        // Track the key for cleanup
        this.trackedStateKeys.add(key);

        if (typeof value === 'boolean') {
          // Store booleans as numbers (0 or 1)
          module.setSharedNumber(stateKey, value ? 1 : 0);
        } else if (typeof value === 'number') {
          module.setSharedNumber(stateKey, value);
        } else if (typeof value === 'string') {
          module.setSharedString(stateKey, value);
        } else if (value === null || value === undefined) {
          // Clear the key
          module.setSharedString(stateKey, null);
        } else {
          // Serialize complex values as JSON string
          // This is appropriate for small objects/arrays that Swift can parse with JSONDecoder
          // Limitations: circular references will fail, keep objects small for UserDefaults
          try {
            module.setSharedString(stateKey, JSON.stringify(value));
          } catch (serializeError) {
            logger.warn(`Cannot serialize value for key "${key}":`, serializeError);
          }
        }
      });

      logger.info('App state updated successfully');
    } catch (error) {
      logger.error('Error updating app state:', error);
    }
  }

  // Private methods

  /**
   * Handles incoming shortcut invocations from native
   * Creates a respond callback and notifies all registered listeners
   *
   * @param shortcut - The shortcut invocation data from native
   */
  private handleShortcutInvocation(shortcut: ShortcutInvocation): void {
    try {
      logger.info('Shortcut invoked:', shortcut.identifier);

      // Create respond callback for this invocation
      const respond: RespondCallback = (response: ShortcutResponse) => {
        if (!IosIntentsModule) {
          logger.error('Cannot respond: IosIntentsModule not available');
          return;
        }

        try {
          const message = response.message ?? '';
          logger.debug('Sending response for', shortcut.nonce, ':', message || '(silent)');

          // Write response to shared UserDefaults using nonce as key
          // Swift App Intent will poll for this response
          const responseKey = `IosIntentsResponse_${shortcut.nonce}`;
          IosIntentsModule.setSharedString(responseKey, message);

          logger.info('Response sent successfully');
        } catch (error) {
          logger.error('Error sending response:', error);
        }
      };

      // Notify all listeners with respond callback
      const listeners = this.listeners.get(EVENT_SHORTCUT);
      if (listeners && listeners.size > 0) {
        listeners.forEach((listener) => {
          try {
            // Call listener (can be async)
            const result = listener(shortcut, respond);

            // If listener returns a promise, catch any errors
            if (result instanceof Promise) {
              result.catch((error) => {
                logger.error('Error in async listener:', error);
              });
            }
          } catch (error) {
            logger.error('Error in listener:', error);
          }
        });
      } else {
        logger.warn('Shortcut invoked but no listeners registered');
      }
    } catch (error) {
      logger.error('Error handling shortcut invocation:', error);
    }
  }
}
