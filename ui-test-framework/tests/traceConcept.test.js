/**
 * Trace Concept Tests
 * Unit tests for trace concept pure functions.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { createTraceEvent, formatTraceForError } from '../src/concepts/traceConcept.js';

test('createTraceEvent builds correct structure', () => {
  const event = createTraceEvent('click', {
    selector: '#button',
    success: true,
    duration: 45,
    pageUrl: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 }
  }, 5);

  assert.strictEqual(event.action, 'click');
  assert.strictEqual(event.selector, '#button');
  assert.strictEqual(event.success, true);
  assert.strictEqual(event.duration, 45);
  assert.strictEqual(event.sequenceId, 5);
  assert.strictEqual(event.context.url, 'http://localhost:3000');
  assert.ok(event.timestamp > 0);
});

test('createTraceEvent includes error info on failure', () => {
  const error = new Error('Element not found');
  const event = createTraceEvent('click', {
    selector: '#missing',
    success: false,
    error
  }, 10);

  assert.strictEqual(event.success, false);
  assert.strictEqual(event.error.type, 'Error');
  assert.strictEqual(event.error.message, 'Element not found');
});

test('formatTraceForError creates readable output', () => {
  const events = [
    { action: 'navigate', selector: null, success: true, duration: 100 },
    { action: 'click', selector: '#button', success: true, duration: 50 },
    { action: 'wait', selector: '#result', success: false, duration: 5000 }
  ];

  const formatted = formatTraceForError(events);

  assert.ok(formatted.includes('Last 10 actions:'));
  assert.ok(formatted.includes('navigate'));
  assert.ok(formatted.includes('#button'));
  assert.ok(formatted.includes('✓')); // Success marker
  assert.ok(formatted.includes('✗')); // Failure marker
});

test('formatTraceForError handles empty trace', () => {
  const formatted = formatTraceForError([]);
  assert.strictEqual(formatted, 'No trace available');
});

// TODO: Add integration tests for trace buffering and retrieval
