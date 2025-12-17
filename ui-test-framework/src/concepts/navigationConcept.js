/**
 * Navigation Concept
 * Manages page navigation and URL changes.
 *
 * FR-2: Navigation & Tab Management
 */

import { NavigationError } from '../errors/index.js';

export const navigationConcept = {
  state: {
    currentUrl: '',
    loadState: '',           // 'load' | 'domcontentloaded' | 'networkidle'
    timingMetrics: {}
  },

  actions: {
    /**
     * Navigate to URL with wait condition
     * @param {string} url - Target URL
     * @param {Object} options - Navigation options
     * @returns {Promise<void>}
     */
    async navigate(url, options = {}) {
      // TODO: Implement navigation logic
      // 1. Parse load state
      // 2. Send CDP Page.navigate command
      // 3. Wait for specified load state
      // 4. Capture timing metrics
      // 5. Emit navigationCompleted event
      throw new Error('Not implemented');
    },

    /**
     * Get current page URL
     * @returns {string} Current URL
     */
    getCurrentUrl() {
      return this.state.currentUrl;
    },

    /**
     * Get navigation timing metrics
     * @returns {Object} Performance timing data
     */
    getTimingMetrics() {
      return { ...this.state.timingMetrics };
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
