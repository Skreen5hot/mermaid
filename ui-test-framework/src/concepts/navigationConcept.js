/**
 * Navigation Concept
 * Manages page navigation and URL changes.
 *
 * FR-2: Navigation & Tab Management
 */

import { NavigationError } from '../errors/index.js';
import { browserConcept } from './browserConcept.js';

export const navigationConcept = {
  state: {
    currentUrl: '',
    loadState: '',           // 'load' | 'domcontentloaded' | 'networkidle'
    timingMetrics: {},
    targetId: null,          // CDP target ID for the page
    sessionId: null,         // CDP session ID for the page
    isNavigating: false,     // Navigation in progress flag
    navigationPromises: new Map() // Pending navigation promises
  },

  actions: {
    /**
     * Navigate to URL with wait condition
     * @param {string} url - Target URL
     * @param {Object} options - Navigation options
     * @returns {Promise<void>}
     */
    async navigate(url, options = {}) {
      const self = navigationConcept;
      const loadState = options.loadState || 'load';

      // 1. Validate load state
      parseLoadState(loadState);

      // 2. Ensure we have a target (page) and session
      if (!self.state.sessionId) {
        const pageTarget = await browserConcept.actions.getPageTarget();
        self.state.targetId = pageTarget.targetId;
        self.state.sessionId = pageTarget.sessionId;
      }

      self.state.isNavigating = true;
      const startTime = Date.now();

      try {
        // 3. Emit navigation started event
        self.notify('navigationStarted', { url, timestamp: startTime });

        // 4. Enable Page domain (using session)
        try {
          await browserConcept.actions.sendCDPCommand('Page.enable', {}, self.state.sessionId);
        } catch (err) {
          // May already be enabled, continue
        }

        // 5. Set up navigation event listeners based on load state
        const navigationPromise = self.actions.waitForNavigationComplete(loadState);

        // 6. Send CDP Page.navigate command (using session)
        const result = await browserConcept.actions.sendCDPCommand('Page.navigate', { url }, self.state.sessionId);

        if (result.errorText) {
          throw new NavigationError({
            url,
            reason: result.errorText,
            timeout: 0
          });
        }

        // 7. Wait for navigation to complete
        await navigationPromise;

        // 8. Get performance timing
        const timing = await self.actions.getPerformanceTiming();

        // 9. Update state
        self.state.currentUrl = url;
        self.state.loadState = loadState;
        self.state.timingMetrics = timing;

        const duration = Date.now() - startTime;

        // 10. Emit navigation completed event
        self.notify('navigationCompleted', {
          url,
          loadState,
          metrics: timing,
          duration
        });

      } catch (err) {
        const duration = Date.now() - startTime;

        self.notify('navigationFailed', {
          url,
          error: err,
          duration
        });

        throw new NavigationError({
          url,
          reason: err.message,
          timeout: duration
        });

      } finally {
        self.state.isNavigating = false;
      }
    },

    /**
     * Wait for navigation to complete based on load state
     * @param {string} loadState - Load state to wait for
     * @returns {Promise<void>}
     */
    async waitForNavigationComplete(loadState) {
      const self = navigationConcept;

      return new Promise((resolve, reject) => {
        let loadEventFired = false;
        let domContentLoadedFired = false;
        let networkIdleTimeout = null;
        let requestCount = 0;

        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error(`Navigation timeout waiting for ${loadState}`));
        }, 30000); // 30 second timeout

        const cleanup = () => {
          clearTimeout(timeout);
          if (networkIdleTimeout) clearTimeout(networkIdleTimeout);
          // Unsubscribe would happen here in a real implementation
        };

        // Subscribe to CDP events
        const unsubscribe = browserConcept.subscribe((event, payload) => {
          if (event !== 'cdpEvent') return;

          const { method } = payload;

          // Handle different load states
          if (method === 'Page.loadEventFired') {
            loadEventFired = true;
            if (loadState === 'load') {
              cleanup();
              resolve();
            }
          }

          if (method === 'Page.domContentEventFired') {
            domContentLoadedFired = true;
            if (loadState === 'domcontentloaded') {
              cleanup();
              resolve();
            }
          }

          // For networkidle, wait until no requests for 500ms
          if (loadState === 'networkidle') {
            if (method === 'Network.requestWillBeSent') {
              requestCount++;
              if (networkIdleTimeout) clearTimeout(networkIdleTimeout);
            }

            if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
              requestCount--;

              if (requestCount <= 0 && loadEventFired) {
                if (networkIdleTimeout) clearTimeout(networkIdleTimeout);

                networkIdleTimeout = setTimeout(() => {
                  cleanup();
                  resolve();
                }, 500);
              }
            }
          }
        });

        // Enable Network domain for networkidle
        if (loadState === 'networkidle') {
          browserConcept.actions.sendCDPCommand('Network.enable', {}, self.state.sessionId).catch(reject);
        }
      });
    },

    /**
     * Get performance timing from the page
     * @returns {Promise<Object>} Performance timing metrics
     */
    async getPerformanceTiming() {
      const self = navigationConcept;

      try {
        const result = await browserConcept.actions.sendCDPCommand('Runtime.evaluate', {
          expression: 'JSON.stringify(window.performance.timing)',
          returnByValue: true
        }, self.state.sessionId);

        if (result.result && result.result.value) {
          const perfData = JSON.parse(result.result.value);
          return calculateTimingMetrics(perfData);
        }

        return {};
      } catch (err) {
        // Performance timing not available
        return {};
      }
    },

    /**
     * Get current page URL
     * @returns {string} Current URL
     */
    getCurrentUrl() {
      return navigationConcept.state.currentUrl;
    },

    /**
     * Get navigation timing metrics
     * @returns {Object} Performance timing data
     */
    getTimingMetrics() {
      return { ...navigationConcept.state.timingMetrics };
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

// Pure functions for navigation concept

/**
 * Parse and validate load state option
 * @param {string} state - Load state to validate
 * @returns {string} Validated load state
 */
export function parseLoadState(state) {
  const validStates = ['load', 'domcontentloaded', 'networkidle'];
  if (!validStates.includes(state)) {
    throw new Error(`Invalid load state: ${state}. Must be one of: ${validStates.join(', ')}`);
  }
  return state;
}

/**
 * Calculate timing metrics from performance data
 * @param {Object} perfData - Raw performance timing data
 * @returns {Object} Calculated metrics
 */
export function calculateTimingMetrics(perfData) {
  const {
    domainLookupEnd,
    domainLookupStart,
    connectEnd,
    connectStart,
    responseStart,
    requestStart,
    responseEnd,
    domContentLoadedEventEnd,
    loadEventEnd
  } = perfData;

  return {
    dns: domainLookupEnd - domainLookupStart,
    tcp: connectEnd - connectStart,
    request: responseStart - requestStart,
    response: responseEnd - responseStart,
    domContentLoaded: domContentLoadedEventEnd,
    load: loadEventEnd
  };
}
