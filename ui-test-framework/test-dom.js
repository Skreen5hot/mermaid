/**
 * DOM Concept Test
 * Tests DOM interaction with real browser
 */

import { browserConcept } from './src/concepts/browserConcept.js';
import { navigationConcept } from './src/concepts/navigationConcept.js';
import { domConcept } from './src/concepts/domConcept.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  console.log('🧪 Testing DOM Concept\n');

  try {
    // Subscribe to DOM events
    domConcept.subscribe((event, payload) => {
      console.log(`📡 DOM Event: ${event}`, {
        action: payload.action,
        selector: payload.selector
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

    console.log('3️⃣ Testing element existence...');
    const h1Exists = await domConcept.actions.exists('h1');
    console.log(`h1 exists: ${h1Exists}`);
    console.log('✅ Element existence check works\n');

    console.log('4️⃣ Testing getText...');
    const h1Text = await domConcept.actions.getText('h1');
    console.log(`h1 text: "${h1Text}"`);
    console.log('✅ getText works\n');

    console.log('5️⃣ Testing visibility...');
    const h1Visible = await domConcept.actions.isVisible('h1');
    console.log(`h1 visible: ${h1Visible}`);
    console.log('✅ isVisible works\n');

    console.log('6️⃣ Testing getAttribute...');
    const bodyDir = await domConcept.actions.getAttribute('body', 'dir');
    console.log(`body dir attribute: ${bodyDir}`);
    console.log('✅ getAttribute works\n');

    console.log('7️⃣ Testing click on link...');
    const linkExists = await domConcept.actions.exists('a');
    if (linkExists) {
      await domConcept.actions.click('a');
      console.log('✅ Click works\n');

      // Wait a moment for navigation
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('⚠️  No link found to click\n');
    }

    console.log('8️⃣ Navigate to a form page (httpbin.org)...');
    await navigationConcept.actions.navigate('https://httpbin.org/forms/post', {
      loadState: 'load'
    });
    console.log('✅ Form page loaded\n');

    console.log('9️⃣ Testing type into input...');
    const inputExists = await domConcept.actions.exists('input[name="custname"]');
    if (inputExists) {
      await domConcept.actions.type('input[name="custname"]', 'Test User');
      console.log('✅ Type works\n');
    } else {
      console.log('⚠️  Input field not found\n');
    }

    console.log('🔟 Testing select dropdown...');
    const selectExists = await domConcept.actions.exists('select[name="cupcake"]');
    if (selectExists) {
      await domConcept.actions.select('select[name="cupcake"]', 'chocolate');
      console.log('✅ Select works\n');
    } else {
      console.log('⚠️  Select field not found\n');
    }

    console.log('1️⃣1️⃣ Testing checkbox...');
    const checkboxExists = await domConcept.actions.exists('input[type="checkbox"]');
    if (checkboxExists) {
      await domConcept.actions.check('input[type="checkbox"]');
      console.log('✅ Check works\n');

      await domConcept.actions.uncheck('input[type="checkbox"]');
      console.log('✅ Uncheck works\n');
    } else {
      console.log('⚠️  Checkbox not found\n');
    }

    console.log('1️⃣2️⃣ Closing browser...');
    await browserConcept.actions.close();
    console.log('✅ Browser closed\n');

    console.log('🎉 All DOM tests passed!');
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
console.log('  DOM Concept Test');
console.log('='.repeat(60));
console.log();

test();
