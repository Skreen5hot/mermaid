# Simplified Test Strategy: Process-Isolated Testing

## 1. What: The Core Idea

Our previous testing strategy suffered from state pollution, where tests interfered with one another, leading to flaky results and complex reset logic. This new strategy abandons the shared-process model in favor of **process-level isolation**.

The core idea is simple and powerful: **Every single `*.test.js` file is executed in its own, separate Node.js process.**

This approach provides the ultimate test isolation. Since no memory or state is shared between test files, it is impossible for one test file to "contaminate" another. This eliminates the need for manual `reset()` functions on concepts and complex `beforeEach` hooks for cleanup between files.

## 2. How: The Implementation

The new infrastructure is even simpler than before and consists of two key parts.

### a. `run-tests.js` (The Test Runner)

This is the sole entry point for running the entire test suite. It has one job: find all test files and run each one in a dedicated child process.

-   **Discovery**: It uses Node.js's `fs` module to recursively find all files ending in `.test.js` within the `unit-tests/` directory.
-   **Execution**: For each test file found, it spawns a new `node` child process using `child_process.spawn`.
-   **Reporting**:
    -   It captures the `stdout` and `stderr` from the child process and streams it directly to the console, so you see the output from `describe` and `it` blocks in real-time.
    -   It monitors the exit code of the child process. An exit code of `0` signifies that all tests in the file passed. A non-zero exit code signifies a failure.
-   **Summary**: After all files have been run, it prints a final summary of which files passed and which failed.
-   **CI/CD Integration**: If any test file fails (exits with a non-zero code), the main `run-tests.js` script will exit with `process.exit(1)`, ensuring that CI pipelines correctly detect the failure.

### b. `*.test.js` (The Tests)

Test files are now completely self-contained. They no longer depend on a global runner or implicit setup.

-   **Setup**: Each test file is responsible for its own setup. This includes importing an `assert` utility and the concepts it needs to test.
-   **Structure**: The familiar `describe` and `test` syntax can still be used for organizational purposes, but they can be implemented as simple functions that just print to the console.
-   **Failure Handling**: The key change is how failures are handled. Inside a `test` block, if an assertion fails, the error is caught, a "FAIL" message is logged, and the process is terminated immediately with `process.exit(1)`. This is the signal to the `run-tests.js` parent process that this test file has failed.

Here is a conceptual example of a simple `test` function:

```javascript
// Inside a test file or a shared 'test-utils.js'
export function test(name, testFn) {
  try {
    testFn();
    console.log(`  ✓ PASS: ${name}`);
  } catch (error) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(error);
    process.exit(1); // <-- Critical for signaling failure
  }
}
```

## 3. Why: The Rationale

This process-isolated approach directly addresses the failures of the previous strategy.

-   **Guaranteed Isolation**: By using separate processes, we eliminate all forms of test pollution between files—no more shared global state, no more singleton instances carrying state from one test to the next. Tests are stable and predictable.

-   **Radical Simplicity**: The need for complex `reset()` logic on our concepts is completely gone. The `run-tests.js` file, which implicitly coupled all tests together, is also eliminated. The test runner becomes a simple process manager, and test files become simple, standalone scripts.

-   **Zero Dependencies**: This strategy maintains our goal of a zero-dependency testing framework. It uses only built-in Node.js modules (`fs`, `path`, `child_process`).

-   **Maintainability**: When a test fails, it is contained to its own process. Debugging is easier because you can run the failing file directly (`node unit-tests/concepts/my-failing.test.js`) and know that no other file is influencing its environment.

## 4. Handling Mocks and the DOM

The challenge of mocking browser-specific APIs like `document` and `localStorage` in a Node.js environment remains. However, the new strategy simplifies how we manage them.

-   **Local Mocks**: Instead of a single, massive `setupMockDOM()` function that pollutes the global scope for all tests, each test file that needs a DOM will be responsible for setting up its own mock environment.
-   **Shared Mock Utilities**: Common mocking logic (like creating a mock element) can be placed in a shared utility file (e.g., `unit-tests/test-utils.js`) and imported by the test files that need it.

This ensures that a test file only creates the mocks it explicitly needs, and those mocks are automatically destroyed when the process exits, leaving a clean slate for the next test file.

This revised strategy provides a much more resilient and scalable foundation for testing, ensuring our tests remain a reliable asset rather than a source of maintenance headaches.

## 5. Lessons Learned: Taming State and Asynchronicity

While the process-isolated strategy provides a robust foundation, our experience with implementing the test suite revealed critical patterns necessary for writing stable tests, especially for stateful, asynchronous modules like `storageConcept`.

### The Singleton Challenge

Process isolation prevents state from leaking between test *files*. However, it does not prevent state from leaking between `test` blocks *within the same file*. Since our concepts are implemented as singletons, importing `storageConcept` once means the same instance (and its state, like an open database connection) is shared across all tests in that file.

### The Golden Rule: Isolate Every `test` Block

The solution to singleton state pollution is a strict and non-negotiable pattern: **a setup/reset function must be called at the beginning of every single `test` block.**

```javascript
// GOOD: Guarantees a clean slate for every test.
test('should do something', () => {
  beforeEach(); // Reset state at the start of the test.
  // ... test logic
});
```

This ensures that no residual state from a previous test can cause a subsequent test to fail, which was the root cause of the instability we saw with the `storageConcept` tests.

### The Integration Mocking Trap

Mocks for unit tests can be simple, but mocks for integration tests must be much more complete. Our `synchronizations.test.js` file required a mock `IndexedDB` that supported `index()` and `put()` methods, whereas the simpler unit tests did not. This is because integration tests exercise deeper and more complex code paths. The strategy must account for evolving mocks as integration coverage grows.

## 6. Enhanced Features: Error Types and Cleanup Guarantees

### Structured Error Types

The framework now provides typed errors with rich context for better debugging and AI agent integration:

**Available Error Types** (from `shared-test-utils/errors.js`):
- **`AssertionError`**: Enhanced assertions with expected/actual/diff
- **`TimeoutError`**: For async operation timeouts
- **`SetupError`**: For beforeEach/beforeAll failures
- **`TeardownError`**: For afterEach/afterAll failures

All error types include:
- Machine-readable JSON representation (`toJSON()` method)
- Structured context (expected, actual, operation, timeout, etc.)
- Proper stack traces for debugging

**Example Usage:**
```javascript
import { AssertionError } from '../shared-test-utils/errors.js';

if (actual !== expected) {
  throw new AssertionError({
    message: 'Values are not equal',
    expected,
    actual,
    matcher: 'strictEqual',
    diff: `Expected: ${expected}\nActual:   ${actual}`
  });
}
```

### Guaranteed Cleanup with `afterEach`

The framework now supports `afterEach` hooks that are **guaranteed to run** even if tests fail:

```javascript
describe('Database Tests', () => {
  let db;

  beforeEach(async () => {
    db = await openDatabase();
  });

  afterEach(async () => {
    // ALWAYS runs, even if test fails
    if (db) {
      await db.close();
    }
  });

  test('should query data', async () => {
    const result = await db.query('SELECT * FROM users');
    assert.ok(result.length > 0);
  });
});
```

**Key Features:**
- Cleanup runs in `finally` block (guaranteed execution)
- Teardown errors are captured and reported separately
- If test passes but cleanup fails, test is marked as failed
- Prevents resource leaks in long-running test suites

### Enhanced Test Metrics

The test runner now tracks individual test counts, not just file counts:

**Console Output:**
```
📊 File Results: 13/13 passed (100.0%)
📋 Test Results: 45/45 individual tests passed (100.0%)
⏱️  Total Duration: 459ms
```

**JSON Report Structure:**
```json
{
  "summary": {
    "files": {
      "total": 13,
      "passed": 13,
      "failed": 0,
      "passRate": 100
    },
    "tests": {
      "total": 45,
      "passed": 45,
      "failed": 0,
      "passRate": 100
    },
    "duration": 459
  },
  "results": [
    {
      "file": "/unit-tests/assert.test.js",
      "status": "passed",
      "duration": 220,
      "tests": {
        "total": 5,
        "passed": 5,
        "failed": 0
      }
    }
  ]
}
```

### CI/CD Integration

GitHub Actions now generates test reports and workflow summaries:

**Workflow Summary:**
- Displays file and test pass rates
- Shows duration metrics
- Uploads JSON reports as artifacts
- Available for download and trend analysis

**Usage:**
```bash
# Generate JSON report
npm test -- --write-json

# JSON-only output (for CI/CD)
npm test -- --json
```
