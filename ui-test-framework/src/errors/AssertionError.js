/**
 * AssertionError
 * Thrown when an assertion comparison fails.
 * Non-fatal - logs diff and continues to next test.
 */
export class AssertionError extends Error {
  constructor({ expected, actual, matcher, diff, selector, recentTrace }) {
    const message = selector
      ? `Assertion failed for selector "${selector}": expected ${matcher} ${expected}, got ${actual}`
      : `Assertion failed: expected ${matcher} ${expected}, got ${actual}`;

    super(message);
    this.name = 'AssertionError';
    this.errorType = 'AssertionError';
    this.expected = expected;
    this.actual = actual;
    this.matcher = matcher;
    this.diff = diff;
    this.selector = selector;
    this.recentTrace = recentTrace || [];
    this.timestamp = Date.now();
    this.fatal = false;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AssertionError);
    }
  }

  toJSON() {
    return {
      errorType: this.errorType,
      message: this.message,
      expected: this.expected,
      actual: this.actual,
      matcher: this.matcher,
      diff: this.diff,
      selector: this.selector,
      recentTrace: this.recentTrace,
      timestamp: this.timestamp,
      fatal: this.fatal,
      stack: this.stack
    };
  }
}
