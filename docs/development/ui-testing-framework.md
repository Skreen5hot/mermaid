# Lightweight UI Testing Framework – Functional Requirements

**Version:** 1.0  
**Status:** Draft  
**Target:** Agentic Development Use Cases  
**Last Updated:** 2025-12-17

---

## 1. Executive Summary

This framework provides a minimal, deterministic UI automation layer optimized for AI agent interaction. It prioritizes explicit behavior, structured logging, and machine-readable output over convenience features like auto-waiting or smart selectors.

### Core Design Principles

1. **Determinism First:** Predictable failure modes with no implicit retries or heuristics
2. **Minimal Dependencies:** Direct CDP integration with one optional helper library
3. **Agentic Observability:** Structured trace logging for AI debugging workflows
4. **Lightweight Implementation:** Focused feature set, clean abstractions

### Key Terms

- **Deterministic:** Behavior that produces identical outcomes given identical inputs, with no probabilistic retries, variable delays, or adaptive waiting strategies
- **Agentic Observability:** Machine-readable execution traces that enable AI agents to diagnose failures without human interpretation
- **Isolated Context:** Fresh browser state (cookies, storage, cache) per test suite to prevent cross-test contamination

---

## 2. Functional Requirements

### 2.1 Browser & State Controller

**FR-1: Browser Lifecycle Management**
- Launch Chromium-based browser instances (Chrome, Chromium, Edge)
- Support headless and headed modes via configuration
- Gracefully close browser and cleanup resources on test completion or crash
- Expose `launch()` and `close()` methods returning Promises

**FR-2: Navigation & Tab Management**
- Navigate to URLs with configurable wait conditions:
  - `load`: DOM loaded
  - `domcontentloaded`: DOM ready
  - `networkidle`: No network activity for 500ms
- Switch between browser tabs by index or URL pattern
- Return navigation timing metrics (DNS, TCP, request, response)

**FR-3: Context Isolation**
- Create a new browser context (not just clear storage) for each test suite
- Each context has isolated:
  - Cookies
  - `localStorage`
  - `sessionStorage`
  - `IndexedDB`
  - Cache storage
  - Permissions
- Contexts are automatically destroyed after suite completion

**FR-4: Chrome DevTools Protocol Integration**
- Interface with Chrome via CDP using WebSocket connection
- **Dependency Policy:** Core framework uses raw WebSocket implementation
- **Optional:** Support `chrome-remote-interface` (4.5KB, zero deps) as alternative transport layer
- Abstract CDP communication behind `BrowserController` interface to allow swapping implementations

---

### 2.2 DOM Interaction & Wait System

**FR-10: Element Interaction**
- Support actions via CSS selectors:
  - `click(selector)`: Simulates click event at element center
  - `type(selector, text, options)`: Inputs text with optional delay between keystrokes
  - `select(selector, value)`: Selects dropdown option by value
  - `check(selector)` / `uncheck(selector)`: Toggles checkboxes
- All actions verify element exists and is visible before execution
- Actions throw `ElementNotInteractableError` if element is obscured or disabled

**FR-11: Element Inspection**
- Query methods:
  - `getAttribute(selector, attribute)`: Returns attribute value or `null`
  - `getText(selector)`: Returns trimmed `textContent`
  - `isVisible(selector)`: Returns boolean
  - `exists(selector)`: Returns boolean
- Methods return immediately without waiting
- Throw `ElementNotFoundError` if selector matches zero elements

**FR-20: Explicit Wait Functions**
- All wait functions require explicit timeout (no defaults)
- Wait types:
  - `waitForSelector(selector, { timeout, visible? })`: Waits for element to exist (and optionally be visible)
  - `waitForText(selector, text, { timeout, exact? })`: Waits for element text to match (substring or exact)
  - `waitForHidden(selector, { timeout })`: Waits for element to be hidden or removed
- Wait behavior:
  - Poll every 100ms (not configurable to maintain determinism)
  - On timeout expiration: throw `TimeoutError` with selector, wait type, and duration
  - On success: return immediately (no artificial delays)
- **Clarification on Auto-waiting:**
  - Navigation auto-waiting (e.g., `networkidle`) is permitted for page loads
  - DOM query auto-waiting is prohibited—use explicit `waitFor*` functions

---

### 2.3 Test Runner & Assertion Library

**FR-30: Test Structure**
- Support async/await test definitions:
  ```javascript
  describe('Feature Name', () => {
    test('should do something', async () => {
      // test body
    });
  });
  ```
- Tests execute sequentially in declaration order
- Tests continue after failures to provide comprehensive reporting (fail-fast mode is a future enhancement)

**FR-31: Lifecycle Hooks**
- `beforeAll(fn)`: Runs once before all tests in suite
- `afterAll(fn)`: Runs once after all tests in suite
- `beforeEach(fn)`: Runs before each test (context isolation happens here)
- `afterEach(fn)`: Runs after each test (cleanup, logging)

**FR-32: Test Isolation**
- Each test runs in a fresh browser context (see FR-3)
- Test state cannot leak between tests
- Failed tests do not prevent subsequent tests from running (after error is logged)

**FR-40: Assertion Library**
- Fluent assertion API:
  - `expect(actual).toBe(expected)`: Strict equality (`===`)
  - `expect(actual).toContain(substring)`: String/array inclusion
  - `expect(selector).toExist()`: Element presence
  - `expect(selector).toBeVisible()`: Element visibility
  - `expect(actual).toBeTruthy()` / `toBeFalsy()`: Boolean coercion
- Failed assertions throw `AssertionError` with:
  - Expected value
  - Actual value
  - Diff (for strings/objects)
  - Stack trace with file path and line number

---

### 2.4 Reporting & Agentic Observability

**FR-50: Test Reports**
- Generate two output formats:
  1. **Console Output:** Real-time progress, pass/fail indicators, summary statistics
  2. **JSON Report:** Structured test results written to `results.json`

**FR-51: Execution Trace Logging**
- Log every action as structured JSON event:
  ```json
  {
    "timestamp": 1702834567890,
    "action": "click",
    "selector": "#submit-button",
    "success": true,
    "duration": 45,
    "elementSnapshot": {
      "tag": "button",
      "text": "Submit",
      "visible": true,
      "attributes": {"class": "btn-primary", "type": "submit"}
    }
  }
  ```
- Trace includes:
  - Navigation events (with timing metrics)
  - DOM interactions (with element snapshots)
  - Wait operations (with timeout values)
  - Assertion checks (with expected/actual values)
- On test failure, include last 10 trace events in error output

**FR-52: Machine-Readable Error Context**
- All errors include structured context:
  ```json
  {
    "errorType": "TimeoutError",
    "selector": "#non-existent-element",
    "timeout": 5000,
    "action": "waitForSelector",
    "pageUrl": "http://localhost:3000/login",
    "viewport": {"width": 1280, "height": 720},
    "recentTrace": [ /* last 10 events */ ]
  }
  ```

---

## 3. Architecture Overview

### 3.1 Component Structure

```
┌─────────────────────────────────────────────────────────┐
│                      Test File                          │
│  describe() / test() / expect() / waitFor*()            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   TestRunner                            │
│  • Executes tests sequentially                          │
│  • Manages lifecycle hooks                              │
│  • Orchestrates context isolation                       │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼─────────┐ ┌▼────────────────┐
│ Browser      │ │ DOM        │ │ Assertion       │
│ Controller   │ │ Interactor │ │ Engine          │
│              │ │            │ │                 │
│ • CDP client │ │ • Waits    │ │ • Comparisons   │
│ • Lifecycle  │ │ • Clicks   │ │ • Diff gen      │
│ • Navigation │ │ • Queries  │ │ • Error format  │
└───────┬──────┘ └──┬─────────┘ └┬────────────────┘
        │           │            │
        └───────────┼────────────┘
                    │
        ┌───────────▼────────────┐
        │   TraceLogger          │
        │   • Structured events  │
        │   • Buffer management  │
        └───────────┬────────────┘
                    │
        ┌───────────▼────────────┐
        │   ReportGenerator      │
        │   • JSON output        │
        │   • Console formatting │
        └────────────────────────┘
```

### 3.2 Data Flow

1. **Test Discovery:** TestRunner scans for `describe()` and `test()` blocks
2. **Setup Phase:** Execute `beforeAll` hooks, launch browser
3. **Test Execution Loop:**
   - Create isolated browser context
   - Run `beforeEach` hook
   - Execute test body
   - Log all actions to TraceLogger
   - Run `afterEach` hook
   - Destroy context
4. **Teardown Phase:** Execute `afterAll` hooks, close browser
5. **Report Generation:** Aggregate results, write JSON, print summary

### 3.3 Error Propagation

```
DOM Error → AssertionError/TimeoutError
          ↓
Capture trace context
          ↓
Mark test as FAILED
          ↓
Continue to next test (fail-fast disabled by default)
          ↓
Aggregate in final report
```

---

## 4. Acceptance Criteria

| Feature | Acceptance Criteria |
|---------|-------------------|
| **Browser Lifecycle** | Given a test start command, the system opens a Chromium window and closes it automatically after all tests complete, even if some tests fail. |
| **Navigation** | The system navigates to `localhost` or remote URL and confirms the page reaches the specified load state (`load`, `domcontentloaded`, or `networkidle`). |
| **Context Isolation** | If Test A sets a `localStorage` item within its context, Test B (running immediately after in a new context) observes empty `localStorage`. |
| **Deterministic Wait** | A test using `waitForSelector(selector, {timeout: 5000})` fails at exactly 5000ms (±100ms for poll interval) if the element never appears. No implicit retries occur. |
| **Element Interaction** | Typing "hello" into an `<input>` and clicking a `<button>` triggers the expected DOM events (`input`, `change`, `click`) detectable via event listeners. |
| **Assertion Failure** | A failed `expect(5).toBe(10)` throws an `AssertionError` containing expected value (10), actual value (5), and stack trace with file path. |
| **JSON Report** | Upon completion, `results.json` exists and contains an array of test objects, each with `name`, `status` ("passed"/"failed"), `duration`, and optional `error` object. |
| **Trace Output** | For a failed test, the console displays the last 10 actions (from trace log) prior to failure, including selectors and action types. |

---

## 5. Non-Functional Requirements

### 5.1 Predictability
- **No Implicit Behavior:** Wrong selectors fail immediately; no "smart selector" fallbacks
- **Fixed Polling:** Wait functions poll at fixed 100ms intervals (not adaptive)
- **Fail-Fast Assertions:** First assertion failure stops test execution immediately

### 5.2 Implementation Constraints
- **Code Size:** Core framework (excluding browser binaries) under **1000 lines of code**
  - BrowserController: ~150 lines
  - DOMInteractor + Waits: ~180 lines
  - TestRunner + Hooks: ~200 lines
  - AssertionEngine: ~120 lines
  - TraceLogger: ~150 lines
  - ReportGenerator: ~120 lines
  - Error handling: ~80 lines
- **Dependencies:**
  - **Required:** Node.js 18+, Chromium-based browser
  - **Optional:** `chrome-remote-interface` (may substitute with raw WebSocket)
  - **Prohibited:** Testing frameworks (Jest, Mocha), automation libraries (Puppeteer, Playwright)

### 5.3 Performance
- Browser launch time: < 2 seconds (headless mode)
- Navigation timeout default: 30 seconds
- Element query response: < 50ms (when element exists)
- Context creation overhead: < 100ms per test

### 5.4 Maintainability
- All public APIs must have JSDoc comments
- Error messages must include actionable debugging information
- Trace logs must be valid JSON (parseable without custom tooling)

---

## 6. Explicit Scope Boundaries

### 6.1 Supported in v1.0
✅ Basic DOM interactions (click, type, select)  
✅ CSS selector queries  
✅ Explicit wait functions with timeouts  
✅ Sequential test execution  
✅ Context isolation per test  
✅ Structured trace logging  
✅ JSON test reports  

### 6.2 Not Supported (Future Versions)
❌ Parallel test execution
❌ Fail-fast mode (stop on first failure)
❌ Network request mocking/interception
❌ File upload/download handling
❌ Visual regression testing
❌ Cross-browser support (Firefox, Safari)
❌ Mobile device emulation
❌ iframe traversal
❌ Shadow DOM piercing
❌ Drag-and-drop interactions
❌ Hover state simulation
❌ Keyboard shortcut testing
❌ Screenshot/video capture
❌ Performance profiling  

### 6.3 Explicitly Out of Scope
🚫 Plugin system or extensibility hooks  
🚫 Built-in test fixtures or factories  
🚫 Integration with CI/CD platforms  
🚫 GUI test recorder/generator  
🚫 Automatic test retry logic  

---

## 7. Configuration Schema

### 7.1 Required Configuration

```javascript
{
  "browserExecutablePath": "/usr/bin/chromium",  // Path to browser binary
  "headless": true,                               // Run without visible window
  "defaultTimeout": 5000,                         // Default wait timeout (ms)
  "viewport": {                                   // Initial viewport size
    "width": 1280,
    "height": 720
  }
}
```

### 7.2 Optional Configuration

```javascript
{
  "slowMo": 0,                      // Delay between actions (ms) for debugging
  "devtools": false,                // Auto-open DevTools panel
  "outputDir": "./test-results",    // Report output directory
  "traceLog": true,                 // Enable execution trace logging
  "loadState": "networkidle"        // Default navigation wait condition
}
```

---

## 8. Error Handling Strategy

### 8.1 Error Types

| Error Type | Trigger | Recovery |
|-----------|---------|----------|
| `BrowserCrashError` | Browser process terminates unexpectedly | Fail remaining tests, cleanup resources, exit |
| `TimeoutError` | Wait function exceeds timeout | Fail test, log trace, continue to next test |
| `SelectorError` | Invalid CSS selector syntax | Fail test immediately, no retry |
| `ElementNotFoundError` | Query for non-existent element | Fail test, suggest using `waitForSelector()` |
| `ElementNotInteractableError` | Element hidden/disabled during interaction | Fail test, log element state snapshot |
| `AssertionError` | Assertion comparison fails | Fail test, log diff, continue to next test |
| `NavigationError` | Page load fails or times out | Fail test, log network timing |

### 8.2 Error Recovery Workflow

```
Error Occurs
    ↓
Capture Error Context (trace, screenshot, DOM snapshot)
    ↓
Format Error Message (structured JSON + human-readable)
    ↓
Mark Test as FAILED
    ↓
Execute afterEach() hook (cleanup)
    ↓
Continue to Next Test (unless fatal browser crash)
    ↓
Include Failed Test in Final Report
```

### 8.3 Fatal vs. Non-Fatal Errors

**Fatal Errors (stop suite execution):**
- Browser crash
- Configuration errors (invalid executable path)
- WebSocket connection failure

**Non-Fatal Errors (continue suite execution):**
- Assertion failures
- Timeout errors
- Element not found errors
- Navigation errors

---

## 9. Agentic Integration Guidelines

### 9.1 Trace Log Format

Each trace event follows this schema:

```typescript
interface TraceEvent {
  timestamp: number;           // Unix timestamp (ms)
  sequenceId: number;          // Monotonic sequence number
  action: string;              // Action type: "navigate" | "click" | "type" | "wait" | "assert"
  selector?: string;           // CSS selector (if applicable)
  success: boolean;            // Action outcome
  duration: number;            // Execution time (ms)
  error?: {                    // Present only on failure
    type: string;
    message: string;
  };
  context: {                   // Contextual metadata
    url: string;
    viewport: {width: number, height: number};
    elementSnapshot?: {        // DOM element state at action time
      tag: string;
      text: string;
      visible: boolean;
      attributes: Record<string, string>;
    };
  };
}
```

### 9.2 AI Agent Usage Pattern

1. **Failure Analysis:** Parse `error.recentTrace` array to identify last successful action
2. **Selector Diagnosis:** Compare expected element attributes with actual page state
3. **Retry Strategy:** Generate alternative selectors based on element snapshot data
4. **Root Cause:** Identify patterns (e.g., timing issues, wrong page loaded, element never rendered)

### 9.3 Example AI Prompt Integration

```
Given this failed test trace:
{trace_json}

The test attempted to click selector "{selector}" but timed out.
Based on the element snapshots in the trace:
1. Did the element ever appear on the page?
2. If yes, was it visible when the click was attempted?
3. Suggest 3 alternative selectors that would successfully target the element.
```

---

## 10. Open Questions & Future Considerations

### 10.1 Unresolved Design Questions

1. Should context isolation be configurable (per-suite vs. per-test)?
2. How to handle authentication across tests without session leakage?
3. Should trace logs be rotated/pruned after N tests to prevent unbounded growth?
4. Is 1000 LOC realistic, or should we target 1500 LOC for production quality?

### 10.2 Potential v1.1 Features

- Basic network request interception (mock API responses)
- Screenshot capture on failure
- Custom wait conditions (user-defined predicates)
- Test retry with exponential backoff (opt-in)

### 10.3 Known Limitations

- CDP connection requires Chromium-based browser (no Firefox/Safari)
- WebSocket communication may be blocked by corporate proxies
- Trace logs can grow large (100KB+ per test suite) with verbose actions
- No built-in support for testing across multiple domains (CORS restrictions apply)

---

## 11. Appendix: Example Test

```javascript
const { launch, navigate, click, type, waitForSelector, expect } = require('./framework');

describe('Login Flow', () => {
  let browser;

  beforeAll(async () => {
    browser = await launch({ headless: true });
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

  test('should show error message with invalid credentials', async () => {
    await navigate('http://localhost:3000/login');
    
    await type('#username', 'wrong@example.com');
    await type('#password', 'wrongpass');
    await click('#login-button');
    
    await waitForSelector('.error-message', { timeout: 5000, visible: true });
    const errorText = await getText('.error-message');
    expect(errorText).toBe('Invalid username or password');
  });
});
```

---

## 12. Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-12-17 | Initial draft with resolved contradictions, expanded scope definitions, and agentic observability details | Claude |

---

**Document Status:** Ready for technical review and implementation planning.
