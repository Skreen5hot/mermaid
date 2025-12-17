/**
 * Test Runner Concept Tests
 * Unit tests for test runner concept pure functions.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { buildTestPlan, aggregateResults } from '../src/concepts/testRunnerConcept.js';

test('buildTestPlan creates ordered execution plan', () => {
  const suites = [
    {
      name: 'Suite 1',
      tests: [
        { name: 'Test A', fn: () => {} },
        { name: 'Test B', fn: () => {} }
      ]
    },
    {
      name: 'Suite 2',
      tests: [
        { name: 'Test C', fn: () => {} }
      ]
    }
  ];

  const plan = buildTestPlan(suites);

  assert.strictEqual(plan.length, 3);
  assert.strictEqual(plan[0].suite, 'Suite 1');
  assert.strictEqual(plan[0].test, 'Test A');
  assert.strictEqual(plan[1].test, 'Test B');
  assert.strictEqual(plan[2].suite, 'Suite 2');
});

test('aggregateResults calculates correct statistics', () => {
  const results = [
    { status: 'passed', duration: 100 },
    { status: 'passed', duration: 150 },
    { status: 'failed', duration: 200 },
    { status: 'passed', duration: 50 }
  ];

  const stats = aggregateResults(results);

  assert.strictEqual(stats.total, 4);
  assert.strictEqual(stats.passed, 3);
  assert.strictEqual(stats.failed, 1);
  assert.strictEqual(stats.duration, 500);
});

test('aggregateResults handles empty results', () => {
  const stats = aggregateResults([]);

  assert.strictEqual(stats.total, 0);
  assert.strictEqual(stats.passed, 0);
  assert.strictEqual(stats.failed, 0);
  assert.strictEqual(stats.duration, 0);
});

// TODO: Add integration tests for test execution flow
