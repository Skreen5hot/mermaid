# Unit Testing Framework

A lightweight, zero-dependency testing framework optimized for testing the Mermaid IDE's **Concepts and Synchronizations** architecture. Built with process-level isolation and structured error reporting for reliable, maintainable tests.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Writing Tests](#writing-tests)
- [Running Tests](#running-tests)
- [Features](#features)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Running Tests

```bash
# Run all tests
npm test

# Run all tests with JSON report
npm test -- --write-json

# Run specific test file
npm test unit-tests/concepts/diagramConcept.test.js

# JSON-only output (for CI/CD)
npm test -- --json
```

### Writing Your First Test

```javascript
import { describe, test, assert, beforeEach, afterEach } from '../test-utils.js';
import { myConcept } from '../../src/concepts/myConcept.js';

describe('My Concept', () => {
  beforeEach(() => {
    // Reset state before each test
    myConcept.state.data = [];
  });

  afterEach(() => {
    // Cleanup after each test (guaranteed to run)
    myConcept.cleanup();
  });

  test('should initialize with empty state', () => {
    assert.deepStrictEqual(myConcept.state.data, []);
  });

  test('should add item to state', () => {
    myConcept.actions.addItem({ id: 1, name: 'Test' });
    assert.strictEqual(myConcept.state.data.length, 1);
  });
});
```

---

## Architecture

### Process-Level Isolation

Each test **file** runs in its own isolated Node.js process:

```
┌─────────────────────────────────────────┐
│  run-tests.js (Parent Process)          │
│  • Discovers test files                 │
│  • Spawns child processes                │
│  • Aggregates results                    │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
    ┌───▼───┐ ┌──▼───┐ ┌──▼───┐
    │Test 1 │ │Test 2│ │Test 3│
    │Process│ │Process│ │Process│
    └───────┘ └──────┘ └──────┘
    Isolated   Isolated Isolated
     Memory     Memory   Memory
```

**Benefits:**
- ✅ No shared state between test files
- ✅ Singleton concepts can't leak state across files
- ✅ Parallel execution for speed
- ✅ Automatic cleanup on process exit

**Limitation:**
- ⚠️ Tests **within** the same file share memory (use `beforeEach` to reset state)

---

## Writing Tests

### Test Structure

```javascript
describe('Suite Name', () => {
  beforeEach(() => {
    // Setup before EACH test
  });

  afterEach(() => {
    // Cleanup after EACH test (guaranteed)
  });

  test('should do something', () => {
    // Test implementation
  });

  test('should do something else', async () => {
    // Async tests supported
    const result = await asyncOperation();
    assert.ok(result);
  });
});
```

### Available Assertions

```javascript
import { assert } from '../test-utils.js';

// Boolean checks
assert.ok(value, 'message');              // Truthy check
assert.isTrue(value);                      // Strict true
assert.isFalse(value);                     // Strict false

// Equality
assert.strictEqual(actual, expected);      // ===
assert.deepStrictEqual(obj1, obj2);        // Deep object equality

// Null checks
assert.isNull(value);
assert.isNotNull(value);

// Type checks
assert.instanceOf(obj, Constructor);

// Comparisons
assert.isAbove(10, 5);                     // 10 > 5
assert.isBelow(5, 10);                     // 5 < 10

// String/Array inclusion
assert.include('hello world', 'world');
assert.include([1, 2, 3], 2);
```

### Structured Error Types

```javascript
import { AssertionError, TimeoutError, SetupError, TeardownError }
  from '../shared-test-utils/errors.js';

// Enhanced assertion error with context
throw new AssertionError({
  message: 'Values do not match',
  expected: 5,
  actual: 10,
  matcher: 'strictEqual',
  diff: 'Expected: 5\nActual:   10'
});

// Timeout error for async operations
throw new TimeoutError({
  operation: 'Database query',
  timeout: 5000,
  selector: '#user-data',  // Optional
  context: { userId: 123 } // Optional
});
```

All errors include:
- Machine-readable JSON via `toJSON()` method
- Structured context for debugging
- Proper stack traces

---

## Running Tests

### Command Line Options

```bash
# Standard run (console output)
npm test

# Generate JSON report file
npm test -- --write-json
# Creates: unit-test-results.json

# JSON-only output (no console, for CI/CD)
npm test -- --json

# Run specific file
npm test unit-tests/concepts/myTest.test.js

# Run specific file with JSON
npm test unit-tests/concepts/myTest.test.js -- --write-json
```

### Output Formats

**Console Output:**
```
--- Test Summary ---
✅ PASSED: /unit-tests/assert.test.js (668ms) [5/5 tests]
✅ PASSED: /unit-tests/utils/eventBus.test.js (1054ms) [4/4 tests]

📊 File Results: 13/13 passed (100.0%)
📋 Test Results: 9/9 individual tests passed (100.0%)
⏱️  Total Duration: 1473ms
```

**JSON Report Structure:**
```json
{
  "timestamp": "2025-12-19T11:11:41.173Z",
  "summary": {
    "files": {
      "total": 13,
      "passed": 13,
      "failed": 0,
      "passRate": 100
    },
    "tests": {
      "total": 9,
      "passed": 9,
      "failed": 0,
      "passRate": 100
    },
    "duration": 1473
  },
  "results": [
    {
      "file": "/unit-tests/assert.test.js",
      "status": "passed",
      "duration": 668,
      "tests": {
        "total": 5,
        "passed": 5,
        "failed": 0
      }
    }
  ]
}
```

---

## Features

### 1. Guaranteed Cleanup

`afterEach` hooks **always run**, even if tests fail:

```javascript
describe('Database Tests', () => {
  let connection;

  beforeEach(async () => {
    connection = await database.connect();
  });

  afterEach(async () => {
    // GUARANTEED to run, even on test failure
    if (connection) {
      await connection.close();
    }
  });

  test('should query data', async () => {
    // If this fails, afterEach still runs
    const data = await connection.query('SELECT * FROM users');
    assert.ok(data.length > 0);
  });
});
```

### 2. Process-Level Isolation

Each test file runs in complete isolation:

```javascript
// File: test1.test.js
global.sharedVar = 'test1';

// File: test2.test.js
console.log(global.sharedVar); // undefined - different process!
```

### 3. Individual Test Counting

The framework tracks both file-level and test-level metrics:

```
📊 File Results: 13/13 passed (100.0%)
📋 Test Results: 45/45 individual tests passed (100.0%)
```

### 4. Structured Error Reporting

Errors include rich context for debugging:

```javascript
{
  "name": "AssertionError",
  "message": "Values are not strictly equal",
  "expected": 5,
  "actual": 10,
  "matcher": "strictEqual",
  "diff": "Expected: 5\nActual:   10",
  "stack": "..."
}
```

### 5. CI/CD Integration

GitHub Actions workflow automatically:
- Generates JSON test reports
- Uploads reports as artifacts
- Creates workflow summary with metrics
- Fails build on test failure

---

## Best Practices

### The Golden Rule: Reset State in `beforeEach`

Since concepts are singletons, **always** reset state before each test:

```javascript
// ❌ BAD: State leaks between tests
describe('Storage Concept', () => {
  test('first test', () => {
    storageConcept.state.db = mockDB;
    // Test passes
  });

  test('second test', () => {
    // ⚠️ state.db still has mockDB from first test!
    assert.isNull(storageConcept.state.db); // FAILS
  });
});

// ✅ GOOD: Clean slate for every test
describe('Storage Concept', () => {
  beforeEach(() => {
    storageConcept.state.db = null; // Reset!
  });

  test('first test', () => {
    storageConcept.state.db = mockDB;
    // Test passes
  });

  test('second test', () => {
    // ✅ state.db is null (reset by beforeEach)
    assert.isNull(storageConcept.state.db); // PASSES
  });
});
```

### Mocking Strategy

Each test file is responsible for its own mocks:

```javascript
// Local mocks - isolated to this file
let mockDB = {
  get: () => Promise.resolve({ id: 1 }),
  put: () => Promise.resolve()
};

beforeEach(() => {
  // Reset mocks before each test
  mockDB.get = () => Promise.resolve({ id: 1 });
  global.indexedDB = mockIndexedDB;
});

afterEach(() => {
  // Cleanup mocks after each test
  delete global.indexedDB;
});
```

### Async Tests

Always use `async/await` for asynchronous operations:

```javascript
test('should fetch data asynchronously', async () => {
  const data = await storageConcept.actions.getData();
  assert.ok(data);
});
```

### Test Organization

```
unit-tests/
├── concepts/           # Tests for individual concepts
│   ├── diagramConcept.test.js
│   ├── storageConcept.test.js
│   └── uiConcept.test.js
├── synchronizations/   # Tests for concept interactions
│   ├── synchronizations.test.js
│   └── synchronizations.flows.test.js
├── utils/             # Tests for utility functions
│   └── eventBus.test.js
├── test-utils.js      # Main test framework
├── test-helpers.js    # Simple test helpers
└── README.md          # This file
```

---

## API Reference

### Test Functions

#### `describe(name, fn)`
Groups related tests into a suite.

```javascript
describe('My Feature', () => {
  // Tests go here
});
```

#### `test(name, fn)` (alias: `it`)
Defines an individual test case.

```javascript
test('should do something', () => {
  // Test code
});

// Async version
test('should do something async', async () => {
  await someAsyncOperation();
});
```

### Lifecycle Hooks

#### `beforeEach(fn)`
Runs before each test in the current `describe` block.

```javascript
beforeEach(() => {
  // Setup code
});

beforeEach(async () => {
  // Async setup
  await setupDatabase();
});
```

#### `afterEach(fn)`
Runs after each test (guaranteed, even on failure).

```javascript
afterEach(() => {
  // Cleanup code (ALWAYS runs)
});

afterEach(async () => {
  // Async cleanup
  await teardownDatabase();
});
```

### Assertion Library

See [Available Assertions](#available-assertions) section above.

### Error Types

#### `AssertionError`
```javascript
new AssertionError({
  message: string,
  expected: any,
  actual: any,
  matcher: string,
  diff: string
})
```

#### `TimeoutError`
```javascript
new TimeoutError({
  operation: string,
  timeout: number,
  selector?: string,
  context?: object
})
```

#### `SetupError`
Thrown when `beforeEach` hook fails.

```javascript
new SetupError({
  hook: 'beforeEach',
  originalError: Error,
  testName: string
})
```

#### `TeardownError`
Thrown when `afterEach` hook fails.

```javascript
new TeardownError({
  hook: 'afterEach',
  originalError: Error,
  testName: string
})
```

---

## Troubleshooting

### Tests Pass Individually But Fail Together

**Cause:** State leaking between tests in the same file.

**Solution:** Add `beforeEach` hook to reset state:

```javascript
beforeEach(() => {
  myConcept.state.data = [];
  myConcept.state.cache = null;
});
```

### "Cannot find module" Errors

**Cause:** Incorrect relative import path.

**Solution:** Check your import paths:
```javascript
// ✅ Correct
import { describe, test, assert } from '../test-utils.js';
import { myConcept } from '../../src/concepts/myConcept.js';

// ❌ Wrong
import { describe, test, assert } from './test-utils.js';
```

### Tests Hang or Don't Exit

**Cause:** Open database connections, timers, or async operations not cleaned up.

**Solution:** Use `afterEach` for guaranteed cleanup:

```javascript
afterEach(async () => {
  if (db) await db.close();
  clearTimeout(timer);
});
```

### Mock Not Working

**Cause:** Mock created outside `beforeEach` and shared across tests.

**Solution:** Create mocks in `beforeEach`:

```javascript
let mockDB;

beforeEach(() => {
  mockDB = { /* fresh mock */ };
  global.indexedDB = mockDB;
});
```

### Process Exit Code 1 But All Tests Pass

**Cause:** `afterEach` cleanup hook is failing.

**Solution:** Check console for "⚠ Cleanup error" messages and fix the cleanup logic.

---

## Directory Structure

```
unit-tests/
├── concepts/                    # Concept tests
│   ├── diagramConcept.test.js   # Diagram state management
│   ├── projectConcept.test.js   # Project state management
│   ├── storageConcept.test.js   # IndexedDB persistence
│   ├── uiConcept.test.js        # DOM manipulation
│   ├── security.concept.test.js # Password & encryption
│   ├── sync.service.test.js     # Git sync service
│   ├── github.adapter.test.js   # GitHub API adapter
│   └── gitlab.adapter.test.js   # GitLab API adapter
├── utils/                       # Utility tests
│   └── eventBus.test.js         # Event bus implementation
├── synchronizations.test.js     # Integration tests
├── synchronizations.flows.test.js  # User flow tests
├── synchronizations.deletion.test.js  # Deletion flows
├── assert.test.js               # Assertion library tests
├── test-utils.js                # Main test framework
├── test-helpers.js              # Simple test helpers
└── README.md                    # This file
```

---

## Related Documentation

- [Test Strategy](../testStrategy.md) - Detailed testing philosophy and patterns
- [UI Testing Framework](../ui-test-framework/README.md) - Browser-based E2E tests
- [Shared Error Types](../shared-test-utils/errors.js) - Error type definitions
- [GitHub Actions Workflow](../.github/workflows/ci.yml) - CI/CD integration

---

## Contributing

When adding new tests:

1. **Follow the naming convention**: `*.test.js`
2. **Use `beforeEach` for state reset** (mandatory for stateful tests)
3. **Add `afterEach` for cleanup** (if resources are allocated)
4. **Import from `test-utils.js`** for full features
5. **Test both success and failure cases**
6. **Keep tests focused** (one concept per test)

---

## License

MIT License - Same as parent project.
