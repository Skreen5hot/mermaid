/**
 * Navigation Concept Tests
 * Unit tests for navigation concept pure functions.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { parseLoadState, calculateTimingMetrics } from '../src/concepts/navigationConcept.js';

test('parseLoadState accepts valid load states', () => {
  assert.strictEqual(parseLoadState('load'), 'load');
  assert.strictEqual(parseLoadState('domcontentloaded'), 'domcontentloaded');
  assert.strictEqual(parseLoadState('networkidle'), 'networkidle');
});

test('parseLoadState throws on invalid state', () => {
  assert.throws(() => {
    parseLoadState('invalid');
  }, /invalid load state/i);
});

test('calculateTimingMetrics computes correct values', () => {
  const perfData = {
    domainLookupStart: 100,
    domainLookupEnd: 150,
    connectStart: 150,
    connectEnd: 200,
    requestStart: 200,
    responseStart: 250,
    responseEnd: 300,
    domContentLoadedEventEnd: 400,
    loadEventEnd: 500
  };

  const metrics = calculateTimingMetrics(perfData);

  assert.strictEqual(metrics.dns, 50);
  assert.strictEqual(metrics.tcp, 50);
  assert.strictEqual(metrics.request, 50);
  assert.strictEqual(metrics.response, 50);
  assert.strictEqual(metrics.domContentLoaded, 400);
  assert.strictEqual(metrics.load, 500);
});

// TODO: Add integration tests for navigation actions
