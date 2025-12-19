export function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

export function it(name, testFn) {
  try {
    testFn();
    console.log(`  ✓ PASS: ${name}`);
  } catch (error) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(error);
    process.exit(1);
  }
}