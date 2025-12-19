/**
 * @file test-utils.js
 * @description Provides simple, zero-dependency test runner functions (`describe`, `it`)
 * and a comprehensive assertion library (`assert`) for the test suite.
 */

class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
  }
}

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
      throw new AssertionError(message || `Assertion failed: ${actual} !== ${expected}`);
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

export function describe(name, fn) {
  console.log(`\n${name}`);
  // Push a new level for beforeEach hooks
  beforeEachStack.push(null);
  fn();
  // Pop the level after the suite has run
  beforeEachStack.pop();
}

/**
 * Registers a function to be run before each 'it' block in the current 'describe' suite.
 * @param {Function} fn - The setup function to run.
 */
export function beforeEach(fn) {
  if (beforeEachStack.length > 0) {
    beforeEachStack[beforeEachStack.length - 1] = fn;
  }
}

let testQueue = [];

export async function it(name, testFn) {
  // If called from within describe, just queue the test
  if (beforeEachStack.length > 0 && !testFn.isExecuting) {
    testQueue.push({ name, testFn });
    return;
  }

  // Mark as executing to prevent re-queuing
  testFn.isExecuting = true;

  // Find the nearest beforeEach hook in the stack and run it
  const hook = [...beforeEachStack].reverse().find(h => h !== null);
  if (hook) await hook();

  try {
    await testFn();
    console.log(`  ✓ PASS: ${name}`);
  } catch (error) {
    handleFailure(error);
  } finally {
    // Clean up after the test runs
    const tearDownHook = [...beforeEachStack].reverse().find(h => h && h.tearDown);
    if (tearDownHook) {
      tearDownHook.tearDown();
    }
  }

  function handleFailure(error) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(error);
    process.exit(1);
  }
}