/**
 * Wait Concept
 * Manages explicit wait functions with deterministic polling.
 *
 * FR-20: Explicit Wait Functions
 */

import { TimeoutError } from '../errors/index.js';

export const waitConcept = {
  state: {
    activeWaits: new Map(),  // waitId -> { selector, startTime, timeout }
    pollInterval: 100        // Fixed at 100ms (not configurable)
  },

  actions: {
    /**
     * Wait for element to exist (and optionally be visible)
     * @param {string} selector - CSS selector
     * @param {Object} options - Wait options { timeout, visible? }
     * @returns {Promise<void>}
     */
    async waitForSelector(selector, options) {
      // TODO: Implement waitForSelector logic
      // 1. Record wait start time
      // 2. Poll every 100ms
      // 3. Check element existence (and visibility if required)
      // 4. Throw TimeoutError if timeout exceeded
      // 5. Emit waitCompleted event on success
      throw new Error('Not implemented');
    },

    /**
     * Wait for element text to match
     * @param {string} selector - CSS selector
     * @param {string} text - Expected text
     * @param {Object} options - Wait options { timeout, exact? }
     * @returns {Promise<void>}
     */
    async waitForText(selector, text, options) {
      // TODO: Implement waitForText logic
      throw new Error('Not implemented');
    },

    /**
     * Wait for element to be hidden or removed
     * @param {string} selector - CSS selector
     * @param {Object} options - Wait options { timeout }
     * @returns {Promise<void>}
     */
    async waitForHidden(selector, options) {
      // TODO: Implement waitForHidden logic
      throw new Error('Not implemented');
    }
  },

  _subscribers: [],

  notify(event, payload) {
    this._subscribers.forEach(fn => fn(event, payload));
  },

  subscribe(fn) {
    this._subscribers.push(fn);
  }
};

// Pure functions for wait concept

/**
 * Calculate elapsed time since start
 * @param {number} startTime - Start timestamp in milliseconds
 * @returns {number} Elapsed time in milliseconds
 */
export function calculateElapsedTime(startTime) {
  return Date.now() - startTime;
}

/**
 * Check if text matches condition
 * @param {string} actualText - Actual text content
 * @param {string} expectedText - Expected text
 * @param {boolean} exact - Whether to match exactly
 * @returns {boolean}
 */
export function matchesTextCondition(actualText, expectedText, exact = false) {
  if (exact) {
    return actualText === expectedText;
  }
  return actualText.includes(expectedText);
}
