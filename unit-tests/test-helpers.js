import { SetupError, TeardownError } from '../shared-test-utils/errors.js';

export function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

export function test(name, testFn) {
  try {
    testFn();
    console.log(`  ✓ PASS: ${name}`);
  } catch (error) {
    console.error(`  ✗ FAIL: ${name}`);
    // Enhanced error output for structured errors
    if (error.toJSON) {
      console.error(JSON.stringify(error.toJSON(), null, 2));
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Legacy alias for backwards compatibility
export const it = test;