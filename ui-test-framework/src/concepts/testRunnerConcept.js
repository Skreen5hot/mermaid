/**
 * Test Runner Concept
 * Orchestrates test execution, lifecycle hooks, and test isolation.
 *
 * FR-30: Test Structure
 * FR-31: Lifecycle Hooks
 * FR-32: Test Isolation
 */

import { contextConcept } from './contextConcept.js';
import { browserConcept } from './browserConcept.js';

export const testRunnerConcept = {
  state: {
    suites: [],              // Test suite registry
    currentSuite: null,
    currentTest: null,
    globalHooks: {
      beforeAll: [],
      afterAll: [],
      beforeEach: [],
      afterEach: []
    },
    results: [],
    isRunning: false
  },

  actions: {
    /**
     * Register test suite
     * @param {string} name - Suite name
     * @param {Function} fn - Suite definition function
     */
    describe(name, fn) {
      const self = testRunnerConcept;

      // 1. Create suite object
      const suite = {
        name,
        tests: [],
        hooks: {
          beforeAll: [],
          afterAll: [],
          beforeEach: [],
          afterEach: []
        },
        fn
      };

      // 2. Set as current suite so tests can be added to it
      const previousSuite = self.state.currentSuite;
      self.state.currentSuite = suite;

      // 3. Execute fn to collect tests and hooks
      try {
        fn();
      } finally {
        self.state.currentSuite = previousSuite;
      }

      // 4. Add to suites registry
      self.state.suites.push(suite);

      self.notify('suiteRegistered', {
        name,
        testCount: suite.tests.length
      });
    },

    /**
     * Register test
     * @param {string} name - Test name
     * @param {Function} fn - Test function
     */
    test(name, fn) {
      const self = testRunnerConcept;

      // 1. Create test object
      const test = {
        name,
        fn,
        suite: self.state.currentSuite?.name || 'default'
      };

      // 2. Add to current suite
      if (self.state.currentSuite) {
        self.state.currentSuite.tests.push(test);
      } else {
        // If no suite is active, create a default suite
        if (self.state.suites.length === 0 || self.state.suites[0].name !== 'default') {
          self.state.suites.unshift({
            name: 'default',
            tests: [],
            hooks: {
              beforeAll: [],
              afterAll: [],
              beforeEach: [],
              afterEach: []
            }
          });
        }
        self.state.suites[0].tests.push(test);
      }
    },

    /**
     * Register beforeAll hook
     * @param {Function} fn - Hook function
     */
    beforeAll(fn) {
      const self = testRunnerConcept;

      if (self.state.currentSuite) {
        self.state.currentSuite.hooks.beforeAll.push(fn);
      } else {
        self.state.globalHooks.beforeAll.push(fn);
      }
    },

    /**
     * Register afterAll hook
     * @param {Function} fn - Hook function
     */
    afterAll(fn) {
      const self = testRunnerConcept;

      if (self.state.currentSuite) {
        self.state.currentSuite.hooks.afterAll.push(fn);
      } else {
        self.state.globalHooks.afterAll.push(fn);
      }
    },

    /**
     * Register beforeEach hook
     * @param {Function} fn - Hook function
     */
    beforeEach(fn) {
      const self = testRunnerConcept;

      if (self.state.currentSuite) {
        self.state.currentSuite.hooks.beforeEach.push(fn);
      } else {
        self.state.globalHooks.beforeEach.push(fn);
      }
    },

    /**
     * Register afterEach hook
     * @param {Function} fn - Hook function
     */
    afterEach(fn) {
      const self = testRunnerConcept;

      if (self.state.currentSuite) {
        self.state.currentSuite.hooks.afterEach.push(fn);
      } else {
        self.state.globalHooks.afterEach.push(fn);
      }
    },

    /**
     * Execute all tests sequentially
     * @param {Object} options - Run options
     * @returns {Promise<Object>} Test results
     */
    async run(options = {}) {
      const self = testRunnerConcept;
      const isolate = options.isolate !== false; // Default true
      const startTime = Date.now();

      self.state.isRunning = true;
      self.state.results = [];

      self.notify('runStarted', {
        suiteCount: self.state.suites.length,
        isolate
      });

      try {
        // 1. Execute global beforeAll hooks
        for (const hook of self.state.globalHooks.beforeAll) {
          await hook();
        }

        // 2. Execute each suite
        for (const suite of self.state.suites) {
          await self.actions._executeSuite(suite, { isolate });
        }

        // 3. Execute global afterAll hooks
        for (const hook of self.state.globalHooks.afterAll) {
          await hook();
        }

        // 4. Aggregate results
        const stats = aggregateResults(self.state.results);
        const duration = Date.now() - startTime;

        const summary = {
          ...stats,
          totalDuration: duration,
          results: self.state.results
        };

        // 5. Emit runCompleted event
        self.notify('runCompleted', summary);

        return summary;

      } finally {
        self.state.isRunning = false;
      }
    },

    /**
     * Execute a single test suite
     * @param {Object} suite - Test suite
     * @param {Object} options - Execution options
     */
    async _executeSuite(suite, options = {}) {
      const self = testRunnerConcept;

      self.notify('suiteStarted', {
        name: suite.name,
        testCount: suite.tests.length
      });

      const startTime = Date.now();

      try {
        // Execute suite beforeAll hooks
        for (const hook of suite.hooks.beforeAll) {
          await hook();
        }

        // Execute each test
        for (const test of suite.tests) {
          await self.actions._executeTest(test, suite, options);
        }

        // Execute suite afterAll hooks
        for (const hook of suite.hooks.afterAll) {
          await hook();
        }

        self.notify('suiteCompleted', {
          name: suite.name,
          duration: Date.now() - startTime
        });

      } catch (err) {
        self.notify('suiteFailed', {
          name: suite.name,
          error: err
        });
      }
    },

    /**
     * Execute a single test
     * @param {Object} test - Test object
     * @param {Object} suite - Parent suite
     * @param {Object} options - Execution options
     */
    async _executeTest(test, suite, options = {}) {
      const self = testRunnerConcept;
      const isolate = options.isolate !== false;

      self.state.currentTest = test;

      self.notify('testStarted', {
        name: test.name,
        suite: suite.name
      });

      const startTime = Date.now();
      const result = {
        name: test.name,
        suite: suite.name,
        status: 'passed',
        duration: 0,
        error: null
      };

      let contextId = null;

      try {
        // Create isolated context if requested
        if (isolate && browserConcept.state.browser) {
          contextId = await contextConcept.actions.createContext();
        }

        // Execute global beforeEach hooks
        for (const hook of self.state.globalHooks.beforeEach) {
          await hook();
        }

        // Execute suite beforeEach hooks
        for (const hook of suite.hooks.beforeEach) {
          await hook();
        }

        // Execute test function
        await test.fn();

        result.status = 'passed';

      } catch (err) {
        result.status = 'failed';
        result.error = {
          message: err.message,
          stack: err.stack,
          errorType: err.errorType || err.name
        };
      } finally {
        try {
          // Execute suite afterEach hooks
          for (const hook of suite.hooks.afterEach) {
            await hook();
          }

          // Execute global afterEach hooks
          for (const hook of self.state.globalHooks.afterEach) {
            await hook();
          }

          // Destroy context if created
          if (contextId) {
            await contextConcept.actions.destroyContext(contextId);
          }
        } catch (cleanupErr) {
          // Log cleanup errors but don't fail the test
          console.error('Cleanup error:', cleanupErr);
        }

        result.duration = Date.now() - startTime;
        self.state.results.push(result);

        self.notify('testCompleted', result);

        self.state.currentTest = null;
      }
    },

    /**
     * Clear all registered suites and hooks
     */
    reset() {
      const self = testRunnerConcept;

      self.state.suites = [];
      self.state.currentSuite = null;
      self.state.currentTest = null;
      self.state.globalHooks = {
        beforeAll: [],
        afterAll: [],
        beforeEach: [],
        afterEach: []
      };
      self.state.results = [];
    },

    /**
     * Get test results
     * @returns {Array} Test results
     */
    getResults() {
      return [...testRunnerConcept.state.results];
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

// Pure functions for test runner concept

/**
 * Build test execution plan from suites
 * @param {Array} suites - Test suites
 * @returns {Array} Ordered test plan
 */
export function buildTestPlan(suites) {
  const plan = [];
  for (const suite of suites) {
    for (const test of suite.tests) {
      plan.push({
        suite: suite.name,
        test: test.name,
        fn: test.fn
      });
    }
  }
  return plan;
}

/**
 * Aggregate test results into statistics
 * @param {Array} results - Test results
 * @returns {Object} Statistics
 */
export function aggregateResults(results) {
  const stats = {
    total: results.length,
    passed: 0,
    failed: 0,
    duration: 0
  };

  for (const result of results) {
    if (result.status === 'passed') {
      stats.passed++;
    } else {
      stats.failed++;
    }
    stats.duration += result.duration || 0;
  }

  return stats;
}
