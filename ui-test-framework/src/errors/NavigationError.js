/**
 * NavigationError
 * Thrown when page load fails or times out.
 * Non-fatal - logs network timing data.
 */
export class NavigationError extends Error {
  constructor({ url, reason, timeout, networkTiming, statusCode, recentTrace }) {
    super(`Navigation failed for "${url}": ${reason}`);
    this.name = 'NavigationError';
    this.errorType = 'NavigationError';
    this.url = url;
    this.reason = reason;
    this.timeout = timeout;
    this.networkTiming = networkTiming;
    this.statusCode = statusCode;
    this.recentTrace = recentTrace || [];
    this.timestamp = Date.now();
    this.fatal = false;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NavigationError);
    }
  }

  toJSON() {
    return {
      errorType: this.errorType,
      message: this.message,
      url: this.url,
      reason: this.reason,
      timeout: this.timeout,
      networkTiming: this.networkTiming,
      statusCode: this.statusCode,
      recentTrace: this.recentTrace,
      timestamp: this.timestamp,
      fatal: this.fatal,
      stack: this.stack
    };
  }
}
