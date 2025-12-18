/**
 * Manual Test for Browser Launch
 * Run with: node manual-test.js
 */

import { browserConcept } from './src/concepts/browserConcept.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  console.log('🚀 Starting browser test...');
  console.log('Chrome path:', CHROME_PATH);

  // Subscribe to all events to see what's happening
  browserConcept.subscribe((event, payload) => {
    console.log(`📡 Event: ${event}`, JSON.stringify(payload, null, 2));
  });

  try {
    console.log('\n1️⃣ Launching browser...');
    const browser = await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true,
      viewport: { width: 1280, height: 720 }
    });

    console.log('\n✅ Browser launched successfully!');
    console.log('Browser info:', JSON.stringify(browser, null, 2));

    console.log('\n2️⃣ Sending CDP command (Browser.getVersion)...');
    const version = await browserConcept.actions.sendCDPCommand('Browser.getVersion');

    console.log('\n✅ CDP command successful!');
    console.log('Product:', version.product);
    console.log('User Agent:', version.userAgent);

    console.log('\n3️⃣ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n4️⃣ Closing browser...');
    await browserConcept.actions.close();

    console.log('\n✅ All tests passed!');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test failed!');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);

    // Try to clean up
    try {
      await browserConcept.actions.close();
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

console.log('='.repeat(60));
console.log('  Manual Browser Test');
console.log('='.repeat(60));

test();
