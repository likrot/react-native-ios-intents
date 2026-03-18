import { NitroModules } from 'react-native-nitro-modules';
import { Platform } from 'react-native';
import type { LiveActivityModule as ILiveActivityModule, RunningActivityInfo } from './LiveActivity.nitro';
import type { NativeLiveActivityButtonData } from './IosIntents.nitro';
import { IosIntentsModule } from './NativeIosIntents';
import type { LiveActivityData, LiveActivityButtonAction } from './liveactivity-types';
import { logger } from './Logger';

// Get Nitro module instance (iOS only)
const LiveActivityModule =
  Platform.OS === 'ios'
    ? NitroModules.createHybridObject<ILiveActivityModule>('LiveActivityModule')
    : null;

/**
 * Manager for iOS Live Activities (iOS 16.2+)
 *
 * Live Activities are defined in intents.config.ts and generated as Swift code.
 * This manager handles starting, updating, and ending Live Activities at runtime.
 *
 * @example
 * ```typescript
 * import { LiveActivities } from 'react-native-ios-intents';
 *
 * // Start a Live Activity
 * const activityId = LiveActivities.startActivity(
 *   'timerActivity',
 *   { taskName: 'Work' },
 *   { timerStart: new Date(), isRunning: true }
 * );
 *
 * // Update it
 * LiveActivities.updateActivity(activityId, 'timerActivity', { isRunning: false });
 *
 * // End it
 * LiveActivities.endActivity(activityId, 'timerActivity');
 * ```
 */
export class LiveActivitiesManager {
  private buttonListeners: Set<(action: LiveActivityButtonAction) => void> = new Set();
  private nativeButtonCallbackRegistered: boolean = false;

  /**
   * Registers native button callback on first listener
   */
  private ensureNativeButtonCallback(): void {
    if (this.nativeButtonCallbackRegistered) {
      return;
    }

    if (!IosIntentsModule) {
      return;
    }

    logger.info('Registering native callback for Live Activity buttons...');

    IosIntentsModule.setLiveActivityButtonCallback((data: NativeLiveActivityButtonData) => {
      logger.debug('Received LA button tap:', JSON.stringify(data));

      const action: LiveActivityButtonAction = {
        identifier: data.identifier,
        nonce: data.nonce,
      };

      this.buttonListeners.forEach((listener) => {
        try {
          listener(action);
        } catch (error) {
          logger.error('Error in LA button listener:', error);
        }
      });
    });

    this.nativeButtonCallbackRegistered = true;
    logger.info('Native LA button callback registered');
  }

  /**
   * Adds a listener for Live Activity button tap events
   *
   * @param event - Event name ('button')
   * @param listener - Callback function receiving the button action
   * @returns Subscription object with remove() method
   *
   * @example
   * ```typescript
   * const sub = LiveActivities.addEventListener('button', (action) => {
   *   if (action.identifier === 'pauseTimer') handlePause();
   * });
   * // Later: sub.remove();
   * ```
   */
  addEventListener<T extends LiveActivityButtonAction = LiveActivityButtonAction>(
    event: 'button',
    listener: (action: T) => void
  ): { remove: () => void } {
    this.buttonListeners.add(listener as (action: LiveActivityButtonAction) => void);
    logger.debug(`Added listener for ${event}`);

    this.ensureNativeButtonCallback();

    return {
      remove: () => {
        this.buttonListeners.delete(listener as (action: LiveActivityButtonAction) => void);
        logger.debug(`Removed listener for ${event}`);

        if (this.buttonListeners.size === 0) {
          this.nativeButtonCallbackRegistered = false;
        }
      },
    };
  }

  /**
   * Starts a new Live Activity
   *
   * @param type - Activity type identifier (matches config identifier, e.g., 'timerActivity')
   * @param attributes - Static data set once (e.g., { taskName: 'Work' })
   * @param state - Initial dynamic content state (e.g., { timerStart: new Date() })
   * @param staleDate - Optional date after which the system dims the activity
   * @returns Activity ID string on success, null on failure or non-iOS
   */
  startActivity(
    type: string,
    attributes: LiveActivityData,
    state: LiveActivityData,
    staleDate?: Date
  ): string | null {
    if (!LiveActivityModule) {
      logger.warn('startActivity: Not available on this platform');
      return null;
    }

    logger.info('Starting Live Activity:', type);

    const result = LiveActivityModule.startActivity({
      activityType: type,
      attributes: this.convertData(attributes),
      contentState: this.convertData(state),
      staleDateTimestamp: staleDate
        ? staleDate.getTime() / 1000
        : undefined,
    });

    if (result) {
      logger.info('Live Activity started:', result);
    } else {
      logger.warn('Failed to start Live Activity');
    }

    return result;
  }

  /**
   * Updates a running Live Activity's content state
   *
   * @param activityId - The activity ID returned from startActivity
   * @param type - Activity type identifier
   * @param state - New content state values (partial updates supported)
   * @param staleDate - Optional date after which the system dims the activity
   * @returns true if activity was found and update was dispatched (actual update completes asynchronously)
   */
  updateActivity(
    activityId: string,
    type: string,
    state: LiveActivityData,
    staleDate?: Date
  ): boolean {
    if (!LiveActivityModule) {
      logger.warn('updateActivity: Not available on this platform');
      return false;
    }

    return LiveActivityModule.updateActivity(
      type,
      activityId,
      this.convertData(state),
      staleDate ? staleDate.getTime() / 1000 : undefined
    );
  }

  /**
   * Ends a running Live Activity
   *
   * @param activityId - The activity ID returned from startActivity
   * @param type - Activity type identifier
   * @returns true if activity was found and end was dispatched (actual dismissal completes asynchronously)
   */
  endActivity(activityId: string, type: string): boolean {
    if (!LiveActivityModule) {
      logger.warn('endActivity: Not available on this platform');
      return false;
    }

    logger.info('Ending Live Activity:', activityId);
    return LiveActivityModule.endActivity(type, activityId);
  }

  /**
   * Returns all currently running Live Activities
   *
   * @returns Array of running activity info (id + type), or empty array on non-iOS / error
   */
  getRunningActivities(): RunningActivityInfo[] {
    if (!LiveActivityModule) {
      logger.warn('getRunningActivities: Not available on this platform');
      return [];
    }

    return LiveActivityModule.getRunningActivities();
  }

  /**
   * Converts LiveActivityData to the format expected by the Nitro bridge.
   * Filters out null/undefined values and converts Dates to timestamps.
   */
  private convertData(
    data: LiveActivityData
  ): Record<string, string | number | boolean> {
    const result: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }
      if (value instanceof Date) {
        result[key] = value.getTime() / 1000; // Unix timestamp
      } else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        result[key] = value;
      } else {
        logger.warn(
          `convertData: skipping unsupported value for key "${key}" (type: ${typeof value})`
        );
      }
    }

    return result;
  }
}
