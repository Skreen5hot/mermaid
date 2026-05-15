class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
  }
}

function ok(value, message) {
  if (!value) {
    throw new AssertionError(message || 'Assertion failed: value is not truthy');
  }
}

function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new AssertionError(message || `Assertion failed: ${actual} !== ${expected}`);
  }
}

function fail(message) {
  throw new AssertionError(message || 'Assertion failed: explicit failure');
}

function deepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new AssertionError(message || `Assertion failed: ${a} !== ${b}`);
  }
}

// Asserts fn throws. If expectedCode is provided, asserts the thrown error's
// .code matches it (used for StorageError discrimination). Returns the caught
// error so callers can make further assertions about .detail etc.
function throws(fn, expectedCode, message) {
  try {
    fn();
  } catch (e) {
    if (expectedCode !== undefined && e.code !== expectedCode) {
      throw new AssertionError(
        message || `Assertion failed: expected error code "${expectedCode}", got "${e.code}" (${e.message})`
      );
    }
    return e;
  }
  throw new AssertionError(message || 'Assertion failed: expected function to throw');
}

export default { ok, strictEqual, fail, deepEqual, throws };