jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../Logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// All references inside jest.mock factories must use jest globals only
// (no const/let from this file due to TDZ from hoisting).
// We store mock fns on the module mock itself and retrieve them after import.
jest.mock('react-native-nitro-modules', () => {
  const liveActivityMod = {
    startActivity: jest.fn(),
    updateActivity: jest.fn(),
    endActivity: jest.fn(),
    getRunningActivities: jest.fn(),
  };
  const iosIntentsMod = {
    setLiveActivityButtonCallback: jest.fn(),
    setShortcutCallback: jest.fn(),
    getSharedString: jest.fn(),
    setSharedString: jest.fn(),
    getSharedNumber: jest.fn(),
    setSharedNumber: jest.fn(),
  };
  return {
    NitroModules: {
      createHybridObject: jest.fn((name: string) => {
        if (name === 'LiveActivityModule') return liveActivityMod;
        if (name === 'IosIntents') return iosIntentsMod;
        return liveActivityMod;
      }),
    },
    __mockLiveActivityModule: liveActivityMod,
    __mockIosIntentsModule: iosIntentsMod,
  };
});

import { LiveActivitiesManager } from '../LiveActivitiesManager';

// Retrieve the mock functions from the mocked module
const { __mockLiveActivityModule: mockModule, __mockIosIntentsModule: mockIosIntents } = jest.requireMock<{
  __mockLiveActivityModule: {
    startActivity: jest.Mock;
    updateActivity: jest.Mock;
    endActivity: jest.Mock;
    getRunningActivities: jest.Mock;
  };
  __mockIosIntentsModule: {
    setLiveActivityButtonCallback: jest.Mock;
  };
}>('react-native-nitro-modules');

describe('LiveActivitiesManager', () => {
  let manager: LiveActivitiesManager;

  beforeEach(() => {
    mockModule.startActivity.mockReset();
    mockModule.updateActivity.mockReset();
    mockModule.endActivity.mockReset();
    mockModule.getRunningActivities.mockReset();
    manager = new LiveActivitiesManager();
  });

  describe('startActivity', () => {
    it('should call native startActivity with correct data', () => {
      mockModule.startActivity.mockReturnValue('activity-123');

      const result = manager.startActivity(
        'timerActivity',
        { taskName: 'Work' },
        { elapsedSeconds: 0, isRunning: true }
      );

      expect(result).toBe('activity-123');
      expect(mockModule.startActivity).toHaveBeenCalledWith({
        activityType: 'timerActivity',
        attributes: { taskName: 'Work' },
        contentState: { elapsedSeconds: 0, isRunning: true },
      });
    });

    it('should return null on failure', () => {
      mockModule.startActivity.mockReturnValue(null);

      const result = manager.startActivity(
        'timerActivity',
        { taskName: 'Work' },
        { elapsedSeconds: 0 }
      );

      expect(result).toBeNull();
    });

    it('should filter out null and undefined values', () => {
      mockModule.startActivity.mockReturnValue('activity-123');

      manager.startActivity(
        'timerActivity',
        { taskName: 'Work', extra: null, missing: undefined },
        { elapsedSeconds: 0 }
      );

      expect(mockModule.startActivity).toHaveBeenCalledWith({
        activityType: 'timerActivity',
        attributes: { taskName: 'Work' },
        contentState: { elapsedSeconds: 0 },
      });
    });

    it('should convert Date values to timestamps', () => {
      mockModule.startActivity.mockReturnValue('activity-123');
      const date = new Date('2025-01-01T00:00:00Z');

      manager.startActivity(
        'timerActivity',
        { taskName: 'Work' },
        { deadline: date }
      );

      expect(mockModule.startActivity).toHaveBeenCalledWith({
        activityType: 'timerActivity',
        attributes: { taskName: 'Work' },
        contentState: { deadline: date.getTime() / 1000 },
      });
    });

    it('should throw on native error', () => {
      mockModule.startActivity.mockImplementation(() => {
        throw new Error('Native error');
      });

      expect(() =>
        manager.startActivity(
          'timerActivity',
          { taskName: 'Work' },
          { elapsedSeconds: 0 }
        )
      ).toThrow('Native error');
    });

    it('should pass staleDate as timestamp', () => {
      mockModule.startActivity.mockReturnValue('activity-123');
      const staleDate = new Date('2025-06-01T12:00:00Z');

      manager.startActivity(
        'timerActivity',
        { taskName: 'Work' },
        { elapsedSeconds: 0 },
        staleDate
      );

      expect(mockModule.startActivity).toHaveBeenCalledWith({
        activityType: 'timerActivity',
        attributes: { taskName: 'Work' },
        contentState: { elapsedSeconds: 0 },
        staleDateTimestamp: staleDate.getTime() / 1000,
      });
    });

    it('should pass undefined staleDateTimestamp when no staleDate', () => {
      mockModule.startActivity.mockReturnValue('activity-123');

      manager.startActivity(
        'timerActivity',
        { taskName: 'Work' },
        { elapsedSeconds: 0 }
      );

      expect(mockModule.startActivity).toHaveBeenCalledWith({
        activityType: 'timerActivity',
        attributes: { taskName: 'Work' },
        contentState: { elapsedSeconds: 0 },
        staleDateTimestamp: undefined,
      });
    });
  });

  describe('updateActivity', () => {
    it('should call native updateActivity with correct data', () => {
      mockModule.updateActivity.mockReturnValue(true);

      const result = manager.updateActivity('activity-123', 'timerActivity', {
        elapsedSeconds: 60,
        isRunning: true,
      });

      expect(result).toBe(true);
      expect(mockModule.updateActivity).toHaveBeenCalledWith(
        'timerActivity',
        'activity-123',
        { elapsedSeconds: 60, isRunning: true },
        undefined
      );
    });

    it('should return false on failure', () => {
      mockModule.updateActivity.mockReturnValue(false);

      const result = manager.updateActivity('activity-123', 'timerActivity', {
        elapsedSeconds: 0,
      });

      expect(result).toBe(false);
    });

    it('should throw on native error', () => {
      mockModule.updateActivity.mockImplementation(() => {
        throw new Error('Native error');
      });

      expect(() =>
        manager.updateActivity('activity-123', 'timerActivity', {
          elapsedSeconds: 0,
        })
      ).toThrow('Native error');
    });

    it('should pass staleDate as timestamp to updateActivity', () => {
      mockModule.updateActivity.mockReturnValue(true);
      const staleDate = new Date('2025-06-01T12:00:00Z');

      manager.updateActivity('activity-123', 'timerActivity', {
        elapsedSeconds: 60,
      }, staleDate);

      expect(mockModule.updateActivity).toHaveBeenCalledWith(
        'timerActivity',
        'activity-123',
        { elapsedSeconds: 60 },
        staleDate.getTime() / 1000
      );
    });

    it('should pass undefined staleDateTimestamp when no staleDate on update', () => {
      mockModule.updateActivity.mockReturnValue(true);

      manager.updateActivity('activity-123', 'timerActivity', {
        elapsedSeconds: 60,
      });

      expect(mockModule.updateActivity).toHaveBeenCalledWith(
        'timerActivity',
        'activity-123',
        { elapsedSeconds: 60 },
        undefined
      );
    });
  });

  describe('endActivity', () => {
    it('should call native endActivity with correct params', () => {
      mockModule.endActivity.mockReturnValue(true);

      const result = manager.endActivity('activity-123', 'timerActivity');

      expect(result).toBe(true);
      expect(mockModule.endActivity).toHaveBeenCalledWith(
        'timerActivity',
        'activity-123'
      );
    });

    it('should return false on failure', () => {
      mockModule.endActivity.mockReturnValue(false);

      const result = manager.endActivity('activity-123', 'timerActivity');

      expect(result).toBe(false);
    });

    it('should throw on native error', () => {
      mockModule.endActivity.mockImplementation(() => {
        throw new Error('Native error');
      });

      expect(() =>
        manager.endActivity('activity-123', 'timerActivity')
      ).toThrow('Native error');
    });
  });

  describe('getRunningActivities', () => {
    it('should return empty array when no activities are running', () => {
      mockModule.getRunningActivities.mockReturnValue([]);

      const result = manager.getRunningActivities();

      expect(result).toEqual([]);
      expect(mockModule.getRunningActivities).toHaveBeenCalledTimes(1);
    });

    it('should return activities from native', () => {
      const activities = [
        { activityId: 'act-1', activityType: 'timerActivity' },
        { activityId: 'act-2', activityType: 'deliveryActivity' },
      ];
      mockModule.getRunningActivities.mockReturnValue(activities);

      const result = manager.getRunningActivities();

      expect(result).toEqual(activities);
    });

    it('should throw on native error', () => {
      mockModule.getRunningActivities.mockImplementation(() => {
        throw new Error('Native error');
      });

      expect(() => manager.getRunningActivities()).toThrow('Native error');
    });
  });

  describe('convertData warnings', () => {
    it('should warn and skip unsupported value types', () => {
      const { logger: mockLogger } = jest.requireMock<{ logger: { warn: jest.Mock } }>('../Logger');
      mockLogger.warn.mockClear();
      mockModule.startActivity.mockReturnValue('activity-123');

      manager.startActivity(
        'timerActivity',
        { taskName: 'Work', nested: { foo: 'bar' } as any },
        { elapsedSeconds: 0 }
      );

      // nested object should be skipped
      expect(mockModule.startActivity).toHaveBeenCalledWith({
        activityType: 'timerActivity',
        attributes: { taskName: 'Work' },
        contentState: { elapsedSeconds: 0 },
        staleDateTimestamp: undefined,
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('nested')
      );
    });
  });

  describe('addEventListener', () => {
    beforeEach(() => {
      mockIosIntents.setLiveActivityButtonCallback.mockReset();
    });

    it('should register native callback on first listener', () => {
      const listener = jest.fn();
      manager.addEventListener('button', listener);

      expect(mockIosIntents.setLiveActivityButtonCallback).toHaveBeenCalledTimes(1);
    });

    it('should not register native callback again for subsequent listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      manager.addEventListener('button', listener1);
      manager.addEventListener('button', listener2);

      expect(mockIosIntents.setLiveActivityButtonCallback).toHaveBeenCalledTimes(1);
    });

    it('should invoke listener when native callback fires', () => {
      const listener = jest.fn();
      manager.addEventListener('button', listener);

      // Get the callback that was passed to native
      const nativeCallback = mockIosIntents.setLiveActivityButtonCallback.mock.calls[0][0];
      nativeCallback({ identifier: 'pauseTimer', nonce: 'abc-123' });

      expect(listener).toHaveBeenCalledWith({
        identifier: 'pauseTimer',
        nonce: 'abc-123',
      });
    });

    it('should invoke all listeners when native callback fires', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      manager.addEventListener('button', listener1);
      manager.addEventListener('button', listener2);

      const nativeCallback = mockIosIntents.setLiveActivityButtonCallback.mock.calls[0][0];
      nativeCallback({ identifier: 'resumeTimer', nonce: 'def-456' });

      expect(listener1).toHaveBeenCalledWith({
        identifier: 'resumeTimer',
        nonce: 'def-456',
      });
      expect(listener2).toHaveBeenCalledWith({
        identifier: 'resumeTimer',
        nonce: 'def-456',
      });
    });

    it('should remove listener when subscription.remove() is called', () => {
      const listener = jest.fn();
      const sub = manager.addEventListener('button', listener);

      sub.remove();

      // Fire native callback — listener should NOT be called
      const nativeCallback = mockIosIntents.setLiveActivityButtonCallback.mock.calls[0][0];
      nativeCallback({ identifier: 'pauseTimer', nonce: 'abc-123' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should re-register native callback after all listeners removed and new one added', () => {
      const listener1 = jest.fn();
      const sub = manager.addEventListener('button', listener1);
      sub.remove();

      // Should re-register
      const listener2 = jest.fn();
      manager.addEventListener('button', listener2);

      expect(mockIosIntents.setLiveActivityButtonCallback).toHaveBeenCalledTimes(2);
    });

    it('should not throw when listener throws', () => {
      const errorListener = jest.fn(() => { throw new Error('listener error'); });
      const goodListener = jest.fn();
      manager.addEventListener('button', errorListener);
      manager.addEventListener('button', goodListener);

      const nativeCallback = mockIosIntents.setLiveActivityButtonCallback.mock.calls[0][0];

      expect(() => {
        nativeCallback({ identifier: 'pauseTimer', nonce: 'abc-123' });
      }).not.toThrow();

      // Good listener should still be called despite error in first
      expect(goodListener).toHaveBeenCalled();
    });

    it('should return subscription with remove method', () => {
      const listener = jest.fn();
      const sub = manager.addEventListener('button', listener);

      expect(sub).toHaveProperty('remove');
      expect(typeof sub.remove).toBe('function');
    });
  });
});
