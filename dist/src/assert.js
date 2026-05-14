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

export default { ok, strictEqual, fail };