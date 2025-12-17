/**
 * SelectorError
 * Thrown when an invalid CSS selector is provided.
 * Non-fatal - fails test immediately without retry.
 */
export class SelectorError extends Error {
  constructor({ selector, reason, pageUrl, suggestion }) {
    super(`Invalid CSS selector: "${selector}". ${reason}`);
    this.name = 'SelectorError';
    this.errorType = 'SelectorError';
    this.selector = selector;
    this.reason = reason;
    this.pageUrl = pageUrl;
    this.suggestion = suggestion;
    this.timestamp = Date.now();
    this.fatal = false;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SelectorError);
    }
  }

  toJSON() {
    return {
      errorType: this.errorType,
      message: this.message,
      selector: this.selector,
      reason: this.reason,
      pageUrl: this.pageUrl,
      suggestion: this.suggestion,
      timestamp: this.timestamp,
      fatal: this.fatal,
      stack: this.stack
    };
  }
}
