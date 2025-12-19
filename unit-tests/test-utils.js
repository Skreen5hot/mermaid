/**
 * @file test-utils.js
 * @description Provides simple, zero-dependency test runner functions (`describe`, `test`)
 * and a comprehensive assertion library (`assert`) for the test suite.
 */

import { AssertionError, SetupError, TeardownError } from '../shared-test-utils/errors.js';

export const assert = {
  ok(value, message) {
    if (!value) {
      throw new AssertionError(message || 'Assertion failed: value is not truthy');
    }
  },

  isTrue(value, message) {
    if (value !== true) {
      throw new AssertionError(message || `Expected true, but got ${value}`);
    }
  },

  isFalse(value, message) {
    if (value !== false) {
      throw new AssertionError(message || `Expected false, but got ${value}`);
    }
  },

  strictEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new AssertionError({
        message: message || 'Values are not strictly equal',
        expected,
        actual,
        matcher: 'strictEqual',
        diff: `Expected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`
      });
    }
  },

  deepStrictEqual(actual, expected, message) {
    try {
      this.strictEqual(JSON.stringify(actual), JSON.stringify(expected), message);
    } catch (e) {
      throw new AssertionError(message || `Assertion failed: Objects are not deeply equal.\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
    }
  },

  isNull(value, message) {
    if (value !== null) {
      throw new AssertionError(message || `Expected null, but got ${value}`);
    }
  },

  isNotNull(value, message) {
    if (value === null) {
      throw new AssertionError(message || 'Expected not null, but got null');
    }
  },

  instanceOf(obj, constructor, message) {
    if (!(obj instanceof constructor)) {
      throw new AssertionError(message || `Expected instance of ${constructor.name}, but got ${obj.constructor.name}`);
    }
  },

  isAbove(value, threshold, message) {
    if (value <= threshold) {
      throw new AssertionError(message || `Expected ${value} to be above ${threshold}`);
    }
  },

  isBelow(value, threshold, message) {
    if (value >= threshold) {
      throw new AssertionError(message || `Expected ${value} to be below ${threshold}`);
    }
  },

  include(haystack, needle, message) {
    if (!haystack.includes(needle)) {
      throw new AssertionError(message || `Expected "${haystack}" to include "${needle}"`);
    }
  }
};

const beforeEachStack = [];
const afterEachStack = [];

export function describe(name, fn) {
  console.log(`\n${name}`);
  // Push a new level for hooks
  beforeEachStack.push(null);
  afterEachStack.push(null);
  fn();
  // Pop the level after the suite has run
  beforeEachStack.pop();
  afterEachStack.pop();
}

/**
 * Registers a function to be run before each 'test' block in the current 'describe' suite.
 * @param {Function} fn - The setup function to run.
 */
export function beforeEach(fn) {
  if (beforeEachStack.length > 0) {
    beforeEachStack[beforeEachStack.length - 1] = fn;
  }
}

/**
 * Registers a function to be run after each 'test' block in the current 'describe' suite.
 * Guaranteed to execute even if the test fails.
 * @param {Function} fn - The teardown function to run.
 */
export function afterEach(fn) {
  if (afterEachStack.length > 0) {
    afterEachStack[afterEachStack.length - 1] = fn;
  }
}

let testQueue = [];

export async function test(name, testFn) {
  // If called from within describe, just queue the test
  if (beforeEachStack.length > 0 && !testFn.isExecuting) {
    testQueue.push({ name, testFn });
    return;
  }

  // Mark as executing to prevent re-queuing
  testFn.isExecuting = true;

  let testError = null;

  try {
    // Setup phase: Run beforeEach hook
    const setupHook = [...beforeEachStack].reverse().find(h => h !== null);
    if (setupHook) {
      try {
        await setupHook();
      } catch (error) {
        throw new SetupError({
          hook: 'beforeEach',
          originalError: error,
          testName: name
        });
      }
    }

    // Execution phase: Run the actual test
    await testFn();
    console.log(`  ✓ PASS: ${name}`);

  } catch (error) {
    testError = error;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(error);

  } finally {
    // Teardown phase: GUARANTEED cleanup - always runs
    const teardownHook = [...afterEachStack].reverse().find(h => h !== null);
    if (teardownHook) {
      try {
        await teardownHook();
      } catch (cleanupError) {
        const teardownErr = new TeardownError({
          hook: 'afterEach',
          originalError: cleanupError,
          testName: name
        });
        console.error(`  ⚠ Cleanup error: ${teardownErr.message}`);
        console.error(cleanupError);

        // If test passed but cleanup failed, treat as failure
        if (!testError) {
          testError = teardownErr;
        }
      }
    }

    // If any error occurred (test or cleanup), exit with failure
    if (testError) {
      process.exit(1);
    }
  }
}

// Legacy alias for backwards compatibility
export const it = test;