/**
 * BrowserCrashError
 * Thrown when the browser process terminates unexpectedly.
 * This is a fatal error that stops suite execution.
 */
export class BrowserCrashError extends Error {
  constructor({ message, exitCode, signal, pid, lastAction }) {
    super(message || 'Browser process crashed unexpectedly');
    this.name = 'BrowserCrashError';
    this.errorType = 'BrowserCrashError';
    this.exitCode = exitCode;
    this.signal = signal;
    this.pid = pid;
    this.lastAction = lastAction;
    this.timestamp = Date.now();
    this.fatal = true;

    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BrowserCrashError);
    }
  }

  toJSON() {
    return {
      errorType: this.errorType,
      message: this.message,
      exitCode: this.exitCode,
      signal: this.signal,
      pid: this.pid,
      lastAction: this.lastAction,
      timestamp: this.timestamp,
      fatal: this.fatal,
      stack: this.stack
    };
  }
}
