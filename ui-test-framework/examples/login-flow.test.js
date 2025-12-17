/**
 * Example Test: Login Flow
 * Demonstrates usage of the UI testing framework for a typical login scenario.
 *
 * This example shows:
 * - Browser lifecycle management
 * - Navigation with wait conditions
 * - Element interaction (typing, clicking)
 * - Explicit waits with timeouts
 * - Assertions
 * - Test isolation with beforeEach/afterEach
 */

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
  afterAll,
  beforeEach
} from '../src/index.js';

describe('Login Flow', () => {
  let browser;

  beforeAll(async () => {
    // Launch browser once for all tests in this suite
    browser = await launch({
      executablePath: '/usr/bin/chromium', // Update to your browser path
      headless: true,
      viewport: { width: 1280, height: 720 }
    });
  });

  afterAll(async () => {
    // Close browser after all tests complete
    await browser.close();
  });

  beforeEach(async () => {
    // Navigate to login page before each test
    // Each test runs in an isolated browser context
    await navigate('http://localhost:3000/login', { loadState: 'networkidle' });
  });

  test('should successfully log in with valid credentials', async () => {
    // Wait for form to be ready
    await waitForSelector('#username', { timeout: 5000 });

    // Fill in login form
    await type('#username', 'testuser@example.com');
    await type('#password', 'SecurePass123');

    // Submit form
    await click('#login-button');

    // Wait for navigation to dashboard
    await waitForSelector('#dashboard', { timeout: 10000 });

    // Verify successful login
    const heading = await getText('h1');
    expect(heading).toContain('Welcome');

    // Verify user menu is visible
    const userMenuVisible = await isVisible('#user-menu');
    expect(userMenuVisible).toBeTruthy();
  });

  test('should show error message with invalid credentials', async () => {
    // Wait for form to be ready
    await waitForSelector('#username', { timeout: 5000 });

    // Fill in with invalid credentials
    await type('#username', 'wrong@example.com');
    await type('#password', 'wrongpassword');

    // Submit form
    await click('#login-button');

    // Wait for error message to appear
    await waitForSelector('.error-message', { timeout: 5000, visible: true });

    // Verify error message content
    const errorText = await getText('.error-message');
    expect(errorText).toBe('Invalid username or password');

    // Verify still on login page
    const loginFormVisible = await isVisible('#login-form');
    expect(loginFormVisible).toBeTruthy();
  });

  test('should show validation error for empty username', async () => {
    // Wait for form to be ready
    await waitForSelector('#login-button', { timeout: 5000 });

    // Try to submit without filling username
    await click('#login-button');

    // Wait for validation message
    await waitForSelector('#username-error', { timeout: 3000, visible: true });

    // Verify validation message
    const validationText = await getText('#username-error');
    expect(validationText).toContain('required');
  });

  test('should toggle password visibility', async () => {
    // Wait for form to be ready
    await waitForSelector('#password', { timeout: 5000 });

    // Type password
    await type('#password', 'SecretPassword123');

    // Click show/hide toggle
    await click('#toggle-password-visibility');

    // Verify password field type changed
    const passwordType = await getAttribute('#password', 'type');
    expect(passwordType).toBe('text');

    // Toggle again
    await click('#toggle-password-visibility');

    // Verify back to password type
    const passwordTypeHidden = await getAttribute('#password', 'type');
    expect(passwordTypeHidden).toBe('password');
  });

  test('should redirect to forgot password page', async () => {
    // Wait for forgot password link
    await waitForSelector('#forgot-password-link', { timeout: 5000 });

    // Click link
    await click('#forgot-password-link');

    // Wait for forgot password page to load
    await waitForSelector('#reset-password-form', { timeout: 5000 });

    // Verify on correct page
    const heading = await getText('h1');
    expect(heading).toBe('Reset Password');
  });
});

describe('Remember Me Functionality', () => {
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

  test('should persist login when remember me is checked', async () => {
    await navigate('http://localhost:3000/login');

    // Fill in credentials
    await waitForSelector('#username', { timeout: 5000 });
    await type('#username', 'testuser@example.com');
    await type('#password', 'SecurePass123');

    // Check remember me
    await check('#remember-me');

    // Submit
    await click('#login-button');

    // Wait for dashboard
    await waitForSelector('#dashboard', { timeout: 10000 });

    // Navigate away and back
    await navigate('http://localhost:3000/logout');
    await navigate('http://localhost:3000/login');

    // Verify username is pre-filled
    const usernameValue = await getAttribute('#username', 'value');
    expect(usernameValue).toBe('testuser@example.com');
  });
});

/**
 * To run this example:
 *
 * 1. Ensure you have a test application running on http://localhost:3000
 * 2. Update the browser executablePath to match your system
 * 3. Run: node examples/login-flow.test.js
 *
 * Expected output:
 * - Real-time test progress in console
 * - Final test summary with pass/fail counts
 * - JSON report in ./test-results/results.json
 * - Structured trace logs for each action
 */
