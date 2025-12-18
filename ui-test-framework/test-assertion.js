/**
 * Assertion Concept Test
 * Tests assertion library including DOM assertions
 */

import { browserConcept } from './src/concepts/browserConcept.js';
import { navigationConcept } from './src/concepts/navigationConcept.js';
import { assertionConcept } from './src/concepts/assertionConcept.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  console.log('🧪 Testing Assertion Concept\n');

  try {
    // Subscribe to assertion events
    assertionConcept.subscribe((event, payload) => {
      console.log(`📡 Assertion Event: ${event}`, {
        matcher: payload.matcher,
        expected: payload.expected,
        actual: payload.actual
      });
    });

    console.log('1️⃣ Launching browser...');
    await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true
    });
    console.log('✅ Browser launched\n');

    console.log('2️⃣ Testing basic assertions...');

    // toBe
    assertionConcept.actions.expect(5).toBe(5);
    console.log('  ✓ toBe works');

    // toContain
    assertionConcept.actions.expect('hello world').toContain('world');
    console.log('  ✓ toContain works');

    // toBeTruthy
    assertionConcept.actions.expect(true).toBeTruthy();
    assertionConcept.actions.expect(1).toBeTruthy();
    assertionConcept.actions.expect('text').toBeTruthy();
    console.log('  ✓ toBeTruthy works');

    // toBeFalsy
    assertionConcept.actions.expect(false).toBeFalsy();
    assertionConcept.actions.expect(0).toBeFalsy();
    assertionConcept.actions.expect('').toBeFalsy();
    console.log('  ✓ toBeFalsy works');

    console.log('✅ Basic assertions work\n');

    console.log('3️⃣ Testing assertion failures...');

    // Test toBe failure
    try {
      assertionConcept.actions.expect(5).toBe(10);
      console.log('  ❌ toBe should have failed');
    } catch (err) {
      if (err.name === 'AssertionError') {
        console.log('  ✓ toBe correctly throws AssertionError');
      } else {
        throw err;
      }
    }

    // Test toContain failure
    try {
      assertionConcept.actions.expect('hello').toContain('world');
      console.log('  ❌ toContain should have failed');
    } catch (err) {
      if (err.name === 'AssertionError') {
        console.log('  ✓ toContain correctly throws AssertionError');
      } else {
        throw err;
      }
    }

    console.log('✅ Assertion failures work correctly\n');

    console.log('4️⃣ Navigating to example.com for DOM assertions...');
    await navigationConcept.actions.navigate('https://example.com', {
      loadState: 'load'
    });
    console.log('✅ Navigation complete\n');

    console.log('5️⃣ Testing DOM assertion - toExist...');

    // Test element that exists
    await assertionConcept.actions.expect('h1').toExist();
    console.log('  ✓ toExist works for existing element');

    // Test element that doesn't exist
    try {
      await assertionConcept.actions.expect('.non-existent-element').toExist();
      console.log('  ❌ toExist should have failed for non-existent element');
    } catch (err) {
      if (err.name === 'AssertionError' && err.matcher === 'toExist') {
        console.log('  ✓ toExist correctly throws AssertionError for non-existent element');
      } else {
        throw err;
      }
    }

    console.log('✅ toExist assertion works\n');

    console.log('6️⃣ Testing DOM assertion - toBeVisible...');

    // Test visible element
    await assertionConcept.actions.expect('h1').toBeVisible();
    console.log('  ✓ toBeVisible works for visible element');

    // Test non-existent element
    try {
      await assertionConcept.actions.expect('.non-existent-element').toBeVisible();
      console.log('  ❌ toBeVisible should have failed for non-existent element');
    } catch (err) {
      if (err.name === 'AssertionError' && err.matcher === 'toBeVisible') {
        console.log('  ✓ toBeVisible correctly throws AssertionError for non-existent element');
      } else {
        throw err;
      }
    }

    console.log('✅ toBeVisible assertion works\n');

    console.log('7️⃣ Testing invalid selector types for DOM assertions...');

    // Test toExist with non-string
    try {
      await assertionConcept.actions.expect(123).toExist();
      console.log('  ❌ toExist should reject non-string selector');
    } catch (err) {
      if (err.name === 'AssertionError' && err.diff?.includes('CSS selector string')) {
        console.log('  ✓ toExist correctly rejects non-string selector');
      } else {
        throw err;
      }
    }

    // Test toBeVisible with non-string
    try {
      await assertionConcept.actions.expect({ selector: 'h1' }).toBeVisible();
      console.log('  ❌ toBeVisible should reject non-string selector');
    } catch (err) {
      if (err.name === 'AssertionError' && err.diff?.includes('CSS selector string')) {
        console.log('  ✓ toBeVisible correctly rejects non-string selector');
      } else {
        throw err;
      }
    }

    console.log('✅ Type validation works\n');

    console.log('8️⃣ Testing complex assertion combinations...');

    // Get text content and assert on it
    const { domConcept } = await import('./src/concepts/domConcept.js');
    const h1Text = await domConcept.actions.getText('h1');
    assertionConcept.actions.expect(h1Text).toContain('Example');
    console.log(`  ✓ Can assert on DOM text: "${h1Text}"`);

    // Check if element exists and is visible
    const h1Exists = await domConcept.actions.exists('h1');
    assertionConcept.actions.expect(h1Exists).toBeTruthy();
    console.log(`  ✓ Can assert on DOM element existence: ${h1Exists}`);

    console.log('✅ Complex assertions work\n');

    console.log('9️⃣ Closing browser...');
    await browserConcept.actions.close();
    console.log('✅ Browser closed\n');

    console.log('🎉 All assertion tests passed!');
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
console.log('  Assertion Concept Test');
console.log('='.repeat(60));
console.log();

test();
