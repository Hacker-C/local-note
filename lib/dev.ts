type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export class Logger {
  // 可选：生产环境开关
  static enabled: boolean = true;

  private static _formatMessage(level: LogLevel, ...args: unknown[]): void {
    if (!Logger.enabled) return;

    const styles: Record<LogLevel, string> = {
      info: 'color: white; background-color: #28a745; padding: 2px 4px; border-radius: 4px;',
      warn: 'color: black; background-color: #ffc107; padding: 2px 4px; border-radius: 4px;',
      error: 'color: white; background-color: #dc3545; padding: 2px 4px; border-radius: 4px;',
      debug: 'color: white; background-color: #17a2b8; padding: 2px 4px; border-radius: 4px;'
    };

    const consoleMethod: Record<LogLevel, typeof console.log> = {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    consoleMethod[level](
      `%c${level.toUpperCase()}`,
      styles[level],
      ...args
    );
  }

  static info(...args: unknown[]): void {
    Logger._formatMessage('info', ...args);
  }

  static warn(...args: unknown[]): void {
    Logger._formatMessage('warn', ...args);
  }

  static error(...args: unknown[]): void {
    Logger._formatMessage('error', ...args);
  }

  static debug(...args: unknown[]): void {
    Logger._formatMessage('debug', ...args);
  }

  // 可选：添加时间戳
  static withTimestamp(level: LogLevel, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    Logger._formatMessage(level, `[${timestamp}]`, ...args);
  }
}

