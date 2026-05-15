// Test helpers. describe/it append to a per-file promise chain so tests run
// sequentially even when their bodies are async — important when tests share
// module state (Storage._test, mockDbStore, etc.). The chain keeps the Node
// event loop busy until every queued test settles, so the file's exit code
// reflects all results.

let testChain = Promise.resolve();

export function describe(name, fn) {
  testChain = testChain.then(() => {
    console.log(`\n${name}`);
  });
  // fn body runs synchronously here; any it() calls inside append to the
  // chain in declaration order.
  fn();
}

export function it(name, testFn) {
  testChain = testChain.then(async () => {
    try {
      await testFn();
      console.log(`  ✓ PASS: ${name}`);
    } catch (error) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(error);
      process.exit(1);
    }
  });
}
