/**
 * UI Test Framework - Public API
 * Lightweight UI testing framework optimized for AI agent interaction.
 *
 * Exports all public-facing functions from concepts following
 * Concepts + Synchronizations architecture pattern.
 */

import { browserConcept } from './concepts/browserConcept.js';
import { contextConcept } from './concepts/contextConcept.js';
import { navigationConcept } from './concepts/navigationConcept.js';
import { domConcept } from './concepts/domConcept.js';
import { waitConcept } from './concepts/waitConcept.js';
import { testRunnerConcept } from './concepts/testRunnerConcept.js';
import { assertionConcept } from './concepts/assertionConcept.js';
import { traceConcept } from './concepts/traceConcept.js';
import { reportConcept } from './concepts/reportConcept.js';
import { initializeSynchronizations } from './synchronizations.js';

// Initialize synchronizations on import
initializeSynchronizations();

// Browser lifecycle
export const launch = browserConcept.actions.launch.bind(browserConcept.actions);
export const close = browserConcept.actions.close.bind(browserConcept.actions);

// Navigation
export const navigate = navigationConcept.actions.navigate.bind(navigationConcept.actions);
export const getCurrentUrl = navigationConcept.actions.getCurrentUrl.bind(navigationConcept.actions);

// DOM interaction
export const click = domConcept.actions.click.bind(domConcept.actions);
export const type = domConcept.actions.type.bind(domConcept.actions);
export const select = domConcept.actions.select.bind(domConcept.actions);
export const check = domConcept.actions.check.bind(domConcept.actions);
export const uncheck = domConcept.actions.uncheck.bind(domConcept.actions);

// DOM queries
export const getAttribute = domConcept.actions.getAttribute.bind(domConcept.actions);
export const getText = domConcept.actions.getText.bind(domConcept.actions);
export const isVisible = domConcept.actions.isVisible.bind(domConcept.actions);
export const exists = domConcept.actions.exists.bind(domConcept.actions);

// Wait functions
export const waitForSelector = waitConcept.actions.waitForSelector.bind(waitConcept.actions);
export const waitForText = waitConcept.actions.waitForText.bind(waitConcept.actions);
export const waitForHidden = waitConcept.actions.waitForHidden.bind(waitConcept.actions);

// Test structure
export const describe = testRunnerConcept.actions.describe.bind(testRunnerConcept.actions);
export const test = testRunnerConcept.actions.test.bind(testRunnerConcept.actions);

// Lifecycle hooks
export const beforeAll = testRunnerConcept.actions.beforeAll.bind(testRunnerConcept.actions);
export const afterAll = testRunnerConcept.actions.afterAll.bind(testRunnerConcept.actions);
export const beforeEach = testRunnerConcept.actions.beforeEach.bind(testRunnerConcept.actions);
export const afterEach = testRunnerConcept.actions.afterEach.bind(testRunnerConcept.actions);

// Test execution
export const run = testRunnerConcept.actions.run.bind(testRunnerConcept.actions);

// Assertions
export const expect = assertionConcept.actions.expect.bind(assertionConcept.actions);

// Reporting (for advanced usage)
export const generateReport = reportConcept.actions.generateReport.bind(reportConcept.actions);
export const getTrace = traceConcept.actions.getRecentTrace.bind(traceConcept.actions);

// Export error classes for custom error handling
export * from './errors/index.js';

// Export concepts for advanced usage/testing
export {
  browserConcept,
  contextConcept,
  navigationConcept,
  domConcept,
  waitConcept,
  testRunnerConcept,
  assertionConcept,
  traceConcept,
  reportConcept
};
