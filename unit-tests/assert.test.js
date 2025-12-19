import assert from '../src/assert.js';
import { describe, test } from './test-helpers.js';

describe('Assert Utility', () => {
  test('assert.ok should pass for truthy values', () => {
    assert.ok(true, 'true should be truthy');
    assert.ok(1, '1 should be truthy');
    assert.ok({}, '{} should be truthy');
  });

  test('assert.ok should throw for falsy values', () => {
    let didThrow = false;
    try {
      assert.ok(false, 'false should be falsy');
    } catch (e) {
      didThrow = true;
      assert.strictEqual(e.name, 'AssertionError', 'Error should be an AssertionError');
    }
    assert.ok(didThrow, 'assert.ok(false) should throw');
  });

  test('assert.strictEqual should pass for strictly equal values', () => {
    assert.strictEqual(1, 1, '1 === 1');
    assert.strictEqual('a', 'a', "'a' === 'a'");
  });

  test('assert.strictEqual should throw for non-strictly equal values', () => {
    let didThrow = false;
    try {
      assert.strictEqual(1, '1', "1 !== '1'");
    } catch (e) {
      didThrow = true;
    }
    assert.ok(didThrow, 'assert.strictEqual(1, "1") should throw');
  });

  test('assert.fail should always throw', () => {
    let didThrow = false;
    try {
      assert.fail('This should fail');
    } catch (e) {
      didThrow = true;
      assert.strictEqual(e.message, 'This should fail', 'Error message should match');
    }
    assert.ok(didThrow, 'assert.fail() should always throw an error');
  });
});