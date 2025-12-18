/**
 * Assertion Concept
 * Provides fluent assertion API for test validation.
 *
 * FR-40: Assertion Library
 */

import { AssertionError } from '../errors/index.js';
import { domConcept } from './domConcept.js';

export const assertionConcept = {
  state: {
    lastAssertion: null      // Last assertion details
  },

  actions: {
    /**
     * Create expectation wrapper for value
     * @param {*} actual - Actual value to test
     * @returns {Object} Fluent assertion API
     */
    expect(actual) {
      const self = assertionConcept;

      return {
        toBe(expected) {
          const passed = strictEquals(actual, expected);
          if (!passed) {
            const error = new AssertionError({
              expected,
              actual,
              matcher: 'toBe',
              diff: generateDiff(expected, actual)
            });
            self.notify('assertionFailed', error);
            throw error;
          }
          self.notify('assertionPassed', { expected, actual, matcher: 'toBe' });
        },

        toContain(substring) {
          const passed = contains(actual, substring);
          if (!passed) {
            const error = new AssertionError({
              expected: substring,
              actual,
              matcher: 'toContain',
              diff: `Expected "${actual}" to contain "${substring}"`
            });
            self.notify('assertionFailed', error);
            throw error;
          }
          self.notify('assertionPassed', { expected: substring, actual, matcher: 'toContain' });
        },

        async toExist() {
          // For DOM selector assertions
          if (typeof actual !== 'string') {
            throw new AssertionError({
              expected: 'CSS selector string',
              actual: typeof actual,
              matcher: 'toExist',
              diff: 'toExist() requires a CSS selector string'
            });
          }

          const exists = await domConcept.actions.exists(actual);
          if (!exists) {
            const error = new AssertionError({
              expected: `Element "${actual}" to exist`,
              actual: 'Element not found',
              matcher: 'toExist',
              selector: actual
            });
            self.notify('assertionFailed', error);
            throw error;
          }
          self.notify('assertionPassed', { expected: 'exists', actual, matcher: 'toExist' });
        },

        async toBeVisible() {
          // For DOM selector assertions
          if (typeof actual !== 'string') {
            throw new AssertionError({
              expected: 'CSS selector string',
              actual: typeof actual,
              matcher: 'toBeVisible',
              diff: 'toBeVisible() requires a CSS selector string'
            });
          }

          const visible = await domConcept.actions.isVisible(actual);
          if (!visible) {
            const error = new AssertionError({
              expected: `Element "${actual}" to be visible`,
              actual: 'Element is not visible or does not exist',
              matcher: 'toBeVisible',
              selector: actual
            });
            self.notify('assertionFailed', error);
            throw error;
          }
          self.notify('assertionPassed', { expected: 'visible', actual, matcher: 'toBeVisible' });
        },

        toBeTruthy() {
          const passed = Boolean(actual);
          if (!passed) {
            const error = new AssertionError({
              expected: 'truthy value',
              actual,
              matcher: 'toBeTruthy'
            });
            self.notify('assertionFailed', error);
            throw error;
          }
          self.notify('assertionPassed', { expected: 'truthy', actual, matcher: 'toBeTruthy' });
        },

        toBeFalsy() {
          const passed = !Boolean(actual);
          if (!passed) {
            const error = new AssertionError({
              expected: 'falsy value',
              actual,
              matcher: 'toBeFalsy'
            });
            self.notify('assertionFailed', error);
            throw error;
          }
          self.notify('assertionPassed', { expected: 'falsy', actual, matcher: 'toBeFalsy' });
        }
      };
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

// Pure functions for assertion concept

/**
 * Strict equality comparison
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean}
 */
export function strictEquals(a, b) {
  return a === b;
}

/**
 * Check if haystack contains needle
 * @param {string|Array} haystack - Value to search in
 * @param {*} needle - Value to search for
 * @returns {boolean}
 */
export function contains(haystack, needle) {
  if (typeof haystack === 'string') {
    return haystack.includes(needle);
  }
  if (Array.isArray(haystack)) {
    return haystack.includes(needle);
  }
  return false;
}

/**
 * Generate diff string for failed assertion
 * @param {*} expected - Expected value
 * @param {*} actual - Actual value
 * @returns {string}
 */
export function generateDiff(expected, actual) {
  const expectedStr = String(expected);
  const actualStr = String(actual);

  if (expectedStr === actualStr) {
    return 'Values are strictly different but stringify to the same value';
  }

  return `Expected: ${expectedStr}\nActual:   ${actualStr}`;
}
