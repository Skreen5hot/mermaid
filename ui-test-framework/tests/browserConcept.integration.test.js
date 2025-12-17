/**
 * Browser Concept Integration Tests
 * Tests the full browser launch, CDP connection, and cleanup flow.
 *
 * NOTE: These tests require a Chromium-based browser to be installed.
 * Set the CHROME_PATH environment variable to your browser executable path.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { browserConcept } from '../src/concepts/browserConcept.js';

// Get Chrome path from environment or use common defaults
const CHROME_PATH = process.env.CHROME_PATH ||
  process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/chromium';

test('browser lifecycle - launch and close', async () => {
  const browser = await browserConcept.actions.launch({
    executablePath: CHROME_PATH,
    headless: true,
    viewport: { width: 1280, height: 720 }
  });

  // Verify browser launched
  assert.ok(browser, 'Browser instance should be returned');
  assert.ok(browser.wsEndpoint, 'WebSocket endpoint should be set');
  assert.ok(browser.pid, 'Process ID should be set');
  assert.ok(browser.port, 'CDP port should be set');

  // Verify state is populated
  assert.ok(browserConcept.state.browser, 'Browser state should be set');
  assert.ok(browserConcept.state.wsEndpoint, 'WS endpoint state should be set');
  assert.ok(browserConcept.state.process, 'Process state should be set');
  assert.ok(browserConcept.state.ws, 'WebSocket state should be set');

  // Close browser
  await browserConcept.actions.close();

  // Verify cleanup
  assert.strictEqual(browserConcept.state.browser, null, 'Browser state should be null');
  assert.strictEqual(browserConcept.state.wsEndpoint, null, 'WS endpoint should be null');
  assert.strictEqual(browserConcept.state.process, null, 'Process should be null');
  assert.strictEqual(browserConcept.state.ws, null, 'WebSocket should be null');
});

test('browser emits browserLaunched event', async () => {
  const events = [];

  browserConcept.subscribe((event, payload) => {
    events.push({ event, payload });
  });

  await browserConcept.actions.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  // Check for browserLaunched event
  const launchEvent = events.find(e => e.event === 'browserLaunched');
  assert.ok(launchEvent, 'browserLaunched event should be emitted');
  assert.ok(launchEvent.payload.wsEndpoint, 'Event should include wsEndpoint');
  assert.ok(launchEvent.payload.pid, 'Event should include pid');

  await browserConcept.actions.close();
});

test('browser emits browserClosed event', async () => {
  const events = [];

  browserConcept.subscribe((event, payload) => {
    events.push({ event, payload });
  });

  await browserConcept.actions.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  await browserConcept.actions.close();

  // Check for browserClosed event
  const closeEvent = events.find(e => e.event === 'browserClosed');
  assert.ok(closeEvent, 'browserClosed event should be emitted');
});

test('sendCDPCommand works correctly', async () => {
  await browserConcept.actions.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  // Send a simple CDP command to get browser version
  const result = await browserConcept.actions.sendCDPCommand('Browser.getVersion');

  assert.ok(result, 'CDP command should return result');
  assert.ok(result.product, 'Result should include product info');
  assert.ok(result.userAgent, 'Result should include user agent');

  await browserConcept.actions.close();
});

test('sendCDPCommand throws when not connected', async () => {
  // Try to send command without launching browser
  await assert.rejects(
    async () => {
      await browserConcept.actions.sendCDPCommand('Browser.getVersion');
    },
    /CDP WebSocket not connected/,
    'Should throw when WebSocket not connected'
  );
});

test('close is idempotent', async () => {
  await browserConcept.actions.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  // Close multiple times should not throw
  await browserConcept.actions.close();
  await browserConcept.actions.close();
  await browserConcept.actions.close();

  // State should still be clean
  assert.strictEqual(browserConcept.state.browser, null);
});

test('browser handles custom viewport size', async () => {
  await browserConcept.actions.launch({
    executablePath: CHROME_PATH,
    headless: true,
    viewport: { width: 1920, height: 1080 }
  });

  assert.ok(browserConcept.state.browser, 'Browser should launch with custom viewport');

  await browserConcept.actions.close();
});

test('getWSEndpoint returns correct endpoint', async () => {
  await browserConcept.actions.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const endpoint = browserConcept.actions.getWSEndpoint();

  assert.ok(endpoint, 'Endpoint should be returned');
  assert.ok(endpoint.startsWith('ws://'), 'Endpoint should be WebSocket URL');
  assert.ok(endpoint.includes('devtools'), 'Endpoint should be CDP URL');

  await browserConcept.actions.close();
});

// Cleanup after all tests
test.afterEach(async () => {
  // Ensure browser is closed after each test
  try {
    await browserConcept.actions.close();
  } catch (err) {
    // Ignore - browser may already be closed
  }
});
