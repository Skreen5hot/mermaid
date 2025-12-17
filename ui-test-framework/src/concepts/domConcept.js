/**
 * DOM Concept
 * Manages element interaction and queries.
 *
 * FR-10: Element Interaction
 * FR-11: Element Inspection
 */

import { ElementNotFoundError, ElementNotInteractableError, SelectorError } from '../errors/index.js';

export const domConcept = {
  state: {
    lastInteraction: null,   // Last action performed
    elementSnapshots: []     // Recent element states (max 10)
  },

  actions: {
    /**
     * Click element at center
     * @param {string} selector - CSS selector
     * @returns {Promise<void>}
     */
    async click(selector) {
      // TODO: Implement click logic
      // 1. Validate selector
      // 2. Query element via CDP
      // 3. Verify element is interactable
      // 4. Send click event
      // 5. Emit elementInteracted event
      throw new Error('Not implemented');
    },

    /**
     * Type text into element
     * @param {string} selector - CSS selector
     * @param {string} text - Text to type
     * @param {Object} options - Typing options
     * @returns {Promise<void>}
     */
    async type(selector, text, options = {}) {
      // TODO: Implement type logic
      throw new Error('Not implemented');
    },

    /**
     * Select dropdown option
     * @param {string} selector - CSS selector
     * @param {string} value - Option value
     * @returns {Promise<void>}
     */
    async select(selector, value) {
      // TODO: Implement select logic
      throw new Error('Not implemented');
    },

    /**
     * Check checkbox
     * @param {string} selector - CSS selector
     * @returns {Promise<void>}
     */
    async check(selector) {
      // TODO: Implement check logic
      throw new Error('Not implemented');
    },

    /**
     * Uncheck checkbox
     * @param {string} selector - CSS selector
     * @returns {Promise<void>}
     */
    async uncheck(selector) {
      // TODO: Implement uncheck logic
      throw new Error('Not implemented');
    },

    /**
     * Get element attribute value
     * @param {string} selector - CSS selector
     * @param {string} attribute - Attribute name
     * @returns {Promise<string|null>}
     */
    async getAttribute(selector, attribute) {
      // TODO: Implement getAttribute logic
      throw new Error('Not implemented');
    },

    /**
     * Get element text content
     * @param {string} selector - CSS selector
     * @returns {Promise<string>}
     */
    async getText(selector) {
      // TODO: Implement getText logic
      throw new Error('Not implemented');
    },

    /**
     * Check if element is visible
     * @param {string} selector - CSS selector
     * @returns {Promise<boolean>}
     */
    async isVisible(selector) {
      // TODO: Implement isVisible logic
      throw new Error('Not implemented');
    },

    /**
     * Check if element exists
     * @param {string} selector - CSS selector
     * @returns {Promise<boolean>}
     */
    async exists(selector) {
      // TODO: Implement exists logic
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

// Pure functions for DOM concept

/**
 * Validate CSS selector syntax
 * @param {string} selector - Selector to validate
 * @throws {SelectorError} If selector is invalid
 */
export function validateSelector(selector) {
  if (typeof selector !== 'string' || selector.trim() === '') {
    throw new SelectorError({
      selector,
      reason: 'Selector must be a non-empty string'
    });
  }

  // Basic validation - browser will do full validation
  if (selector.includes('>>') || selector.includes('>>>')) {
    throw new SelectorError({
      selector,
      reason: 'Shadow DOM piercing selectors not supported in v1.0',
      suggestion: 'Use standard CSS selectors only'
    });
  }
}

/**
 * Create element snapshot for logging
 * @param {Object} elementData - Element data from CDP
 * @returns {Object} Element snapshot
 */
export function snapshotElement(elementData) {
  return {
    tag: elementData.nodeName?.toLowerCase() || 'unknown',
    text: elementData.textContent?.trim() || '',
    visible: elementData.visible !== false,
    attributes: elementData.attributes || {}
  };
}

/**
 * Check if element is interactable
 * @param {Object} elementState - Element state data
 * @returns {boolean}
 */
export function isElementInteractable(elementState) {
  if (!elementState.visible) return false;
  if (elementState.disabled) return false;
  if (elementState.opacity === 0) return false;
  return true;
}
