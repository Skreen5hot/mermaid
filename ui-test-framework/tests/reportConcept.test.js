/**
 * Report Concept Tests
 * Unit tests for report concept pure functions.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { formatConsoleOutput, buildJSONReport } from '../src/concepts/reportConcept.js';

test('formatConsoleOutput creates readable summary', () => {
  const results = {
    stats: { total: 3, passed: 2, failed: 1, duration: 500 },
    tests: [
      { suite: 'Suite 1', name: 'Test A', status: 'passed', duration: 100 },
      { suite: 'Suite 1', name: 'Test B', status: 'failed', duration: 200, error: { message: 'Failed' } },
      { suite: 'Suite 2', name: 'Test C', status: 'passed', duration: 200 }
    ]
  };

  const output = formatConsoleOutput(results);

  assert.ok(output.includes('Test Results'));
  assert.ok(output.includes('Total: 3'));
  assert.ok(output.includes('Passed: 2'));
  assert.ok(output.includes('Failed: 1'));
  assert.ok(output.includes('Duration: 500ms'));
  assert.ok(output.includes('Test A'));
  assert.ok(output.includes('Failed'));
});

test('buildJSONReport creates correct structure', () => {
  const results = {
    stats: { total: 2, passed: 1, failed: 1, duration: 300 },
    tests: [
      { suite: 'Suite 1', name: 'Test A', status: 'passed', duration: 100 },
      {
        suite: 'Suite 1',
        name: 'Test B',
        status: 'failed',
        duration: 200,
        error: {
          errorType: 'AssertionError',
          message: 'Expected 5 to be 10',
          stack: 'Error stack...'
        }
      }
    ]
  };

  const report = buildJSONReport(results);

  assert.strictEqual(report.summary.total, 2);
  assert.strictEqual(report.summary.passed, 1);
  assert.strictEqual(report.summary.failed, 1);
  assert.strictEqual(report.tests.length, 2);
  assert.strictEqual(report.tests[0].status, 'passed');
  assert.strictEqual(report.tests[1].status, 'failed');
  assert.strictEqual(report.tests[1].error.type, 'AssertionError');
  assert.ok(report.summary.timestamp > 0);
});

// TODO: Add integration tests for file writing
