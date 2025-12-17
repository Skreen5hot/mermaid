/**
 * TimeoutError
 * Thrown when a wait function exceeds its timeout.
 * Non-fatal - test continues to next test.
 */
export class TimeoutError extends Error {
  constructor({ selector, timeout, action, pageUrl, viewport, recentTrace }) {
    super(`Timeout waiting for "${selector}" (${timeout}ms) during ${action}`);
    this.name = 'TimeoutError';
    this.errorType = 'TimeoutError';
    this.selector = selector;
    this.timeout = timeout;
    this.action = action;
    this.pageUrl = pageUrl;
    this.viewport = viewport;
    this.recentTrace = recentTrace || [];
    this.timestamp = Date.now();
    this.fatal = false;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }

  toJSON() {
    return {
      errorType: this.errorType,
      message: this.message,
      selector: this.selector,
      timeout: this.timeout,
      action: this.action,
      pageUrl: this.pageUrl,
      viewport: this.viewport,
      recentTrace: this.recentTrace,
      timestamp: this.timestamp,
      fatal: this.fatal,
      stack: this.stack
    };
  }
}
