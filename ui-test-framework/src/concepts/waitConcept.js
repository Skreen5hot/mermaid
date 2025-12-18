/**
 * Wait Concept
 * Manages explicit wait functions with deterministic polling.
 *
 * FR-20: Explicit Wait Functions
 */

import { TimeoutError } from '../errors/index.js';
import { domConcept } from './domConcept.js';

export const waitConcept = {
  state: {
    activeWaits: new Map(),  // waitId -> { selector, startTime, timeout }
    pollInterval: 100,       // Fixed at 100ms (not configurable)
    waitIdCounter: 0
  },

  actions: {
    /**
     * Wait for element to exist (and optionally be visible)
     * @param {string} selector - CSS selector
     * @param {Object} options - Wait options { timeout, visible? }
     * @returns {Promise<void>}
     */
    async waitForSelector(selector, options = {}) {
      const self = waitConcept;
      const timeout = options.timeout || 5000;
      const requireVisible = options.visible !== false; // Default true

      // 1. Record wait start time
      const startTime = Date.now();
      const waitId = ++self.state.waitIdCounter;

      self.state.activeWaits.set(waitId, {
        selector,
        startTime,
        timeout,
        type: 'selector'
      });

      self.notify('waitStarted', {
        waitId,
        selector,
        timeout,
        type: 'waitForSelector'
      });

      try {
        // 2. Poll every 100ms
        while (true) {
          const elapsed = calculateElapsedTime(startTime);

          // 4. Throw TimeoutError if timeout exceeded
          if (elapsed > timeout) {
            throw new TimeoutError({
              selector,
              action: 'waitForSelector',
              timeout,
              elapsed
            });
          }

          // 3. Check element existence (and visibility if required)
          try {
            const exists = await domConcept.actions.exists(selector);

            if (exists) {
              // If we don't require visibility, we're done
              if (!requireVisible) {
                break;
              }

              // Check visibility
              const visible = await domConcept.actions.isVisible(selector);
              if (visible) {
                break;
              }
            }
          } catch (err) {
            // Element query failed, continue polling
          }

          // Wait for poll interval
          await new Promise(resolve => setTimeout(resolve, self.state.pollInterval));
        }

        // 5. Emit waitCompleted event on success
        const duration = calculateElapsedTime(startTime);

        self.notify('waitCompleted', {
          waitId,
          selector,
          duration,
          type: 'waitForSelector'
        });

      } finally {
        self.state.activeWaits.delete(waitId);
      }
    },

    /**
     * Wait for element text to match
     * @param {string} selector - CSS selector
     * @param {string} text - Expected text
     * @param {Object} options - Wait options { timeout, exact? }
     * @returns {Promise<void>}
     */
    async waitForText(selector, text, options = {}) {
      const self = waitConcept;
      const timeout = options.timeout || 5000;
      const exact = options.exact || false;

      const startTime = Date.now();
      const waitId = ++self.state.waitIdCounter;

      self.state.activeWaits.set(waitId, {
        selector,
        text,
        startTime,
        timeout,
        type: 'text'
      });

      self.notify('waitStarted', {
        waitId,
        selector,
        text,
        timeout,
        type: 'waitForText'
      });

      try {
        while (true) {
          const elapsed = calculateElapsedTime(startTime);

          if (elapsed > timeout) {
            throw new TimeoutError({
              selector,
              action: 'waitForText',
              timeout,
              elapsed,
              expectedText: text
            });
          }

          try {
            // Check if element exists first
            const exists = await domConcept.actions.exists(selector);

            if (exists) {
              // Get element text
              const actualText = await domConcept.actions.getText(selector);

              // Check if text matches
              if (matchesTextCondition(actualText, text, exact)) {
                break;
              }
            }
          } catch (err) {
            // Element query failed, continue polling
          }

          await new Promise(resolve => setTimeout(resolve, self.state.pollInterval));
        }

        const duration = calculateElapsedTime(startTime);

        self.notify('waitCompleted', {
          waitId,
          selector,
          text,
          duration,
          type: 'waitForText'
        });

      } finally {
        self.state.activeWaits.delete(waitId);
      }
    },

    /**
     * Wait for element to be hidden or removed
     * @param {string} selector - CSS selector
     * @param {Object} options - Wait options { timeout }
     * @returns {Promise<void>}
     */
    async waitForHidden(selector, options = {}) {
      const self = waitConcept;
      const timeout = options.timeout || 5000;

      const startTime = Date.now();
      const waitId = ++self.state.waitIdCounter;

      self.state.activeWaits.set(waitId, {
        selector,
        startTime,
        timeout,
        type: 'hidden'
      });

      self.notify('waitStarted', {
        waitId,
        selector,
        timeout,
        type: 'waitForHidden'
      });

      try {
        while (true) {
          const elapsed = calculateElapsedTime(startTime);

          if (elapsed > timeout) {
            throw new TimeoutError({
              selector,
              action: 'waitForHidden',
              timeout,
              elapsed
            });
          }

          try {
            // Element is hidden if it either doesn't exist or is not visible
            const exists = await domConcept.actions.exists(selector);

            if (!exists) {
              // Element doesn't exist - it's hidden
              break;
            }

            const visible = await domConcept.actions.isVisible(selector);

            if (!visible) {
              // Element exists but is not visible - it's hidden
              break;
            }
          } catch (err) {
            // Query failed, consider it hidden
            break;
          }

          await new Promise(resolve => setTimeout(resolve, self.state.pollInterval));
        }

        const duration = calculateElapsedTime(startTime);

        self.notify('waitCompleted', {
          waitId,
          selector,
          duration,
          type: 'waitForHidden'
        });

      } finally {
        self.state.activeWaits.delete(waitId);
      }
    },

    /**
     * Wait for custom condition function to return true
     * @param {Function} conditionFn - Async function that returns boolean
     * @param {Object} options - Wait options { timeout, pollInterval? }
     * @returns {Promise<void>}
     */
    async waitForCondition(conditionFn, options = {}) {
      const self = waitConcept;
      const timeout = options.timeout || 5000;
      const pollInterval = options.pollInterval || self.state.pollInterval;

      const startTime = Date.now();
      const waitId = ++self.state.waitIdCounter;

      self.state.activeWaits.set(waitId, {
        startTime,
        timeout,
        type: 'condition'
      });

      self.notify('waitStarted', {
        waitId,
        timeout,
        type: 'waitForCondition'
      });

      try {
        while (true) {
          const elapsed = calculateElapsedTime(startTime);

          if (elapsed > timeout) {
            throw new TimeoutError({
              action: 'waitForCondition',
              timeout,
              elapsed
            });
          }

          try {
            const result = await conditionFn();

            if (result === true) {
              break;
            }
          } catch (err) {
            // Condition function threw error, continue polling
          }

          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        const duration = calculateElapsedTime(startTime);

        self.notify('waitCompleted', {
          waitId,
          duration,
          type: 'waitForCondition'
        });

      } finally {
        self.state.activeWaits.delete(waitId);
      }
    },

    /**
     * Get active waits
     * @returns {Array} Array of active wait info
     */
    getActiveWaits() {
      const self = waitConcept;

      return Array.from(self.state.activeWaits.entries()).map(([waitId, data]) => ({
        waitId,
        ...data,
        elapsed: calculateElapsedTime(data.startTime)
      }));
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
