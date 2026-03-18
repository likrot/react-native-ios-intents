import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Live Activity data passed from JS to native for starting an activity
 */
export interface NativeLiveActivityData {
  /** The Live Activity type identifier (matches config identifier) */
  activityType: string;
  /** Static attributes set once when activity starts */
  attributes: Record<string, string | number | boolean>;
  /** Dynamic content state that can be updated */
  contentState: Record<string, string | number | boolean>;
  /** Optional stale date as Unix timestamp (seconds). System dims the activity after this date. */
  staleDateTimestamp?: number;
}

/**
 * Info about a currently running Live Activity, returned by getRunningActivities
 */
export interface RunningActivityInfo {
  /** The activity ID (same as returned from startActivity) */
  activityId: string;
  /** The activity type identifier (e.g., 'timerActivity') */
  activityType: string;
}

/**
 * Native module for iOS Live Activities (iOS 16.2+)
 *
 * This interface defines the low-level native operations for Live Activities.
 * High-level API is exposed through the LiveActivities class.
 */
export interface LiveActivityModule extends HybridObject<{ ios: 'swift' }> {
  /**
   * Start a Live Activity
   *
   * @param data - Activity type, attributes, and initial content state
   * @returns Activity ID string on success, null on failure
   */
  startActivity(data: NativeLiveActivityData): string | null;

  /**
   * Update a running Live Activity's content state
   *
   * @param activityType - The activity type identifier
   * @param activityId - The activity ID returned from startActivity
   * @param contentState - New content state values
   * @param staleDateTimestamp - Optional stale date as Unix timestamp (seconds)
   * @returns true if activity was found and update was dispatched (actual update completes asynchronously)
   */
  updateActivity(
    activityType: string,
    activityId: string,
    contentState: Record<string, string | number | boolean>,
    staleDateTimestamp?: number
  ): boolean;

  /**
   * End a running Live Activity
   *
   * @param activityType - The activity type identifier
   * @param activityId - The activity ID returned from startActivity
   * @returns true if activity was found and end was dispatched (actual dismissal completes asynchronously)
   */
  endActivity(activityType: string, activityId: string): boolean;

  /**
   * Returns all currently running Live Activities
   *
   * @returns Array of running activity info (id + type)
   */
  getRunningActivities(): RunningActivityInfo[];
}
