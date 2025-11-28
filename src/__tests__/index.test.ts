import { Platform } from 'react-native';
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

describe('SiriShortcuts API', () => {
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

  describe('addEventListener', () => {
    it('should register a listener and return subscription', () => {
      const listener = jest.fn();
      const subscription = SiriShortcuts.addEventListener('shortcut', listener);

      expect(subscription).toHaveProperty('remove');
      expect(typeof subscription.remove).toBe('function');
      expect(logger.debug).toHaveBeenCalledWith('Added listener for shortcut');
    });

    it('should register native callback on first listener', () => {
      const listener = jest.fn();

      expect(mockSetShortcutCallback).not.toHaveBeenCalled();

      SiriShortcuts.addEventListener('shortcut', listener);

      expect(mockSetShortcutCallback).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Registering native callback for Darwin notifications...');
      expect(logger.info).toHaveBeenCalledWith('Native callback registered successfully');
    });

    it('should not register native callback multiple times', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      SiriShortcuts.addEventListener('shortcut', listener1);
      SiriShortcuts.addEventListener('shortcut', listener2);

      // Should only be called once
      expect(mockSetShortcutCallback).toHaveBeenCalledTimes(1);
    });

    it('should allow multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      SiriShortcuts.addEventListener('shortcut', listener1);
      SiriShortcuts.addEventListener('shortcut', listener2);
      SiriShortcuts.addEventListener('shortcut', listener3);

      expect(logger.debug).toHaveBeenCalledTimes(3);
    });
  });

  describe('removeListener via subscription', () => {
    it('should remove specific listener', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const sub1 = SiriShortcuts.addEventListener('shortcut', listener1);
      SiriShortcuts.addEventListener('shortcut', listener2);

      // Simulate shortcut invocation
      const nativeData: NativeShortcutData = {
        identifier: 'test',
        nonce: 'test-nonce',
      };
      nativeCallback?.(nativeData);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      // Remove first listener
      sub1.remove();
      expect(logger.debug).toHaveBeenCalledWith('Removed listener for shortcut');

      // Invoke again
      jest.clearAllMocks();
      nativeCallback?.(nativeData);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle removing the same listener multiple times', () => {
      const listener = jest.fn();
      const subscription = SiriShortcuts.addEventListener('shortcut', listener);

      subscription.remove();
      expect(() => subscription.remove()).not.toThrow();

      expect(logger.debug).toHaveBeenCalledWith('Removed listener for shortcut');
    });
  });
});
