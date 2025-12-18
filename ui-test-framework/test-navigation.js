/**
 * Navigation Test
 * Tests the navigation concept with real browser
 */

import { browserConcept } from './src/concepts/browserConcept.js';
import { navigationConcept } from './src/concepts/navigationConcept.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  console.log('🧪 Testing Navigation Concept\n');

  try {
    // Subscribe to navigation events
    navigationConcept.subscribe((event, payload) => {
      console.log(`📡 Navigation Event: ${event}`, {
        url: payload.url,
        duration: payload.duration,
        loadState: payload.loadState
      });
    });

    console.log('1️⃣ Launching browser...');
    await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true
    });
    console.log('✅ Browser launched\n');

    console.log('2️⃣ Navigating to example.com...');
    await navigationConcept.actions.navigate('https://example.com', {
      loadState: 'load'
    });
    console.log('✅ Navigation complete\n');

    console.log('3️⃣ Getting current URL...');
    const currentUrl = navigationConcept.actions.getCurrentUrl();
    console.log(`Current URL: ${currentUrl}`);
    console.log('✅ URL retrieved\n');

    console.log('4️⃣ Getting timing metrics...');
    const metrics = navigationConcept.actions.getTimingMetrics();
    console.log('Timing metrics:', metrics);
    console.log('✅ Metrics retrieved\n');

    console.log('5️⃣ Navigating to another page...');
    await navigationConcept.actions.navigate('https://www.wikipedia.org', {
      loadState: 'domcontentloaded'
    });
    console.log('✅ Second navigation complete\n');

    console.log('6️⃣ Closing browser...');
    await browserConcept.actions.close();
    console.log('✅ Browser closed\n');

    console.log('🎉 All navigation tests passed!');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test failed!');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);

    try {
      await browserConcept.actions.close();
    } catch (e) {
      // Ignore
    }

    process.exit(1);
  }
}

console.log('='.repeat(60));
console.log('  Navigation Concept Test');
console.log('='.repeat(60));
console.log();

test();
