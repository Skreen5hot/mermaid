/**
 * ElementNotFoundError
 * Thrown when querying for a non-existent element.
 * Non-fatal - suggests using waitForSelector().
 */
export class ElementNotFoundError extends Error {
  constructor({ selector, action, pageUrl, suggestion, recentTrace }) {
    const defaultSuggestion = `Element not found. Consider using waitForSelector('${selector}', { timeout: 5000 }) before ${action}.`;
    super(`Element not found: "${selector}"`);
    this.name = 'ElementNotFoundError';
    this.errorType = 'ElementNotFoundError';
    this.selector = selector;
    this.action = action;
    this.pageUrl = pageUrl;
    this.suggestion = suggestion || defaultSuggestion;
    this.recentTrace = recentTrace || [];
    this.timestamp = Date.now();
    this.fatal = false;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ElementNotFoundError);
    }
  }

  toJSON() {
    return {
      errorType: this.errorType,
      message: this.message,
      selector: this.selector,
      action: this.action,
      pageUrl: this.pageUrl,
      suggestion: this.suggestion,
      recentTrace: this.recentTrace,
      timestamp: this.timestamp,
      fatal: this.fatal,
      stack: this.stack
    };
  }
}
