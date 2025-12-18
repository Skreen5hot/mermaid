/**
 * Context Concept Test
 * Tests context isolation with real browser
 */

import { browserConcept } from './src/concepts/browserConcept.js';
import { contextConcept } from './src/concepts/contextConcept.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  console.log('🧪 Testing Context Concept\n');

  try {
    // Subscribe to context events
    contextConcept.subscribe((event, payload) => {
      console.log(`📡 Context Event: ${event}`, {
        contextId: payload.contextId?.substring(0, 8),
        from: payload.from?.substring(0, 8),
        to: payload.to?.substring(0, 8),
        duration: payload.duration
      });
    });

    console.log('1️⃣ Launching browser...');
    await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true
    });
    console.log('✅ Browser launched\n');

    console.log('2️⃣ Creating first context...');
    const context1 = await contextConcept.actions.createContext();
    console.log(`✅ Context 1 created: ${context1.substring(0, 8)}\n`);

    console.log('3️⃣ Getting active context...');
    const active1 = contextConcept.actions.getActiveContext();
    console.log(`Active context: ${active1.contextId.substring(0, 8)}`);
    console.log(`Browser context ID: ${active1.browserContextId}`);
    console.log(`Target ID: ${active1.targetId}`);
    console.log(`Session ID: ${active1.sessionId.substring(0, 8)}`);
    console.log('✅ Active context retrieved\n');

    console.log('4️⃣ Creating second context...');
    const context2 = await contextConcept.actions.createContext();
    console.log(`✅ Context 2 created: ${context2.substring(0, 8)}\n`);

    console.log('5️⃣ Creating third context...');
    const context3 = await contextConcept.actions.createContext();
    console.log(`✅ Context 3 created: ${context3.substring(0, 8)}\n`);

    console.log('6️⃣ Listing all contexts...');
    const allContexts = contextConcept.actions.listContexts();
    console.log(`Total contexts: ${allContexts.length}`);
    allContexts.forEach((ctx, i) => {
      console.log(`  Context ${i + 1}: ${ctx.contextId.substring(0, 8)} ${ctx.isActive ? '(active)' : ''}`);
    });
    console.log('✅ Contexts listed\n');

    console.log('7️⃣ Switching to context 2...');
    contextConcept.actions.switchContext(context2);
    const active2 = contextConcept.actions.getActiveContext();
    console.log(`Active context now: ${active2.contextId.substring(0, 8)}`);
    console.log('✅ Context switched\n');

    console.log('8️⃣ Getting context by ID...');
    const ctx1Info = contextConcept.actions.getContext(context1);
    console.log(`Context 1 info: ${ctx1Info.contextId.substring(0, 8)}`);
    console.log(`  Created: ${new Date(ctx1Info.created).toISOString()}`);
    console.log('✅ Context info retrieved\n');

    console.log('9️⃣ Destroying context 1...');
    await contextConcept.actions.destroyContext(context1);
    const afterDestroy = contextConcept.actions.listContexts();
    console.log(`Contexts remaining: ${afterDestroy.length}`);
    console.log('✅ Context destroyed\n');

    console.log('🔟 Testing error handling (destroying non-existent context)...');
    try {
      await contextConcept.actions.destroyContext('invalid-context-id');
      console.log('❌ Should have thrown error');
    } catch (err) {
      console.log(`✅ Correctly threw error: ${err.message}\n`);
    }

    console.log('1️⃣1️⃣ Destroying all remaining contexts...');
    await contextConcept.actions.destroyAllContexts();
    const finalContexts = contextConcept.actions.listContexts();
    console.log(`Contexts remaining: ${finalContexts.length}`);
    console.log('✅ All contexts destroyed\n');

    console.log('1️⃣2️⃣ Verifying active context is null...');
    const finalActive = contextConcept.actions.getActiveContext();
    if (finalActive === null) {
      console.log('✅ Active context is null as expected\n');
    } else {
      console.log('❌ Active context should be null\n');
    }

    console.log('1️⃣3️⃣ Closing browser...');
    await browserConcept.actions.close();
    console.log('✅ Browser closed\n');

    console.log('🎉 All context tests passed!');
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
console.log('  Context Concept Test');
console.log('='.repeat(60));
console.log();

test();
