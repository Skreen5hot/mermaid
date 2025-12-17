/**
 * Synchronizations
 * Declarative cross-concept event wiring following Concepts + Synchronizations pattern.
 *
 * Each synchronization defines:
 * - when: Event name to listen for
 * - from: Source concept
 * - do: Action to execute (can reference other concepts)
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

export const synchronizations = [
  // Browser launch triggers context creation
  {
    when: 'browserLaunched',
    from: browserConcept,
    do: (payload) => {
      contextConcept.actions.createContext();
    }
  },

  // Browser launch logs to trace
  {
    when: 'browserLaunched',
    from: browserConcept,
    do: (payload) => {
      traceConcept.actions.logAction('browserLaunch', {
        success: true,
        ...payload
      });
    }
  },

  // Navigation completion logs to trace
  {
    when: 'navigationCompleted',
    from: navigationConcept,
    do: (payload) => {
      traceConcept.actions.logAction('navigate', {
        success: true,
        url: payload.url,
        duration: payload.metrics?.load || 0,
        ...payload
      });
    }
  },

  // Navigation failure logs to trace
  {
    when: 'navigationFailed',
    from: navigationConcept,
    do: (payload) => {
      traceConcept.actions.logAction('navigate', {
        success: false,
        url: payload.url,
        error: payload.error,
        ...payload
      });
    }
  },

  // DOM interaction logs to trace
  {
    when: 'elementInteracted',
    from: domConcept,
    do: (payload) => {
      traceConcept.actions.logAction('interact', {
        success: payload.success,
        selector: payload.selector,
        elementSnapshot: payload.snapshot,
        ...payload
      });
    }
  },

  // Element query logs to trace
  {
    when: 'elementQueried',
    from: domConcept,
    do: (payload) => {
      traceConcept.actions.logAction('query', {
        success: true,
        selector: payload.selector,
        result: payload.result,
        ...payload
      });
    }
  },

  // Wait completion logs to trace
  {
    when: 'waitCompleted',
    from: waitConcept,
    do: (payload) => {
      traceConcept.actions.logAction('wait', {
        success: true,
        selector: payload.selector,
        duration: payload.duration,
        ...payload
      });
    }
  },

  // Wait timeout logs to trace
  {
    when: 'waitTimedOut',
    from: waitConcept,
    do: (payload) => {
      traceConcept.actions.logAction('wait', {
        success: false,
        selector: payload.selector,
        timeout: payload.timeout,
        ...payload
      });
    }
  },

  // Test start creates isolated context
  {
    when: 'testStarted',
    from: testRunnerConcept,
    do: (payload) => {
      contextConcept.actions.createContext();
      traceConcept.actions.logAction('testStart', {
        success: true,
        testName: payload.name,
        ...payload
      });
    }
  },

  // Test completion destroys context
  {
    when: 'testCompleted',
    from: testRunnerConcept,
    do: (payload) => {
      if (contextConcept.state.activeContext) {
        contextConcept.actions.destroyContext(contextConcept.state.activeContext);
      }
      traceConcept.actions.logAction('testComplete', {
        success: payload.status === 'passed',
        testName: payload.name,
        duration: payload.duration,
        ...payload
      });
    }
  },

  // Suite completion triggers report generation
  {
    when: 'suiteCompleted',
    from: testRunnerConcept,
    do: (payload) => {
      reportConcept.actions.generateReport(payload);
    }
  },

  // Assertion failure includes trace context
  {
    when: 'assertionFailed',
    from: assertionConcept,
    do: (payload) => {
      const recentTrace = traceConcept.actions.getRecentTrace(10);
      // Error is already thrown by assertion concept
      // This just ensures trace is attached
      if (payload.recentTrace === undefined) {
        payload.recentTrace = recentTrace;
      }
    }
  },

  // Assertion success logs to trace
  {
    when: 'assertionPassed',
    from: assertionConcept,
    do: (payload) => {
      traceConcept.actions.logAction('assert', {
        success: true,
        matcher: payload.matcher,
        expected: payload.expected,
        actual: payload.actual
      });
    }
  }
];

/**
 * Initialize all synchronizations
 * Wires up event listeners between concepts
 */
export function initializeSynchronizations() {
  synchronizations.forEach(sync => {
    sync.from.subscribe((event, payload) => {
      if (event === sync.when) {
        sync.do(payload);
      }
    });
  });
}
