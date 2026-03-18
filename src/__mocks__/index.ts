/**
 * Mock for react-native-ios-intents
 *
 * Usage in your tests:
 * ```typescript
 * jest.mock('react-native-ios-intents', () => require('react-native-ios-intents/mock'));
 * ```
 */

const listeners: Array<(shortcut: any) => void> = [];

const SiriShortcuts = {
  addEventListener: jest.fn(
    (_event: string, listener: (shortcut: any) => void) => {
      listeners.push(listener);
      return {
        remove: jest.fn(() => {
          const index = listeners.indexOf(listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }),
      };
    }
  ),
  cleanup: jest.fn((_stateKeys?: string[]) => {
    listeners.length = 0;
  }),
  updateAppState: jest.fn((_state: Record<string, any>) => {}),
};

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  setEnabled: jest.fn(),
  isEnabled: jest.fn(() => true),
  setPrefix: jest.fn(),
  setTransport: jest.fn(),
};

const buttonListeners: Array<(action: any) => void> = [];

const LiveActivities = {
  addEventListener: jest.fn(
    (_event: string, listener: (action: any) => void) => {
      buttonListeners.push(listener);
      return {
        remove: jest.fn(() => {
          const index = buttonListeners.indexOf(listener);
          if (index > -1) {
            buttonListeners.splice(index, 1);
          }
        }),
      };
    }
  ),
  startActivity: jest.fn(
    (
      _type: string,
      _attributes: Record<string, any>,
      _state: Record<string, any>,
      _staleDate?: Date
    ) => 'mock-activity-id'
  ),
  updateActivity: jest.fn(
    (
      _activityId: string,
      _type: string,
      _state: Record<string, any>,
      _staleDate?: Date
    ) => true
  ),
  endActivity: jest.fn((_activityId: string, _type: string) => true),
  getRunningActivities: jest.fn(() => []),
};

module.exports = {
  SiriShortcuts,
  LiveActivities,
  logger,
  Logger: class MockLogger {},
};
