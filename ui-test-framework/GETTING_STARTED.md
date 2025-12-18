# 🚀 Getting Started with UI Test Framework

Quick reference guide for using the Lightweight UI Testing Framework.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [API Quick Reference](#api-quick-reference)

---

## 🏃 Quick Start

### 1. Installation

```bash
cd ui-test-framework
npm install
```

### 2. Set Your Chrome Path

**Windows:**
```bash
set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

**macOS:**
```bash
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

**Linux:**
```bash
export CHROME_PATH=/usr/bin/chromium
```

### 3. Run Your First Test

```bash
# Run unit tests (no browser needed)
npm test

# Run manual test (launches browser)
node manual-test.js
```

---

## 🧪 Running Tests

### Unit Tests (Fast, No Browser)

```bash
npm test
```

Tests pure functions without launching a browser.

### Manual Test (With Browser)

```bash
node manual-test.js
```

Launches a browser, runs CDP commands, and closes it. Good for development.

### Single Integration Test

```bash
node test-single.js
```

Tests a specific feature in isolation.

### Watch Mode

```bash
npm run test:watch
```

Automatically re-runs tests when files change.

---

## ✍️ Writing Tests

### Basic Test Structure

```javascript
import { launch, close, navigate, click, type, expect } from '@agentic/ui-test-framework';

describe('My Feature', () => {
  let browser;

  beforeAll(async () => {
    browser = await launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true
    });
  });

  afterAll(async () => {
    await close();
  });

  test('should do something', async () => {
    await navigate('http://localhost:3000');
    await click('#my-button');
    const text = await getText('h1');
    expect(text).toBe('Expected Text');
  });
});
```

### Test with Explicit Waits

```javascript
test('should wait for element', async () => {
  await navigate('http://localhost:3000/slow-page');

  // Wait for element to appear (required timeout)
  await waitForSelector('#loading-complete', { timeout: 5000 });

  // Now interact with it
  await click('#submit');
});
```

### Test with Form Interaction

```javascript
test('should fill out form', async () => {
  await navigate('http://localhost:3000/form');

  await type('#email', 'user@example.com');
  await type('#password', 'SecurePass123');
  await check('#terms-checkbox');
  await select('#country', 'US');
  await click('#submit-btn');

  await waitForText('.success-message', 'Form submitted', { timeout: 3000 });
});
```

---

## 🔧 Common Patterns

### Pattern 1: Simple Navigation Test

```javascript
test('homepage loads', async () => {
  await navigate('http://localhost:3000');
  const title = await getText('h1');
  expect(title).toContain('Welcome');
});
```

### Pattern 2: Form Submission

```javascript
test('login form works', async () => {
  await navigate('http://localhost:3000/login');

  await waitForSelector('#username', { timeout: 5000 });
  await type('#username', 'testuser');
  await type('#password', 'password123');
  await click('#login-button');

  await waitForSelector('#dashboard', { timeout: 10000 });
  expect(await isVisible('#user-menu')).toBeTruthy();
});
```

### Pattern 3: Error Handling

```javascript
test('shows error on invalid input', async () => {
  await navigate('http://localhost:3000/form');

  await click('#submit-btn'); // Submit without filling form

  await waitForSelector('.error-message', { timeout: 3000, visible: true });
  const errorText = await getText('.error-message');
  expect(errorText).toContain('required');
});
```

### Pattern 4: Element Visibility Checks

```javascript
test('modal appears and disappears', async () => {
  await navigate('http://localhost:3000');

  expect(await isVisible('#modal')).toBe(false);

  await click('#open-modal-btn');
  await waitForSelector('#modal', { timeout: 2000, visible: true });

  expect(await isVisible('#modal')).toBe(true);

  await click('#close-modal-btn');
  await waitForHidden('#modal', { timeout: 2000 });

  expect(await isVisible('#modal')).toBe(false);
});
```

---

## 🐛 Troubleshooting

### Problem: "Browser executable path is required"

**Solution:** Set the Chrome path in your test:

```javascript
await launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true
});
```

### Problem: "Browser did not become ready within 30000ms"

**Causes:**
- Chrome isn't installed at the specified path
- Firewall blocking CDP connection
- Another Chrome instance using the port

**Solutions:**
1. Check Chrome path: `ls "C:\Program Files\Google\Chrome\Application\chrome.exe"`
2. Close other Chrome instances
3. Try with `headless: false` to see what's happening

### Problem: "Element not found"

**Solution:** Use explicit waits:

```javascript
// Instead of:
await click('#button');

// Use:
await waitForSelector('#button', { timeout: 5000 });
await click('#button');
```

### Problem: "CDP WebSocket not connected"

**Solution:** Make sure you launched the browser first:

```javascript
beforeAll(async () => {
  await launch({ executablePath: CHROME_PATH, headless: true });
});
```

### Problem: Tests fail when run together but pass individually

**Solution:** Add cleanup in `afterEach`:

```javascript
afterEach(async () => {
  try {
    await close();
  } catch (err) {
    // Ignore
  }
});
```

---

## 📖 API Quick Reference

### Browser Lifecycle

```javascript
// Launch browser
await launch({
  executablePath: '/path/to/chrome',
  headless: true,
  viewport: { width: 1280, height: 720 }
});

// Close browser
await close();
```

### Navigation

```javascript
// Navigate to URL
await navigate('http://localhost:3000', { loadState: 'networkidle' });

// Get current URL
const url = getCurrentUrl();
```

### DOM Interaction

```javascript
// Click
await click('#my-button');

// Type text
await type('#input-field', 'Hello World', { delay: 50 });

// Select dropdown
await select('#country-select', 'US');

// Checkboxes
await check('#agree-checkbox');
await uncheck('#newsletter-checkbox');
```

### DOM Queries

```javascript
// Get text
const text = await getText('h1');

// Get attribute
const href = await getAttribute('a', 'href');

// Check visibility
const visible = await isVisible('#modal');

// Check existence
const exists = await exists('#optional-element');
```

### Waits (ALWAYS USE EXPLICIT TIMEOUT)

```javascript
// Wait for element to exist
await waitForSelector('#element', { timeout: 5000 });

// Wait for element to be visible
await waitForSelector('#element', { timeout: 5000, visible: true });

// Wait for text content
await waitForText('.status', 'Complete', { timeout: 3000, exact: true });

// Wait for element to disappear
await waitForHidden('#loading-spinner', { timeout: 5000 });
```

### Assertions

```javascript
// Strict equality
expect(5).toBe(5);

// String/array contains
expect('hello world').toContain('world');

// Truthy/falsy
expect(true).toBeTruthy();
expect(false).toBeFalsy();

// Element assertions (when integrated with DOM)
expect('#button').toExist();
expect('#modal').toBeVisible();
```

### Test Structure

```javascript
describe('Feature Name', () => {
  beforeAll(async () => {
    // Runs once before all tests
  });

  afterAll(async () => {
    // Runs once after all tests
  });

  beforeEach(async () => {
    // Runs before each test
  });

  afterEach(async () => {
    // Runs after each test
  });

  test('test name', async () => {
    // Test body
  });
});
```

---

## 💡 Tips & Best Practices

### ✅ DO:

- **Always use explicit timeouts** in wait functions
- **Clean up browser** in `afterAll()` or `afterEach()`
- **Wait for elements** before interacting with them
- **Use descriptive test names** that explain what's being tested
- **Test one thing per test** - keep tests focused

### ❌ DON'T:

- Don't use implicit waits (the framework doesn't support them)
- Don't share state between tests
- Don't hard-code sleep delays - use `waitFor*` functions
- Don't skip error handling in cleanup code
- Don't test implementation details - test user behavior

---

## 🎯 Example: Complete Login Test

```javascript
import {
  launch,
  close,
  navigate,
  waitForSelector,
  type,
  click,
  getText,
  isVisible,
  expect,
  describe,
  test,
  beforeAll,
  afterAll
} from '@agentic/ui-test-framework';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

describe('Login Flow', () => {
  beforeAll(async () => {
    await launch({
      executablePath: CHROME_PATH,
      headless: true,
      viewport: { width: 1280, height: 720 }
    });
  });

  afterAll(async () => {
    await close();
  });

  test('successful login redirects to dashboard', async () => {
    // Navigate to login page
    await navigate('http://localhost:3000/login');

    // Wait for form to load
    await waitForSelector('#username', { timeout: 5000 });

    // Fill in credentials
    await type('#username', 'testuser@example.com');
    await type('#password', 'SecurePass123');

    // Submit form
    await click('#login-button');

    // Wait for redirect to dashboard
    await waitForSelector('#dashboard', { timeout: 10000 });

    // Verify we're on the right page
    const heading = await getText('h1');
    expect(heading).toContain('Dashboard');

    // Verify user menu is visible
    const userMenuVisible = await isVisible('#user-menu');
    expect(userMenuVisible).toBeTruthy();
  });

  test('invalid credentials show error message', async () => {
    await navigate('http://localhost:3000/login');

    await waitForSelector('#username', { timeout: 5000 });
    await type('#username', 'wrong@example.com');
    await type('#password', 'wrongpassword');
    await click('#login-button');

    // Wait for error to appear
    await waitForSelector('.error-message', { timeout: 5000, visible: true });

    // Verify error message
    const errorText = await getText('.error-message');
    expect(errorText).toBe('Invalid username or password');
  });
});
```

---

## 📚 More Resources

- **Full Documentation:** [README.md](README.md)
- **Framework Specification:** [uiTestingFramework.md](../uiTestingFramework.md)
- **CDP Implementation:** [src/concepts/CDP_IMPLEMENTATION.md](src/concepts/CDP_IMPLEMENTATION.md)
- **Architecture Guide:** [agenticDevlopment.md](../agenticDevlopment.md)

---

## 🆘 Getting Help

If you encounter issues:

1. Check this guide's [Troubleshooting](#troubleshooting) section
2. Run `node manual-test.js` to verify basic functionality
3. Check that Chrome is installed and the path is correct
4. Review test output for specific error messages
5. Look at example tests in `/examples` directory

---

**Version:** 1.0.0
**Last Updated:** 2025-12-17
