# Lightweight UI Testing Framework

A minimal, deterministic UI automation framework optimized for AI agent interaction. Built following the **Concepts + Synchronizations** architecture pattern for maximum modularity, testability, and legibility.

## Features

- **Deterministic Behavior**: Predictable failure modes with no implicit retries or heuristics
- **Minimal Dependencies**: Direct CDP integration with optional helper library
- **Agentic Observability**: Structured trace logging for AI debugging workflows
- **Lightweight Implementation**: Focused feature set with clean abstractions
- **Test Isolation**: Fresh browser context per test to prevent cross-test contamination
- **Modular Architecture**: Each feature is an independent concept with pure functions

## Installation

```bash
npm install @agentic/ui-test-framework
```

### Prerequisites

- Node.js 18.0.0 or higher
- Chromium-based browser (Chrome, Chromium, or Edge)

### Optional Dependencies

For enhanced CDP communication:

```bash
npm install chrome-remote-interface
```

## Quick Start

```javascript
import {
  launch,
  navigate,
  waitForSelector,
  type,
  click,
  getText,
  expect,
  describe,
  test,
  beforeAll,
  afterAll
} from '@agentic/ui-test-framework';

describe('Login Flow', () => {
  let browser;

  beforeAll(async () => {
    browser = await launch({
      executablePath: '/usr/bin/chromium',
      headless: true
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  test('should successfully log in with valid credentials', async () => {
    await navigate('http://localhost:3000/login');

    await waitForSelector('#username', { timeout: 5000 });
    await type('#username', 'testuser@example.com');
    await type('#password', 'SecurePass123');

    await click('#login-button');

    await waitForSelector('#dashboard', { timeout: 10000 });
    const heading = await getText('h1');
    expect(heading).toContain('Welcome');
  });
});
```

## API Reference

### Browser Lifecycle

#### `launch(config)`

Launch a browser instance.

**Parameters:**
- `config.executablePath` (string, required): Path to browser binary
- `config.headless` (boolean, default: true): Run in headless mode
- `config.devtools` (boolean, default: false): Auto-open DevTools
- `config.viewport` (object): Initial viewport size
  - `width` (number, default: 1280)
  - `height` (number, default: 720)

**Returns:** Browser instance

**Example:**
```javascript
const browser = await launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  viewport: { width: 1920, height: 1080 }
});
```

#### `close()`

Gracefully close the browser and cleanup resources.

**Returns:** Promise<void>

---

### Navigation

#### `navigate(url, options)`

Navigate to a URL with optional wait condition.

**Parameters:**
- `url` (string): Target URL
- `options.loadState` (string): Wait condition
  - `'load'`: DOM loaded
  - `'domcontentloaded'`: DOM ready
  - `'networkidle'`: No network activity for 500ms

**Returns:** Promise<void>

**Example:**
```javascript
await navigate('http://localhost:3000', { loadState: 'networkidle' });
```

#### `getCurrentUrl()`

Get the current page URL.

**Returns:** string

---

### DOM Interaction

#### `click(selector)`

Click element at its center point.

**Parameters:**
- `selector` (string): CSS selector

**Throws:**
- `ElementNotFoundError`: Element doesn't exist
- `ElementNotInteractableError`: Element is hidden or disabled

**Example:**
```javascript
await click('#submit-button');
```

#### `type(selector, text, options)`

Type text into an element.

**Parameters:**
- `selector` (string): CSS selector
- `text` (string): Text to type
- `options.delay` (number): Delay between keystrokes in ms

**Example:**
```javascript
await type('#email', 'user@example.com', { delay: 50 });
```

#### `select(selector, value)`

Select dropdown option by value.

**Parameters:**
- `selector` (string): CSS selector for <select> element
- `value` (string): Option value to select

#### `check(selector)` / `uncheck(selector)`

Toggle checkbox state.

**Parameters:**
- `selector` (string): CSS selector for checkbox

---

### DOM Queries

#### `getAttribute(selector, attribute)`

Get element attribute value.

**Parameters:**
- `selector` (string): CSS selector
- `attribute` (string): Attribute name

**Returns:** Promise<string | null>

#### `getText(selector)`

Get trimmed text content of element.

**Parameters:**
- `selector` (string): CSS selector

**Returns:** Promise<string>

**Example:**
```javascript
const heading = await getText('h1');
expect(heading).toBe('Welcome');
```

#### `isVisible(selector)`

Check if element is visible.

**Parameters:**
- `selector` (string): CSS selector

**Returns:** Promise<boolean>

#### `exists(selector)`

Check if element exists in DOM.

**Parameters:**
- `selector` (string): CSS selector

**Returns:** Promise<boolean>

---

### Wait Functions

All wait functions require an explicit timeout. They poll every 100ms (not configurable for determinism).

#### `waitForSelector(selector, options)`

Wait for element to exist (and optionally be visible).

**Parameters:**
- `selector` (string): CSS selector
- `options.timeout` (number, required): Timeout in milliseconds
- `options.visible` (boolean, default: false): Wait for visibility

**Throws:** `TimeoutError` if timeout is exceeded

**Example:**
```javascript
await waitForSelector('#modal', { timeout: 5000, visible: true });
```

#### `waitForText(selector, text, options)`

Wait for element text to match.

**Parameters:**
- `selector` (string): CSS selector
- `text` (string): Expected text
- `options.timeout` (number, required): Timeout in milliseconds
- `options.exact` (boolean, default: false): Exact match vs substring

**Example:**
```javascript
await waitForText('.status', 'Success', { timeout: 3000, exact: true });
```

#### `waitForHidden(selector, options)`

Wait for element to be hidden or removed from DOM.

**Parameters:**
- `selector` (string): CSS selector
- `options.timeout` (number, required): Timeout in milliseconds

---

### Test Structure

#### `describe(name, fn)`

Define a test suite.

**Parameters:**
- `name` (string): Suite name
- `fn` (function): Suite definition function

#### `test(name, fn)`

Define a test case.

**Parameters:**
- `name` (string): Test name
- `fn` (async function): Test implementation

---

### Lifecycle Hooks

#### `beforeAll(fn)`

Run once before all tests in suite.

#### `afterAll(fn)`

Run once after all tests in suite.

#### `beforeEach(fn)`

Run before each test (context isolation happens here).

#### `afterEach(fn)`

Run after each test (cleanup, logging).

---

### Assertions

#### `expect(actual)`

Create an expectation wrapper with fluent API.

**Methods:**
- `.toBe(expected)`: Strict equality (===)
- `.toContain(substring)`: String/array inclusion
- `.toBeTruthy()`: Boolean coercion to true
- `.toBeFalsy()`: Boolean coercion to false
- `.toExist()`: Element exists (DOM selectors)
- `.toBeVisible()`: Element is visible (DOM selectors)

**Throws:** `AssertionError` on failure with expected/actual/diff

**Example:**
```javascript
expect(5).toBe(5);
expect('hello world').toContain('world');
expect(true).toBeTruthy();
```

---

## Error Handling

### Error Types

| Error | Trigger | Fatal? |
|-------|---------|--------|
| `BrowserCrashError` | Browser process terminates | Yes |
| `TimeoutError` | Wait exceeds timeout | No |
| `SelectorError` | Invalid CSS selector | No |
| `ElementNotFoundError` | Element doesn't exist | No |
| `ElementNotInteractableError` | Element hidden/disabled | No |
| `AssertionError` | Assertion fails | No |
| `NavigationError` | Page load fails | No |

### Structured Error Context

All errors include machine-readable context:

```javascript
{
  errorType: "TimeoutError",
  selector: "#non-existent",
  timeout: 5000,
  action: "waitForSelector",
  pageUrl: "http://localhost:3000",
  viewport: { width: 1280, height: 720 },
  recentTrace: [ /* last 10 actions */ ]
}
```

---

## Trace Logging

Every action is logged as structured JSON for AI agent analysis:

```javascript
{
  timestamp: 1702834567890,
  sequenceId: 15,
  action: "click",
  selector: "#submit-button",
  success: true,
  duration: 45,
  context: {
    url: "http://localhost:3000/form",
    viewport: { width: 1280, height: 720 },
    elementSnapshot: {
      tag: "button",
      text: "Submit",
      visible: true,
      attributes: { class: "btn-primary", type: "submit" }
    }
  }
}
```

### Access Trace Programmatically

```javascript
import { getTrace } from '@agentic/ui-test-framework';

const recentActions = getTrace(10); // Last 10 actions
```

---

## Test Reports

Two output formats are generated:

### 1. Console Output (Real-time)

```
============================================================
  Test Results
============================================================
✓ Login Flow > should log in successfully (1234ms)
✗ Login Flow > should show error for invalid credentials (567ms)
  Error: Expected ".error" to contain "Invalid credentials"
============================================================
Total: 2
Passed: 1
Failed: 1
Duration: 1801ms
============================================================
```

### 2. JSON Report (results.json)

```json
{
  "summary": {
    "total": 2,
    "passed": 1,
    "failed": 1,
    "duration": 1801,
    "timestamp": 1702834567890
  },
  "tests": [
    {
      "suite": "Login Flow",
      "name": "should log in successfully",
      "status": "passed",
      "duration": 1234,
      "error": null
    }
  ]
}
```

---

## Configuration

Create a configuration file for common settings:

```javascript
// test.config.js
export default {
  browserExecutablePath: '/usr/bin/chromium',
  headless: true,
  defaultTimeout: 5000,
  viewport: {
    width: 1280,
    height: 720
  },
  outputDir: './test-results',
  traceLog: true,
  loadState: 'networkidle'
};
```

---

## Architecture

This framework follows the **Concepts + Synchronizations** pattern:

- **Concepts**: Independent modules (`browserConcept`, `domConcept`, etc.) that own their state and actions
- **Synchronizations**: Declarative event wiring between concepts
- **Pure Functions**: Deterministic logic separated from side effects
- **Event-Driven**: Concepts communicate via events, never direct imports

### Project Structure

```
ui-test-framework/
├── src/
│   ├── concepts/           # Core domain concepts
│   │   ├── browserConcept.js
│   │   ├── domConcept.js
│   │   ├── waitConcept.js
│   │   └── ...
│   ├── errors/             # Custom error classes
│   ├── synchronizations.js # Event wiring
│   └── index.js           # Public API
├── tests/                  # Framework self-tests
└── examples/              # Example test suites
```

---

## Development

### Run Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run with Coverage

```bash
npm run test:coverage
```

---

## Limitations (v1.0)

### Not Supported

- Parallel test execution
- Network request mocking/interception
- File upload/download
- Visual regression testing
- Cross-browser support (Firefox, Safari)
- Mobile device emulation
- iframe traversal
- Shadow DOM piercing
- Drag-and-drop interactions
- Screenshot/video capture

### Explicitly Out of Scope

- Plugin system
- Built-in test fixtures
- CI/CD integration
- GUI test recorder
- Automatic retry logic

---

## AI Agent Integration

### Failure Analysis Pattern

When a test fails, AI agents can:

1. Parse the `error.recentTrace` array to identify the last successful action
2. Compare expected element attributes with actual page state
3. Generate alternative selectors based on element snapshot data
4. Identify patterns (timing issues, wrong page loaded, element never rendered)

### Example AI Prompt

```
Given this failed test trace:
{trace_json}

The test attempted to click selector "#submit-button" but timed out.
Based on the element snapshots in the trace:
1. Did the element ever appear on the page?
2. If yes, was it visible when the click was attempted?
3. Suggest 3 alternative selectors that would successfully target the element.
```

---

## Contributing

This framework is designed for agentic development workflows. When contributing:

1. Follow the Concepts + Synchronizations pattern
2. Write pure functions for deterministic logic
3. Include unit tests for all new functionality
4. Update trace logging for new actions
5. Maintain machine-readable error context

---

## License

MIT

---

## Support

For issues and feature requests, please visit:
https://github.com/your-org/ui-test-framework/issues
