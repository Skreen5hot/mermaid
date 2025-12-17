/**
 * Assertion Concept Tests
 * Unit tests for assertion concept pure functions and actions.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { strictEquals, contains, generateDiff } from '../src/concepts/assertionConcept.js';

// Pure function tests

test('strictEquals compares values with ===', () => {
  assert.strictEqual(strictEquals(5, 5), true);
  assert.strictEqual(strictEquals(5, '5'), false);
  assert.strictEqual(strictEquals(null, undefined), false);
  assert.strictEqual(strictEquals({}, {}), false); // Different object references
});

test('contains checks string inclusion', () => {
  assert.strictEqual(contains('hello world', 'world'), true);
  assert.strictEqual(contains('hello world', 'foo'), false);
  assert.strictEqual(contains('', 'test'), false);
});

test('contains checks array inclusion', () => {
  assert.strictEqual(contains([1, 2, 3], 2), true);
  assert.strictEqual(contains([1, 2, 3], 4), false);
  assert.strictEqual(contains(['a', 'b'], 'a'), true);
});

test('generateDiff creates diff string', () => {
  const diff = generateDiff('expected', 'actual');
  assert.ok(diff.includes('Expected: expected'));
  assert.ok(diff.includes('Actual:   actual'));
});

// TODO: Add integration tests for assertion concept actions
// These will test the full assertion flow with event emission
