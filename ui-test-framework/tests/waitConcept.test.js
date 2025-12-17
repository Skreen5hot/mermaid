/**
 * Wait Concept Tests
 * Unit tests for wait concept pure functions.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { calculateElapsedTime, matchesTextCondition } from '../src/concepts/waitConcept.js';

test('calculateElapsedTime computes duration correctly', () => {
  const startTime = Date.now() - 1000; // 1 second ago
  const elapsed = calculateElapsedTime(startTime);
  assert.ok(elapsed >= 1000 && elapsed < 1100); // Allow some tolerance
});

test('matchesTextCondition with exact match', () => {
  assert.strictEqual(matchesTextCondition('Hello World', 'Hello World', true), true);
  assert.strictEqual(matchesTextCondition('Hello World', 'Hello', true), false);
});

test('matchesTextCondition with substring match', () => {
  assert.strictEqual(matchesTextCondition('Hello World', 'World', false), true);
  assert.strictEqual(matchesTextCondition('Hello World', 'hello', false), false); // Case sensitive
});

test('matchesTextCondition defaults to substring match', () => {
  assert.strictEqual(matchesTextCondition('Hello World', 'World'), true);
  assert.strictEqual(matchesTextCondition('Hello World', 'Foo'), false);
});

// TODO: Add integration tests for wait actions with timeouts
