/**
 * ElementNotInteractableError
 * Thrown when element is hidden, disabled, or obscured during interaction.
 * Non-fatal - logs element state snapshot.
 */
export class ElementNotInteractableError extends Error {
  constructor({ selector, action, reason, elementSnapshot, pageUrl, recentTrace }) {
    super(`Element not interactable: "${selector}". ${reason}`);
    this.name = 'ElementNotInteractableError';
    this.errorType = 'ElementNotInteractableError';
    this.selector = selector;
    this.action = action;
    this.reason = reason;
    this.elementSnapshot = elementSnapshot;
    this.pageUrl = pageUrl;
    this.recentTrace = recentTrace || [];
    this.timestamp = Date.now();
    this.fatal = false;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ElementNotInteractableError);
    }
  }

  toJSON() {
    return {
      errorType: this.errorType,
      message: this.message,
      selector: this.selector,
      action: this.action,
      reason: this.reason,
      elementSnapshot: this.elementSnapshot,
      pageUrl: this.pageUrl,
      recentTrace: this.recentTrace,
      timestamp: this.timestamp,
      fatal: this.fatal,
      stack: this.stack
    };
  }
}
