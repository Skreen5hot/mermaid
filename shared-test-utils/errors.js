/**
 * @file errors.js
 * @description Shared error types for both unit and UI testing frameworks.
 * Provides structured, machine-readable error objects for better debugging
 * and AI agent integration.
 */

/**
 * Enhanced assertion error with rich context.
 * Used when test assertions fail.
 */
export class AssertionError extends Error {
  /**
   * @param {Object} options
   * @param {string} options.message - Human-readable error message
   * @param {*} options.expected - Expected value
   * @param {*} options.actual - Actual value received
   * @param {string} options.matcher - Assertion type (e.g., 'strictEqual', 'toBe')
   * @param {string} [options.diff] - Formatted diff string
   */
  constructor({ message, expected, actual, matcher, diff }) {
    const errorMessage = diff || message || `Expected ${expected}, got ${actual}`;
    super(errorMessage);
    this.name = 'AssertionError';
    this.expected = expected;
    this.actual = actual;
    this.matcher = matcher;
    this.diff = diff;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AssertionError);
    }
  }

  /**
   * Returns machine-readable JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      expected: this.expected,
      actual: this.actual,
      matcher: this.matcher,
      stack: this.stack
    };
  }
}

/**
 * Timeout error for async operations.
 * Used when wait operations or async tests exceed time limits.
 */
export class TimeoutError extends Error {
  /**
   * @param {Object} options
   * @param {string} options.operation - Description of what timed out
   * @param {number} options.timeout - Timeout duration in milliseconds
   * @param {string} [options.selector] - CSS selector (for DOM operations)
   * @param {Object} [options.context] - Additional context
   */
  constructor({ operation, timeout, selector, context }) {
    const message = selector
      ? `${operation} for selector "${selector}" timed out after ${timeout}ms`
      : `${operation} timed out after ${timeout}ms`;
    super(message);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeout = timeout;
    this.selector = selector;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      operation: this.operation,
      timeout: this.timeout,
      selector: this.selector,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Setup error for test lifecycle hook failures.
 * Used when beforeEach or beforeAll hooks fail.
 */
export class SetupError extends Error {
  /**
   * @param {Object} options
   * @param {string} options.hook - Hook name ('beforeEach' or 'beforeAll')
   * @param {Error} options.originalError - The error thrown by the hook
   * @param {string} [options.testName] - Name of test that was being set up
   */
  constructor({ hook, originalError, testName }) {
    const message = testName
      ? `${hook} hook failed for test "${testName}": ${originalError.message}`
      : `${hook} hook failed: ${originalError.message}`;
    super(message);
    this.name = 'SetupError';
    this.hook = hook;
    this.originalError = originalError;
    this.testName = testName;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SetupError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      hook: this.hook,
      testName: this.testName,
      originalError: {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      },
      stack: this.stack
    };
  }
}

/**
 * Teardown error for cleanup hook failures.
 * Used when afterEach or afterAll hooks fail.
 */
export class TeardownError extends Error {
  /**
   * @param {Object} options
   * @param {string} options.hook - Hook name ('afterEach' or 'afterAll')
   * @param {Error} options.originalError - The error thrown by the hook
   * @param {string} [options.testName] - Name of test that was being cleaned up
   */
  constructor({ hook, originalError, testName }) {
    const message = testName
      ? `${hook} hook failed for test "${testName}": ${originalError.message}`
      : `${hook} hook failed: ${originalError.message}`;
    super(message);
    this.name = 'TeardownError';
    this.hook = hook;
    this.originalError = originalError;
    this.testName = testName;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TeardownError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      hook: this.hook,
      testName: this.testName,
      originalError: {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      },
      stack: this.stack
    };
  }
}
