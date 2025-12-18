/**
 * Single test to verify sendCDPCommand works
 */

import { browserConcept } from './src/concepts/browserConcept.js';
import assert from 'node:assert';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  console.log('Testing sendCDPCommand...');

  try {
    console.log('Launching browser...');
    await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true
    });

    console.log('Browser launched, sending command...');
    const result = await browserConcept.actions.sendCDPCommand('Browser.getVersion');

    assert.ok(result, 'CDP command should return result');
    assert.ok(result.product, 'Result should include product info');
    assert.ok(result.userAgent, 'Result should include user agent');

    console.log('✅ Test passed!');
    console.log('Product:', result.product);

    await browserConcept.actions.close();

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    try {
      await browserConcept.actions.close();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

test();
