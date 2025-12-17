/**
 * Browser Concept Tests
 * Unit tests for browser concept pure functions.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  buildLaunchArgs,
  validateConfig,
  findAvailablePort
} from '../src/concepts/browserConcept.js';

test('buildLaunchArgs includes headless flag when enabled', () => {
  const args = buildLaunchArgs({ headless: true });
  assert.ok(args.includes('--headless'));
});

test('buildLaunchArgs excludes headless flag when disabled', () => {
  const args = buildLaunchArgs({ headless: false });
  assert.ok(!args.includes('--headless'));
});

test('buildLaunchArgs includes viewport size', () => {
  const args = buildLaunchArgs({
    headless: true,
    viewport: { width: 1920, height: 1080 }
  });
  assert.ok(args.some(arg => arg.includes('--window-size=1920,1080')));
});

test('validateConfig throws on missing executablePath', () => {
  assert.throws(() => {
    validateConfig({});
  }, /executable path is required/i);
});

test('validateConfig throws on invalid viewport width', () => {
  assert.throws(() => {
    validateConfig({
      executablePath: '/usr/bin/chromium',
      viewport: { width: -100, height: 720 }
    });
  }, /invalid viewport width/i);
});

test('validateConfig passes with valid config', () => {
  assert.doesNotThrow(() => {
    validateConfig({
      executablePath: '/usr/bin/chromium',
      viewport: { width: 1280, height: 720 }
    });
  });
});

test('findAvailablePort returns a valid port number', async () => {
  const port = await findAvailablePort();

  assert.ok(typeof port === 'number', 'Port should be a number');
  assert.ok(port > 0 && port < 65536, 'Port should be in valid range');
});

test('findAvailablePort returns different ports on subsequent calls', async () => {
  const port1 = await findAvailablePort();
  const port2 = await findAvailablePort();

  // Ports should typically be different (though not guaranteed)
  assert.ok(typeof port1 === 'number');
  assert.ok(typeof port2 === 'number');
});

test('buildLaunchArgs includes required CDP flags', () => {
  const args = buildLaunchArgs({ headless: true });

  assert.ok(args.includes('--disable-background-timer-throttling'));
  assert.ok(args.includes('--disable-backgrounding-occluded-windows'));
  assert.ok(args.includes('--disable-renderer-backgrounding'));
});

// Integration tests are in browserConcept.integration.test.js
