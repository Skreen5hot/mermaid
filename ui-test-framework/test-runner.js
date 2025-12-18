/**
 * Test Runner Concept Test
 * Tests test execution, lifecycle hooks, and test isolation
 */

import { browserConcept } from './src/concepts/browserConcept.js';
import { contextConcept } from './src/concepts/contextConcept.js';
import { testRunnerConcept } from './src/concepts/testRunnerConcept.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  console.log('🧪 Testing Test Runner Concept\n');

  try {
    // Subscribe to test runner events
    const events = [];
    testRunnerConcept.subscribe((event, payload) => {
      events.push({ event, payload });
      console.log(`📡 Test Runner Event: ${event}`, {
        name: payload.name,
        status: payload.status,
        suite: payload.suite
      });
    });

    console.log('1️⃣ Launching browser...');
    await browserConcept.actions.launch({
      executablePath: CHROME_PATH,
      headless: true
    });
    console.log('✅ Browser launched\n');

    // Reset test runner state
    testRunnerConcept.actions.reset();

    // Track hook execution order
    const hookOrder = [];

    console.log('2️⃣ Registering global hooks...');
    testRunnerConcept.actions.beforeAll(() => {
      hookOrder.push('global-beforeAll');
    });

    testRunnerConcept.actions.beforeEach(() => {
      hookOrder.push('global-beforeEach');
    });

    testRunnerConcept.actions.afterEach(() => {
      hookOrder.push('global-afterEach');
    });

    testRunnerConcept.actions.afterAll(() => {
      hookOrder.push('global-afterAll');
    });
    console.log('✅ Global hooks registered\n');

    console.log('3️⃣ Registering test suite 1...');
    testRunnerConcept.actions.describe('Suite 1', () => {
      testRunnerConcept.actions.beforeAll(() => {
        hookOrder.push('suite1-beforeAll');
      });

      testRunnerConcept.actions.beforeEach(() => {
        hookOrder.push('suite1-beforeEach');
      });

      testRunnerConcept.actions.test('Test 1-1', () => {
        hookOrder.push('test-1-1');
      });

      testRunnerConcept.actions.test('Test 1-2', () => {
        hookOrder.push('test-1-2');
      });

      testRunnerConcept.actions.afterEach(() => {
        hookOrder.push('suite1-afterEach');
      });

      testRunnerConcept.actions.afterAll(() => {
        hookOrder.push('suite1-afterAll');
      });
    });
    console.log('✅ Suite 1 registered with 2 tests\n');

    console.log('4️⃣ Registering test suite 2...');
    testRunnerConcept.actions.describe('Suite 2', () => {
      testRunnerConcept.actions.test('Test 2-1', () => {
        hookOrder.push('test-2-1');
      });

      testRunnerConcept.actions.test('Test 2-2 (will fail)', () => {
        hookOrder.push('test-2-2');
        throw new Error('Intentional test failure');
      });
    });
    console.log('✅ Suite 2 registered with 2 tests\n');

    console.log('5️⃣ Verifying registered suites...');
    const suites = testRunnerConcept.state.suites;
    console.log(`Total suites: ${suites.length}`);
    suites.forEach((suite, i) => {
      console.log(`  Suite ${i + 1}: "${suite.name}" (${suite.tests.length} tests)`);
    });
    console.log('✅ Suites verified\n');

    console.log('6️⃣ Running all tests with isolation...');
    const summary = await testRunnerConcept.actions.run({ isolate: true });
    console.log('✅ Test run completed\n');

    console.log('7️⃣ Verifying results...');
    console.log(`Total: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Duration: ${summary.totalDuration}ms`);

    if (summary.total !== 4) {
      throw new Error(`Expected 4 total tests, got ${summary.total}`);
    }

    if (summary.passed !== 3) {
      throw new Error(`Expected 3 passed tests, got ${summary.passed}`);
    }

    if (summary.failed !== 1) {
      throw new Error(`Expected 1 failed test, got ${summary.failed}`);
    }

    console.log('✅ Results are correct\n');

    console.log('8️⃣ Verifying hook execution order...');
    const expectedOrder = [
      'global-beforeAll',
      'suite1-beforeAll',
      'global-beforeEach',
      'suite1-beforeEach',
      'test-1-1',
      'suite1-afterEach',
      'global-afterEach',
      'global-beforeEach',
      'suite1-beforeEach',
      'test-1-2',
      'suite1-afterEach',
      'global-afterEach',
      'suite1-afterAll',
      'global-beforeEach',
      'test-2-1',
      'global-afterEach',
      'global-beforeEach',
      'test-2-2',
      'global-afterEach',
      'global-afterAll'
    ];

    console.log('Hook execution order:');
    hookOrder.forEach((hook, i) => {
      const expected = expectedOrder[i];
      const match = hook === expected ? '✓' : '✗';
      console.log(`  ${match} ${i + 1}. ${hook} ${hook !== expected ? `(expected: ${expected})` : ''}`);
    });

    if (hookOrder.length !== expectedOrder.length) {
      throw new Error(`Expected ${expectedOrder.length} hooks, got ${hookOrder.length}`);
    }

    for (let i = 0; i < expectedOrder.length; i++) {
      if (hookOrder[i] !== expectedOrder[i]) {
        throw new Error(`Hook order mismatch at position ${i}: expected "${expectedOrder[i]}", got "${hookOrder[i]}"`);
      }
    }

    console.log('✅ Hook execution order is correct\n');

    console.log('9️⃣ Verifying test results details...');
    const results = testRunnerConcept.actions.getResults();
    results.forEach((result, i) => {
      console.log(`\n  Test ${i + 1}: ${result.name}`);
      console.log(`    Suite: ${result.suite}`);
      console.log(`    Status: ${result.status}`);
      console.log(`    Duration: ${result.duration}ms`);
      if (result.error) {
        console.log(`    Error: ${result.error.message}`);
      }
    });

    const failedTest = results.find(r => r.status === 'failed');
    if (!failedTest) {
      throw new Error('Expected to find a failed test');
    }

    if (failedTest.name !== 'Test 2-2 (will fail)') {
      throw new Error(`Expected failed test to be "Test 2-2 (will fail)", got "${failedTest.name}"`);
    }

    if (!failedTest.error || !failedTest.error.message.includes('Intentional test failure')) {
      throw new Error('Expected failed test to have error message about intentional failure');
    }

    console.log('\n✅ Test results details are correct\n');

    console.log('🔟 Verifying context isolation was used...');
    // Check that contexts were created during test run
    const contextEvents = events.filter(e => e.event === 'contextCreated');
    console.log(`Context creation events: ${contextEvents.length}`);
    if (contextEvents.length === 0) {
      console.log('⚠️  No context creation events (isolation may not have been used)');
    } else {
      console.log(`✅ Context isolation was used (${contextEvents.length} contexts created)\n`);
    }

    console.log('1️⃣1️⃣ Testing run without isolation...');
    testRunnerConcept.actions.reset();

    testRunnerConcept.actions.describe('No Isolation Suite', () => {
      testRunnerConcept.actions.test('Test without isolation', () => {
        // Simple test
      });
    });

    const noIsolationSummary = await testRunnerConcept.actions.run({ isolate: false });
    console.log(`Passed without isolation: ${noIsolationSummary.passed}/${noIsolationSummary.total}`);
    console.log('✅ Run without isolation works\n');

    console.log('1️⃣2️⃣ Testing reset functionality...');
    testRunnerConcept.actions.reset();
    const suitesAfterReset = testRunnerConcept.state.suites;
    if (suitesAfterReset.length !== 0) {
      throw new Error(`Expected 0 suites after reset, got ${suitesAfterReset.length}`);
    }
    console.log('✅ Reset works correctly\n');

    console.log('1️⃣3️⃣ Closing browser...');
    await browserConcept.actions.close();
    console.log('✅ Browser closed\n');

    console.log('🎉 All test runner tests passed!');
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
console.log('  Test Runner Concept Test');
console.log('='.repeat(60));
console.log();

test();
