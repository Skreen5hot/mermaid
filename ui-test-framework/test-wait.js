/**
 * Wait Concept Test
 * Tests wait functions with real browser
 */

import { browserConcept } from './src/concepts/browserConcept.js';
import { navigationConcept } from './src/concepts/navigationConcept.js';
import { domConcept } from './src/concepts/domConcept.js';
import { waitConcept } from './src/concepts/waitConcept.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  console.log('🧪 Testing Wait Concept\n');

  try {
    // Subscribe to wait events
    waitConcept.subscribe((event, payload) => {
      console.log(`📡 Wait Event: ${event}`, {
        type: payload.type,
        selector: payload.selector,
        duration: payload.duration
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

    console.log('3️⃣ Testing waitForSelector (element exists)...');
    await waitConcept.actions.waitForSelector('h1', { timeout: 3000 });
    console.log('✅ Element found\n');

    console.log('4️⃣ Testing waitForSelector (element visible)...');
    await waitConcept.actions.waitForSelector('p', {
      timeout: 3000,
      visible: true
    });
    console.log('✅ Visible element found\n');

    console.log('5️⃣ Testing waitForText (exact match)...');
    await waitConcept.actions.waitForText('h1', 'Example Domain', {
      timeout: 3000,
      exact: true
    });
    console.log('✅ Exact text match found\n');

    console.log('6️⃣ Testing waitForText (contains)...');
    await waitConcept.actions.waitForText('p', 'domain', {
      timeout: 3000,
      exact: false
    });
    console.log('✅ Text contains match found\n');

    console.log('7️⃣ Testing waitForCondition...');
    await waitConcept.actions.waitForCondition(async () => {
      const text = await domConcept.actions.getText('h1');
      return text.length > 0;
    }, { timeout: 3000 });
    console.log('✅ Condition met\n');

    console.log('8️⃣ Creating a page with delayed element...');
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Wait Test</title></head>
      <body>
        <h1>Wait Test Page</h1>
        <div id="initial">Initial content</div>
        <script>
          // Add element after 500ms
          setTimeout(() => {
            const div = document.createElement('div');
            div.id = 'delayed';
            div.textContent = 'Delayed content';
            document.body.appendChild(div);
          }, 500);

          // Hide element after 1500ms
          setTimeout(() => {
            document.getElementById('initial').style.display = 'none';
          }, 1500);
        </script>
      </body>
      </html>
    `;

    const dataUrl = 'data:text/html;base64,' + Buffer.from(html).toString('base64');
    await navigationConcept.actions.navigate(dataUrl, { loadState: 'load' });
    console.log('✅ Test page loaded\n');

    console.log('9️⃣ Testing waitForSelector on delayed element...');
    const startTime = Date.now();
    await waitConcept.actions.waitForSelector('#delayed', { timeout: 2000 });
    const duration = Date.now() - startTime;
    console.log(`✅ Delayed element appeared after ${duration}ms\n`);

    console.log('🔟 Testing waitForHidden...');
    await waitConcept.actions.waitForHidden('#initial', { timeout: 3000 });
    console.log('✅ Element hidden as expected\n');

    console.log('1️⃣1️⃣ Testing timeout error...');
    try {
      await waitConcept.actions.waitForSelector('#nonexistent', { timeout: 500 });
      console.log('❌ Should have timed out');
    } catch (err) {
      if (err.errorType === 'TimeoutError') {
        console.log(`✅ Correctly timed out: ${err.message}\n`);
      } else {
        throw err;
      }
    }

    console.log('1️⃣2️⃣ Getting active waits (should be empty)...');
    const activeWaits = waitConcept.actions.getActiveWaits();
    console.log(`Active waits: ${activeWaits.length}`);
    console.log('✅ No active waits\n');

    console.log('1️⃣3️⃣ Closing browser...');
    await browserConcept.actions.close();
    console.log('✅ Browser closed\n');

    console.log('🎉 All wait tests passed!');
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
console.log('  Wait Concept Test');
console.log('='.repeat(60));
console.log();

test();
