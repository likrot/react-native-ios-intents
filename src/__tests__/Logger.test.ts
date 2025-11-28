import { Logger, logger, type LoggerTransport } from '../Logger';

describe('Logger', () => {
  // Store original console methods
  const originalConsole = {
    debug: console.debug,
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  // Mock console methods
  let mockConsole: {
    debug: jest.Mock;
    log: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(() => {
    // Create fresh mocks for each test
    mockConsole = {
      debug: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Replace console methods with mocks
    console.debug = mockConsole.debug;
    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    // Reset logger state
    logger.setEnabled(true);
    logger.setPrefix('[IosIntents]');
    logger.setTransport(null as any); // Reset to default console transport
  });

  afterEach(() => {
    // Restore original console methods
    console.debug = originalConsole.debug;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export a pre-configured singleton', () => {
      expect(logger).toBeInstanceOf(Logger);
      expect(logger).toBe(Logger.getInstance());
    });
  });

  describe('Default Console Logging', () => {
    it('should log debug messages with prefix', () => {
      logger.debug('test message');
      expect(mockConsole.debug).toHaveBeenCalledWith('[IosIntents] test message');
    });

    it('should log info messages with prefix', () => {
      logger.info('test message');
      expect(mockConsole.log).toHaveBeenCalledWith('[IosIntents] test message');
    });

    it('should log warn messages with prefix', () => {
      logger.warn('test message');
      expect(mockConsole.warn).toHaveBeenCalledWith('[IosIntents] test message');
    });

    it('should log error messages with prefix', () => {
      logger.error('test message');
      expect(mockConsole.error).toHaveBeenCalledWith('[IosIntents] test message');
    });

    it('should pass additional arguments to console', () => {
      const obj = { foo: 'bar' };
      const arr = [1, 2, 3];
      
      logger.info('test', obj, arr);
      expect(mockConsole.log).toHaveBeenCalledWith('[IosIntents] test', obj, arr);
    });
  });

  describe('Enable/Disable Logging', () => {
    it('should not log when disabled', () => {
      logger.setEnabled(false);
      
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');
      
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
    });

    it('should log when re-enabled', () => {
      logger.setEnabled(false);
      logger.info('should not log');
      expect(mockConsole.log).not.toHaveBeenCalled();
      
      logger.setEnabled(true);
      logger.info('should log');
      expect(mockConsole.log).toHaveBeenCalledWith('[IosIntents] should log');
    });

    it('should return enabled state', () => {
      expect(logger.isEnabled()).toBe(true);
      
      logger.setEnabled(false);
      expect(logger.isEnabled()).toBe(false);
      
      logger.setEnabled(true);
      expect(logger.isEnabled()).toBe(true);
    });
  });

  describe('Custom Prefix', () => {
    it('should use custom prefix', () => {
      logger.setPrefix('[CustomApp]');
      logger.info('test message');
      
      expect(mockConsole.log).toHaveBeenCalledWith('[CustomApp] test message');
    });

    it('should handle empty prefix', () => {
      logger.setPrefix('');
      logger.info('test message');
      
      expect(mockConsole.log).toHaveBeenCalledWith(' test message');
    });

    it('should apply prefix to all log levels', () => {
      logger.setPrefix('[Test]');
      
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');
      
      expect(mockConsole.debug).toHaveBeenCalledWith('[Test] debug');
      expect(mockConsole.log).toHaveBeenCalledWith('[Test] info');
      expect(mockConsole.warn).toHaveBeenCalledWith('[Test] warn');
      expect(mockConsole.error).toHaveBeenCalledWith('[Test] error');
    });
  });

  describe('Custom Transport', () => {
    it('should use custom transport', () => {
      const mockTransport: LoggerTransport = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      
      logger.setTransport(mockTransport);
      
      logger.debug('debug', 1);
      logger.info('info', 2);
      logger.warn('warn', 3);
      logger.error('error', 4);
      
      expect(mockTransport.debug).toHaveBeenCalledWith('[IosIntents] debug', 1);
      expect(mockTransport.info).toHaveBeenCalledWith('[IosIntents] info', 2);
      expect(mockTransport.warn).toHaveBeenCalledWith('[IosIntents] warn', 3);
      expect(mockTransport.error).toHaveBeenCalledWith('[IosIntents] error', 4);
      
      // Console should not be called
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
    });

    it('should respect enabled state with custom transport', () => {
      const mockTransport: LoggerTransport = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      
      logger.setTransport(mockTransport);
      logger.setEnabled(false);
      
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');
      
      expect(mockTransport.debug).not.toHaveBeenCalled();
      expect(mockTransport.info).not.toHaveBeenCalled();
      expect(mockTransport.warn).not.toHaveBeenCalled();
      expect(mockTransport.error).not.toHaveBeenCalled();
    });

    it('should apply prefix with custom transport', () => {
      const mockTransport: LoggerTransport = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      
      logger.setPrefix('[CustomPrefix]');
      logger.setTransport(mockTransport);
      
      logger.info('test');
      
      expect(mockTransport.info).toHaveBeenCalledWith('[CustomPrefix] test');
    });
  });

  describe('Multiple Arguments', () => {
    it('should handle multiple string arguments', () => {
      logger.info('message', 'arg1', 'arg2', 'arg3');
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[IosIntents] message',
        'arg1',
        'arg2',
        'arg3'
      );
    });

    it('should handle mixed type arguments', () => {
      const obj = { key: 'value' };
      const num = 42;
      const bool = true;
      
      logger.warn('mixed types:', obj, num, bool);
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[IosIntents] mixed types:',
        obj,
        num,
        bool
      );
    });

    it('should handle error objects', () => {
      const error = new Error('Test error');
      logger.error('An error occurred:', error);
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[IosIntents] An error occurred:',
        error
      );
    });
  });

  describe('Integration Tests', () => {
    it('should maintain state across multiple operations', () => {
      logger.setPrefix('[App]');
      logger.setEnabled(true);
      
      logger.info('first');
      expect(mockConsole.log).toHaveBeenCalledWith('[App] first');
      
      logger.setEnabled(false);
      logger.info('second');
      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      
      logger.setEnabled(true);
      logger.info('third');
      expect(mockConsole.log).toHaveBeenCalledWith('[App] third');
      expect(mockConsole.log).toHaveBeenCalledTimes(2);
    });

    it('should work with custom transport and all configuration', () => {
      const mockTransport: LoggerTransport = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      
      logger.setPrefix('[CustomApp]');
      logger.setTransport(mockTransport);
      logger.setEnabled(true);
      
      logger.info('configured message', { data: 'test' });
      
      expect(mockTransport.info).toHaveBeenCalledWith(
        '[CustomApp] configured message',
        { data: 'test' }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty messages', () => {
      logger.info('');
      expect(mockConsole.log).toHaveBeenCalledWith('[IosIntents] ');
    });

    it('should handle undefined and null in arguments', () => {
      logger.info('message', undefined, null);
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[IosIntents] message',
        undefined,
        null
      );
    });

    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(10000);
      logger.info(longMessage);
      expect(mockConsole.log).toHaveBeenCalledWith(`[IosIntents] ${longMessage}`);
    });

    it('should handle special characters in messages', () => {
      logger.info('Special: 🚀 \n \t " \' \\');
      expect(mockConsole.log).toHaveBeenCalledWith('[IosIntents] Special: 🚀 \n \t " \' \\');
    });
  });
});
