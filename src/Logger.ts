/**
 * Logger utility for react-native-ios-intents
 * Provides a centralized logging interface.
 */

const DEFAULT_PREFIX = '[IosIntents]';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerTransport {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

class Logger {
  private static instance: Logger;
  private transport: LoggerTransport | null = null;
  private enabled: boolean = true;
  private prefix: string = DEFAULT_PREFIX;

  private constructor() {
    // Transport is lazily initialized - defaults to console
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set a custom logging transport (e.g., Sentry, Firebase, custom logger)
   * @param transport Custom logger implementation
   */
  public setTransport(transport: LoggerTransport): void {
    this.transport = transport;
  }

  /**
   * Get the current transport or default to console
   */
  private getTransport(): LoggerTransport {
    return this.transport || {
      debug: console.debug,
      info: console.log,
      warn: console.warn,
      error: console.error,
    };
  }

  /**
   * Set custom prefix for all log messages
   * @param prefix Prefix string
   */
  public setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  /**
   * Enable or disable logging globally
   * @param enabled Whether logging is enabled
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if logging is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  private formatMessage(message: string): string {
    return `${this.prefix} ${message}`;
  }

  public debug(message: string, ...args: any[]): void {
    if (!this.enabled) return;
    this.getTransport().debug(this.formatMessage(message), ...args);
  }

  public info(message: string, ...args: any[]): void {
    if (!this.enabled) return;
    this.getTransport().info(this.formatMessage(message), ...args);
  }

  public warn(message: string, ...args: any[]): void {
    if (!this.enabled) return;
    this.getTransport().warn(this.formatMessage(message), ...args);
  }

  public error(message: string, ...args: any[]): void {
    if (!this.enabled) return;
    this.getTransport().error(this.formatMessage(message), ...args);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export class for testing purposes
export { Logger };
