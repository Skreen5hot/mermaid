/**
 * DOM Concept
 * Manages element interaction and queries.
 *
 * FR-10: Element Interaction
 * FR-11: Element Inspection
 */

import { ElementNotFoundError, ElementNotInteractableError, SelectorError } from '../errors/index.js';
import { browserConcept } from './browserConcept.js';
import { navigationConcept } from './navigationConcept.js';

export const domConcept = {
  state: {
    lastInteraction: null,   // Last action performed
    elementSnapshots: []     // Recent element states (max 10)
  },

  actions: {
    /**
     * Get session ID for CDP commands
     * @returns {string} Session ID
     */
    _getSessionId() {
      const sessionId = navigationConcept.state.sessionId;
      if (!sessionId) {
        throw new Error('No active page session. Navigate to a page first.');
      }
      return sessionId;
    },

    /**
     * Query element using Runtime.evaluate
     * @param {string} selector - CSS selector
     * @returns {Promise<Object>} Element data
     */
    async _queryElement(selector) {
      const self = domConcept;
      validateSelector(selector);

      const sessionId = self.actions._getSessionId();

      // Use Runtime.evaluate to query element and get its properties
      const expression = `
        (function() {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!element) return null;

          const rect = element.getBoundingClientRect();
          const styles = window.getComputedStyle(element);

          return {
            exists: true,
            visible: rect.width > 0 && rect.height > 0 && styles.visibility !== 'hidden' && styles.display !== 'none',
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            width: rect.width,
            height: rect.height,
            text: element.textContent,
            value: element.value,
            tagName: element.tagName,
            disabled: element.disabled || false,
            opacity: parseFloat(styles.opacity),
            attributes: Array.from(element.attributes).reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {})
          };
        })()
      `;

      const result = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
        expression,
        returnByValue: true
      }, sessionId);

      if (result.exceptionDetails) {
        throw new SelectorError({
          selector,
          reason: result.exceptionDetails.exception?.description || 'Invalid selector'
        });
      }

      const elementData = result.result.value;

      if (!elementData) {
        throw new ElementNotFoundError({
          selector,
          context: 'queryElement'
        });
      }

      return elementData;
    },

    /**
     * Click element at center
     * @param {string} selector - CSS selector
     * @returns {Promise<void>}
     */
    async click(selector) {
      const self = domConcept;

      // 1. Validate selector
      validateSelector(selector);

      // 2. Query element via CDP
      const elementData = await self.actions._queryElement(selector);

      // 3. Verify element is interactable
      if (!isElementInteractable(elementData)) {
        throw new ElementNotInteractableError({
          selector,
          reason: !elementData.visible ? 'Element is not visible' : 'Element is disabled',
          state: elementData
        });
      }

      const sessionId = self.actions._getSessionId();

      // 4. Send click event using Input.dispatchMouseEvent
      const clickActions = [
        { type: 'mousePressed', x: elementData.x, y: elementData.y, button: 'left', clickCount: 1 },
        { type: 'mouseReleased', x: elementData.x, y: elementData.y, button: 'left', clickCount: 1 }
      ];

      for (const action of clickActions) {
        await browserConcept.actions.sendCDPCommand('Input.dispatchMouseEvent', action, sessionId);
      }

      // 5. Update state and emit event
      self.state.lastInteraction = {
        action: 'click',
        selector,
        timestamp: Date.now()
      };

      self.actions._addSnapshot(snapshotElement(elementData));

      self.notify('elementInteracted', {
        action: 'click',
        selector,
        element: snapshotElement(elementData)
      });
    },

    /**
     * Type text into element
     * @param {string} selector - CSS selector
     * @param {string} text - Text to type
     * @param {Object} options - Typing options
     * @returns {Promise<void>}
     */
    async type(selector, text, options = {}) {
      const self = domConcept;
      const delay = options.delay || 0;

      // 1. Query and validate element
      const elementData = await self.actions._queryElement(selector);

      if (!isElementInteractable(elementData)) {
        throw new ElementNotInteractableError({
          selector,
          reason: !elementData.visible ? 'Element is not visible' : 'Element is disabled',
          state: elementData
        });
      }

      const sessionId = self.actions._getSessionId();

      // 2. Click element to focus it first
      await browserConcept.actions.sendCDPCommand('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: elementData.x,
        y: elementData.y,
        button: 'left',
        clickCount: 1
      }, sessionId);

      await browserConcept.actions.sendCDPCommand('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: elementData.x,
        y: elementData.y,
        button: 'left',
        clickCount: 1
      }, sessionId);

      // 3. Type each character
      for (const char of text) {
        await browserConcept.actions.sendCDPCommand('Input.dispatchKeyEvent', {
          type: 'keyDown',
          text: char
        }, sessionId);

        await browserConcept.actions.sendCDPCommand('Input.dispatchKeyEvent', {
          type: 'keyUp',
          text: char
        }, sessionId);

        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // 4. Update state and emit event
      self.state.lastInteraction = {
        action: 'type',
        selector,
        text,
        timestamp: Date.now()
      };

      self.actions._addSnapshot(snapshotElement(elementData));

      self.notify('elementInteracted', {
        action: 'type',
        selector,
        text,
        element: snapshotElement(elementData)
      });
    },

    /**
     * Select dropdown option
     * @param {string} selector - CSS selector
     * @param {string} value - Option value
     * @returns {Promise<void>}
     */
    async select(selector, value) {
      const self = domConcept;
      const sessionId = self.actions._getSessionId();

      // Use Runtime.evaluate to select the option
      const expression = `
        (function() {
          const select = document.querySelector(${JSON.stringify(selector)});
          if (!select) throw new Error('Select element not found');

          select.value = ${JSON.stringify(value)};
          select.dispatchEvent(new Event('change', { bubbles: true }));

          return { success: true, value: select.value };
        })()
      `;

      const result = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
        expression,
        returnByValue: true
      }, sessionId);

      if (result.exceptionDetails) {
        throw new ElementNotFoundError({
          selector,
          context: 'select'
        });
      }

      self.state.lastInteraction = {
        action: 'select',
        selector,
        value,
        timestamp: Date.now()
      };

      self.notify('elementInteracted', {
        action: 'select',
        selector,
        value
      });
    },

    /**
     * Check checkbox
     * @param {string} selector - CSS selector
     * @returns {Promise<void>}
     */
    async check(selector) {
      const self = domConcept;
      const sessionId = self.actions._getSessionId();

      const expression = `
        (function() {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!element) throw new Error('Element not found');

          if (!element.checked) {
            element.checked = true;
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }

          return { checked: element.checked };
        })()
      `;

      const result = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
        expression,
        returnByValue: true
      }, sessionId);

      if (result.exceptionDetails) {
        throw new ElementNotFoundError({
          selector,
          context: 'check'
        });
      }

      self.state.lastInteraction = {
        action: 'check',
        selector,
        timestamp: Date.now()
      };

      self.notify('elementInteracted', {
        action: 'check',
        selector
      });
    },

    /**
     * Uncheck checkbox
     * @param {string} selector - CSS selector
     * @returns {Promise<void>}
     */
    async uncheck(selector) {
      const self = domConcept;
      const sessionId = self.actions._getSessionId();

      const expression = `
        (function() {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (!element) throw new Error('Element not found');

          if (element.checked) {
            element.checked = false;
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }

          return { checked: element.checked };
        })()
      `;

      const result = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
        expression,
        returnByValue: true
      }, sessionId);

      if (result.exceptionDetails) {
        throw new ElementNotFoundError({
          selector,
          context: 'uncheck'
        });
      }

      self.state.lastInteraction = {
        action: 'uncheck',
        selector,
        timestamp: Date.now()
      };

      self.notify('elementInteracted', {
        action: 'uncheck',
        selector
      });
    },

    /**
     * Get element attribute value
     * @param {string} selector - CSS selector
     * @param {string} attribute - Attribute name
     * @returns {Promise<string|null>}
     */
    async getAttribute(selector, attribute) {
      const elementData = await domConcept.actions._queryElement(selector);
      return elementData.attributes[attribute] || null;
    },

    /**
     * Get element text content
     * @param {string} selector - CSS selector
     * @returns {Promise<string>}
     */
    async getText(selector) {
      const elementData = await domConcept.actions._queryElement(selector);
      return elementData.text || '';
    },

    /**
     * Check if element is visible
     * @param {string} selector - CSS selector
     * @returns {Promise<boolean>}
     */
    async isVisible(selector) {
      try {
        const elementData = await domConcept.actions._queryElement(selector);
        return elementData.visible;
      } catch (err) {
        if (err instanceof ElementNotFoundError) {
          return false;
        }
        throw err;
      }
    },

    /**
     * Check if element exists
     * @param {string} selector - CSS selector
     * @returns {Promise<boolean>}
     */
    async exists(selector) {
      const self = domConcept;
      validateSelector(selector);

      const sessionId = self.actions._getSessionId();

      const expression = `
        (function() {
          const element = document.querySelector(${JSON.stringify(selector)});
          return element !== null;
        })()
      `;

      const result = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
        expression,
        returnByValue: true
      }, sessionId);

      return result.result.value === true;
    },

    /**
     * Add element snapshot to history
     * @param {Object} snapshot - Element snapshot
     */
    _addSnapshot(snapshot) {
      const self = domConcept;
      self.state.elementSnapshots.push({
        ...snapshot,
        timestamp: Date.now()
      });

      // Keep only last 10 snapshots
      if (self.state.elementSnapshots.length > 10) {
        self.state.elementSnapshots.shift();
      }
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
