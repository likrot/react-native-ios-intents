import { Platform } from 'react-native';
import type { ShortcutInvocation } from '../types';
import type { NativeShortcutData } from '../IosIntents.nitro';

// Mock dependencies BEFORE any imports that use them
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('../Logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock NitroModules with inline mock
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => ({
      setShortcutCallback: jest.fn(),
      setSharedNumber: jest.fn(),
      setSharedString: jest.fn(),
    })),
  },
}));

// Import after mocks are set up
import { SiriShortcuts } from '../index';
import { logger } from '../Logger';
import { NitroModules } from 'react-native-nitro-modules';

// Get reference to the mocked methods
const mockCreateHybridObject = NitroModules.createHybridObject as jest.Mock;
const mockNitroModule = mockCreateHybridObject.mock.results[0]?.value;
const mockSetShortcutCallback = mockNitroModule?.setShortcutCallback as jest.Mock;
const mockSetSharedNumber = mockNitroModule?.setSharedNumber as jest.Mock;
const mockSetSharedString = mockNitroModule?.setSharedString as jest.Mock;

describe('SiriShortcutsManager', () => {
  let nativeCallback: ((data: NativeShortcutData) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    nativeCallback = null;

    // Ensure we're on iOS
    (Platform as any).OS = 'ios';

    // Capture the native callback when it's registered
    mockSetShortcutCallback.mockImplementation((callback) => {
      nativeCallback = callback;
    });

    // Clean up listeners
    SiriShortcuts.cleanup();
  });

  describe('cleanup', () => {
    it('should remove all listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      SiriShortcuts.addEventListener('shortcut', listener1);
      SiriShortcuts.addEventListener('shortcut', listener2);

      SiriShortcuts.cleanup();

      expect(logger.info).toHaveBeenCalledWith('Shortcuts cleanup completed');

      // Invoke shortcut - no listeners should be called
      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'test-nonce',
      };
      nativeCallback?.(nativeData);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('should reset native callback registration state', () => {
      const listener = jest.fn();

      SiriShortcuts.addEventListener('shortcut', listener);
      expect(mockSetShortcutCallback).toHaveBeenCalledTimes(1);

      SiriShortcuts.cleanup();

      // Add listener again - should re-register native callback
      SiriShortcuts.addEventListener('shortcut', listener);
      expect(mockSetShortcutCallback).toHaveBeenCalledTimes(2);
    });

    it('should clear specified app state keys', () => {
      SiriShortcuts.cleanup(['timerRunning', 'taskName']);

      expect(mockSetSharedString).toHaveBeenCalledWith('appState_timerRunning', null);
      expect(mockSetSharedString).toHaveBeenCalledWith('appState_taskName', null);
    });

    it('should clear all tracked state keys when none specified', () => {
      // First set some state to track the keys
      SiriShortcuts.updateAppState({ timerRunning: true, taskName: 'Work' });
      jest.clearAllMocks();

      // Cleanup without args should clear all tracked keys
      SiriShortcuts.cleanup();

      expect(mockSetSharedString).toHaveBeenCalledWith('appState_timerRunning', null);
      expect(mockSetSharedString).toHaveBeenCalledWith('appState_taskName', null);
    });

    it('should not clear state if no keys were tracked', () => {
      SiriShortcuts.cleanup();

      expect(mockSetSharedString).not.toHaveBeenCalled();
    });

    it('should not clear state keys if empty array provided', () => {
      SiriShortcuts.cleanup([]);

      expect(mockSetSharedString).not.toHaveBeenCalled();
    });

    it('should clear tracked keys set after cleanup', () => {
      // Set state, cleanup, set new state
      SiriShortcuts.updateAppState({ oldKey: 'value' });
      SiriShortcuts.cleanup();
      SiriShortcuts.updateAppState({ newKey: 'value' });
      jest.clearAllMocks();

      // Should only clear newKey
      SiriShortcuts.cleanup();

      expect(mockSetSharedString).toHaveBeenCalledWith('appState_newKey', null);
      expect(mockSetSharedString).not.toHaveBeenCalledWith('appState_oldKey', null);
    });
  });

  describe('subscription remove', () => {
    it('should reset native callback when last listener is removed', () => {
      const listener = jest.fn();

      const subscription = SiriShortcuts.addEventListener('shortcut', listener);
      expect(mockSetShortcutCallback).toHaveBeenCalledTimes(1);

      subscription.remove();

      // Add listener again - should re-register native callback
      SiriShortcuts.addEventListener('shortcut', listener);
      expect(mockSetShortcutCallback).toHaveBeenCalledTimes(2);
    });

    it('should not reset native callback when other listeners remain', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const sub1 = SiriShortcuts.addEventListener('shortcut', listener1);
      SiriShortcuts.addEventListener('shortcut', listener2);
      expect(mockSetShortcutCallback).toHaveBeenCalledTimes(1);

      sub1.remove();

      // Add another listener - should NOT re-register (still has listener2)
      SiriShortcuts.addEventListener('shortcut', jest.fn());
      expect(mockSetShortcutCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Shortcut Invocation', () => {
    it('should call listener when shortcut is invoked', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'startTimer',
        nonce: 'test-nonce',
      };

      nativeCallback?.(nativeData);

      // Listener receives ShortcutInvocation with empty parameters (until parameters feature is implemented)
      const expectedShortcut: ShortcutInvocation = {
        identifier: 'startTimer',
        nonce: 'test-nonce',
        parameters: {},
      };
      expect(listener).toHaveBeenCalledWith(expectedShortcut, expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith('Shortcut invoked:', 'startTimer');
    });

    it('should call all registered listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      SiriShortcuts.addEventListener('shortcut', listener1);
      SiriShortcuts.addEventListener('shortcut', listener2);
      SiriShortcuts.addEventListener('shortcut', listener3);

      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'test-nonce',
      };

      nativeCallback?.(nativeData);

      const expectedShortcut: ShortcutInvocation = {
        identifier: 'test',
        nonce: 'test-nonce',
        parameters: {},
      };
      expect(listener1).toHaveBeenCalledWith(expectedShortcut, expect.any(Function));
      expect(listener2).toHaveBeenCalledWith(expectedShortcut, expect.any(Function));
      expect(listener3).toHaveBeenCalledWith(expectedShortcut, expect.any(Function));
    });

    it('should handle shortcuts with identifier and nonce', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'simpleAction',
        nonce: 'test-nonce',
      };

      nativeCallback?.(nativeData);

      const expectedShortcut: ShortcutInvocation = {
        identifier: 'simpleAction',
        nonce: 'test-nonce',
        parameters: {},
      };
      expect(listener).toHaveBeenCalledWith(expectedShortcut, expect.any(Function));
    });

    it('should log warning if no listeners are registered', () => {
      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'test-nonce',
      };

      // Don't add any listeners, but trigger the native callback directly
      // First we need to register it
      SiriShortcuts.addEventListener('shortcut', jest.fn());
      SiriShortcuts.cleanup();

      // Re-register to get callback but remove listeners
      const listener = jest.fn();
      const sub = SiriShortcuts.addEventListener('shortcut', listener);
      sub.remove();

      jest.clearAllMocks();
      nativeCallback?.(nativeData);

      expect(logger.warn).toHaveBeenCalledWith('Shortcut invoked but no listeners registered');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in listener callback', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();

      SiriShortcuts.addEventListener('shortcut', errorListener);
      SiriShortcuts.addEventListener('shortcut', goodListener);

      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'test-nonce',
      };

      nativeCallback?.(nativeData);

      // Both should be called
      expect(errorListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();

      // Error should be logged
      expect(logger.error).toHaveBeenCalledWith(
        'Error in listener:',
        expect.any(Error)
      );
    });

    it('should continue processing other listeners after error', () => {
      const listener1 = jest.fn(() => {
        throw new Error('Error 1');
      });
      const listener2 = jest.fn();
      const listener3 = jest.fn(() => {
        throw new Error('Error 3');
      });
      const listener4 = jest.fn();

      SiriShortcuts.addEventListener('shortcut', listener1);
      SiriShortcuts.addEventListener('shortcut', listener2);
      SiriShortcuts.addEventListener('shortcut', listener3);
      SiriShortcuts.addEventListener('shortcut', listener4);

      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'test-nonce',
      };

      nativeCallback?.(nativeData);

      // All should be called despite errors
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
      expect(listener4).toHaveBeenCalled();
    });
  });

  describe('Platform Behavior', () => {
    it('should not register native callback on non-iOS platforms', () => {
      // Reset module
      jest.clearAllMocks();
      SiriShortcuts.cleanup();

      // Change platform
      (Platform as any).OS = 'android';

      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      // On Android, native callback should not be registered
      expect(mockSetShortcutCallback).not.toHaveBeenCalled();
    });

    it('should not call module methods when platform is not iOS', () => {
      (Platform as any).OS = 'android';

      SiriShortcuts.updateAppState({ test: true });

      expect(mockSetSharedNumber).not.toHaveBeenCalled();
      expect(mockSetSharedString).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid listener additions and removals', () => {
      const listeners = Array.from({ length: 10 }, () => jest.fn());
      const subscriptions = listeners.map((listener) =>
        SiriShortcuts.addEventListener('shortcut', listener)
      );

      // Remove every other listener
      subscriptions.forEach((sub, i) => {
        if (i % 2 === 0) {
          sub.remove();
        }
      });

      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'test-nonce',
      };

      nativeCallback?.(nativeData);

      const expectedShortcut: ShortcutInvocation = {
        identifier: 'test',
        nonce: 'test-nonce',
        parameters: {},
      };
      // Only odd-indexed listeners should be called
      listeners.forEach((listener, i) => {
        if (i % 2 === 0) {
          expect(listener).not.toHaveBeenCalled();
        } else {
          expect(listener).toHaveBeenCalledWith(expectedShortcut, expect.any(Function));
        }
      });
    });

    it('should handle same listener added multiple times', () => {
      const listener = jest.fn();

      SiriShortcuts.addEventListener('shortcut', listener);
      SiriShortcuts.addEventListener('shortcut', listener);
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'test-nonce',
      };

      nativeCallback?.(nativeData);

      // Since we use a Set, it should only be added once
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should handle empty identifier', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: '',
        nonce: 'test-nonce',
      };

      nativeCallback?.(nativeData);

      const expectedShortcut: ShortcutInvocation = {
        identifier: '',
        nonce: 'test-nonce',
        parameters: {},
      };
      expect(listener).toHaveBeenCalledWith(expectedShortcut, expect.any(Function));
    });
  });

  describe('Memory Leaks Prevention', () => {
    it('should clean up listeners on cleanup', () => {
      const listeners = Array.from({ length: 100 }, () => jest.fn());

      listeners.forEach((listener) => {
        SiriShortcuts.addEventListener('shortcut', listener);
      });

      SiriShortcuts.cleanup();

      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'test-nonce',
      };

      nativeCallback?.(nativeData);

      // No listeners should be called
      listeners.forEach((listener) => {
        expect(listener).not.toHaveBeenCalled();
      });
    });

    it('should clean up individual listeners via subscription', () => {
      const listeners = Array.from({ length: 10 }, () => jest.fn());
      const subscriptions = listeners.map((listener) =>
        SiriShortcuts.addEventListener('shortcut', listener)
      );

      // Remove all subscriptions
      subscriptions.forEach((sub) => sub.remove());

      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'test-nonce',
      };

      nativeCallback?.(nativeData);

      // No listeners should be called
      listeners.forEach((listener) => {
        expect(listener).not.toHaveBeenCalled();
      });
    });
  });

  describe('updateAppState', () => {
    it('should store boolean true as number 1', () => {
      SiriShortcuts.updateAppState({ timerRunning: true });

      expect(mockSetSharedNumber).toHaveBeenCalledWith('appState_timerRunning', 1);
      expect(logger.info).toHaveBeenCalledWith('App state updated successfully');
    });

    it('should store boolean false as number 0', () => {
      SiriShortcuts.updateAppState({ timerRunning: false });

      expect(mockSetSharedNumber).toHaveBeenCalledWith('appState_timerRunning', 0);
    });

    it('should store number values directly', () => {
      SiriShortcuts.updateAppState({ count: 42, elapsed: 3.14 });

      expect(mockSetSharedNumber).toHaveBeenCalledWith('appState_count', 42);
      expect(mockSetSharedNumber).toHaveBeenCalledWith('appState_elapsed', 3.14);
    });

    it('should store string values directly', () => {
      SiriShortcuts.updateAppState({ taskName: 'Work', status: 'active' });

      expect(mockSetSharedString).toHaveBeenCalledWith('appState_taskName', 'Work');
      expect(mockSetSharedString).toHaveBeenCalledWith('appState_status', 'active');
    });

    it('should clear keys with null values', () => {
      SiriShortcuts.updateAppState({ taskName: null });

      expect(mockSetSharedString).toHaveBeenCalledWith('appState_taskName', null);
    });

    it('should clear keys with undefined values', () => {
      SiriShortcuts.updateAppState({ taskName: undefined });

      expect(mockSetSharedString).toHaveBeenCalledWith('appState_taskName', null);
    });

    it('should serialize complex objects as JSON', () => {
      const complexValue = { nested: { value: 42 }, array: [1, 2, 3] };
      SiriShortcuts.updateAppState({ data: complexValue });

      expect(mockSetSharedString).toHaveBeenCalledWith(
        'appState_data',
        JSON.stringify(complexValue)
      );
    });

    it('should handle multiple values at once', () => {
      SiriShortcuts.updateAppState({
        timerRunning: true,
        taskName: 'Work',
        count: 5,
      });

      expect(mockSetSharedNumber).toHaveBeenCalledWith('appState_timerRunning', 1);
      expect(mockSetSharedString).toHaveBeenCalledWith('appState_taskName', 'Work');
      expect(mockSetSharedNumber).toHaveBeenCalledWith('appState_count', 5);
    });

    it('should warn on non-iOS platform', () => {
      (Platform as any).OS = 'android';

      SiriShortcuts.updateAppState({ test: true });

      expect(logger.warn).toHaveBeenCalledWith('updateAppState: Not available on this platform');
      expect(mockSetSharedNumber).not.toHaveBeenCalled();
    });

    it('should log error on serialization failure', () => {
      // Create circular reference that can't be serialized
      const circular: any = { prop: 'value' };
      circular.self = circular;

      SiriShortcuts.updateAppState({ data: circular });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot serialize value for key "data"'),
        expect.any(Error)
      );
    });
  });

  describe('respond callback', () => {
    it('should write response to shared storage', () => {
      const listener = jest.fn((_, respond) => {
        respond({ message: 'Timer started!' });
      });

      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'startTimer',
        nonce: 'test-nonce-123',
      };

      nativeCallback?.(nativeData);

      expect(mockSetSharedString).toHaveBeenCalledWith(
        'IosIntentsResponse_test-nonce-123',
        'Timer started!'
      );
      expect(logger.info).toHaveBeenCalledWith('Response sent successfully');
    });

    it('should send empty string for silent response', () => {
      const listener = jest.fn((_, respond) => {
        respond({});
      });

      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'startTimer',
        nonce: 'silent-nonce',
      };

      nativeCallback?.(nativeData);

      expect(mockSetSharedString).toHaveBeenCalledWith(
        'IosIntentsResponse_silent-nonce',
        ''
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Sending response for',
        'silent-nonce',
        ':',
        '(silent)'
      );
    });

    it('should handle undefined message as silent', () => {
      const listener = jest.fn((_, respond) => {
        respond({ message: undefined });
      });

      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'undefined-nonce',
      };

      nativeCallback?.(nativeData);

      expect(mockSetSharedString).toHaveBeenCalledWith(
        'IosIntentsResponse_undefined-nonce',
        ''
      );
    });

    it('should use correct nonce for each invocation', () => {
      const listener = jest.fn((shortcut, respond) => {
        respond({ message: `Response for ${shortcut.nonce}` });
      });

      SiriShortcuts.addEventListener('shortcut', listener);

      // First invocation
      nativeCallback?.({
        identifier: 'test',
        nonce: 'nonce-1',
      });

      // Second invocation
      nativeCallback?.({
        identifier: 'test',
        nonce: 'nonce-2',
      });

      expect(mockSetSharedString).toHaveBeenCalledWith(
        'IosIntentsResponse_nonce-1',
        'Response for nonce-1'
      );
      expect(mockSetSharedString).toHaveBeenCalledWith(
        'IosIntentsResponse_nonce-2',
        'Response for nonce-2'
      );
    });
  });

  describe('async listener handling', () => {
    it('should handle async listeners', async () => {
      const listener = jest.fn(async (_, respond) => {
        await Promise.resolve();
        respond({ message: 'Async done!' });
      });

      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'async-nonce',
      };

      nativeCallback?.(nativeData);

      // Wait for async listener to complete
      await Promise.resolve();

      expect(mockSetSharedString).toHaveBeenCalledWith(
        'IosIntentsResponse_async-nonce',
        'Async done!'
      );
    });

    it('should catch errors in async listeners', async () => {
      const listener = jest.fn(async () => {
        await Promise.resolve();
        throw new Error('Async error');
      });

      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'error-nonce',
      };

      nativeCallback?.(nativeData);

      // Wait for async listener to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(logger.error).toHaveBeenCalledWith(
        'Error in async listener:',
        expect.any(Error)
      );
    });

    it('should catch errors in sync listeners', () => {
      const listener = jest.fn(() => {
        throw new Error('Sync error');
      });

      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'sync-error-nonce',
      };

      // Should not throw
      expect(() => {
        nativeCallback?.(nativeData);
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Error in listener:',
        expect.any(Error)
      );
    });
  });

  describe('parameters support', () => {
    it('should pass string parameters from native to JS', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'addTask',
        nonce: 'param-nonce-1',
        parameters: { taskName: 'Buy groceries' },
      };

      nativeCallback?.(nativeData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'addTask',
          nonce: 'param-nonce-1',
          parameters: { taskName: 'Buy groceries' },
        }),
        expect.any(Function)
      );
    });

    it('should pass number parameters from native to JS', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'setTimer',
        nonce: 'param-nonce-2',
        parameters: { duration: 60 },
      };

      nativeCallback?.(nativeData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'setTimer',
          parameters: { duration: 60 },
        }),
        expect.any(Function)
      );
    });

    it('should pass boolean parameters from native to JS', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'toggleSetting',
        nonce: 'param-nonce-3',
        parameters: { enabled: true },
      };

      nativeCallback?.(nativeData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: { enabled: true },
        }),
        expect.any(Function)
      );
    });

    it('should pass Date parameters from native to JS', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const testDate = new Date('2025-12-31T15:30:00Z');
      const nativeData: NativeShortcutData = {
        identifier: 'scheduleTask',
        nonce: 'param-nonce-4',
        parameters: { dueDate: testDate },
      };

      nativeCallback?.(nativeData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: { dueDate: testDate },
        }),
        expect.any(Function)
      );
    });

    it('should pass multiple parameters of mixed types', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const testDate = new Date('2025-11-21T12:00:00Z');
      const nativeData: NativeShortcutData = {
        identifier: 'createEvent',
        nonce: 'param-nonce-5',
        parameters: {
          title: 'Team Meeting',
          duration: 60,
          important: true,
          startTime: testDate,
        },
      };

      nativeCallback?.(nativeData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: {
            title: 'Team Meeting',
            duration: 60,
            important: true,
            startTime: testDate,
          },
        }),
        expect.any(Function)
      );
    });

    it('should pass empty object when no parameters provided', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'simpleAction',
        nonce: 'param-nonce-6',
      };

      nativeCallback?.(nativeData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: {},
        }),
        expect.any(Function)
      );
    });

    it('should pass empty object when parameters is undefined', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'anotherAction',
        nonce: 'param-nonce-7',
        parameters: undefined,
      };

      nativeCallback?.(nativeData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: {},
        }),
        expect.any(Function)
      );
    });
  });

  describe('userConfirmed support', () => {
    it('should pass userConfirmed=true when user confirmed dialog', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'deleteAll',
        nonce: 'confirm-nonce-1',
        userConfirmed: true,
      };

      nativeCallback?.(nativeData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          userConfirmed: true,
        }),
        expect.any(Function)
      );
    });

    it('should pass userConfirmed=false when user cancelled dialog', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'stopTimer',
        nonce: 'confirm-nonce-2',
        userConfirmed: false,
      };

      nativeCallback?.(nativeData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          userConfirmed: false,
        }),
        expect.any(Function)
      );
    });

    it('should pass userConfirmed=undefined when no dialog shown', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'startTimer',
        nonce: 'confirm-nonce-3',
        userConfirmed: undefined,
      };

      nativeCallback?.(nativeData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          userConfirmed: undefined,
        }),
        expect.any(Function)
      );
    });

    it('should handle both parameters and userConfirmed together', () => {
      const listener = jest.fn();
      SiriShortcuts.addEventListener('shortcut', listener);

      const nativeData: NativeShortcutData = {
        identifier: 'deleteTask',
        nonce: 'combined-nonce',
        parameters: { taskId: '12345' },
        userConfirmed: true,
      };

      nativeCallback?.(nativeData);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'deleteTask',
          parameters: { taskId: '12345' },
          userConfirmed: true,
        }),
        expect.any(Function)
      );
    });
  });
});
