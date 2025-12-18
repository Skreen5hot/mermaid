/**
 * Test Configuration
 * Centralized configuration for test files
 */

import { platform } from 'os';

/**
 * Get Chrome executable path based on platform
 * @returns {string} Chrome executable path
 */
export function getChromePath() {
  // Allow override via environment variable
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  const platformName = platform();

  switch (platformName) {
    case 'win32':
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    case 'darwin':
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

    case 'linux':
      // Try common Linux paths
      return '/usr/bin/google-chrome-stable';

    default:
      throw new Error(`Unsupported platform: ${platformName}`);
  }
}

export const TEST_TIMEOUT = 60000; // 60 seconds
export const HEADLESS = process.env.CI === 'true' || process.env.HEADLESS === 'true';
