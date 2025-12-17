/**
 * Report Concept
 * Generates test reports in console and JSON formats.
 *
 * FR-50: Test Reports
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';

export const reportConcept = {
  state: {
    outputDir: './test-results',
    consoleEnabled: true,
    jsonEnabled: true
  },

  actions: {
    /**
     * Generate test report
     * @param {Object} results - Test results with stats
     * @returns {Promise<void>}
     */
    async generateReport(results) {
      if (this.state.consoleEnabled) {
        const output = formatConsoleOutput(results);
        console.log(output);
      }

      if (this.state.jsonEnabled) {
        const jsonReport = buildJSONReport(results);
        await this.writeResultsFile(jsonReport);
      }

      this.notify('reportGenerated', {
        format: this.state.jsonEnabled ? 'json' : 'console'
      });
    },

    /**
     * Print summary to console
     * @param {Object} results - Test results
     */
    printSummary(results) {
      const summary = formatConsoleOutput(results);
      console.log(summary);
    },

    /**
     * Write results to JSON file
     * @param {Object} data - Report data
     * @returns {Promise<void>}
     */
    async writeResultsFile(data) {
      // TODO: Ensure output directory exists
      const filePath = join(this.state.outputDir, 'results.json');
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
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

// Pure functions for report concept

/**
 * Format test results for console output
 * @param {Object} results - Test results
 * @returns {string} Formatted console output
 */
export function formatConsoleOutput(results) {
  const lines = [];
  lines.push('\n' + '='.repeat(60));
  lines.push('  Test Results');
  lines.push('='.repeat(60));

  if (results.tests) {
    for (const test of results.tests) {
      const status = test.status === 'passed' ? '✓' : '✗';
      const color = test.status === 'passed' ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';
      lines.push(`${color}${status}${reset} ${test.suite} > ${test.name} (${test.duration}ms)`);

      if (test.error) {
        lines.push(`  Error: ${test.error.message}`);
      }
    }
  }

  lines.push('='.repeat(60));
  lines.push(`Total: ${results.stats.total}`);
  lines.push(`Passed: ${results.stats.passed}`);
  lines.push(`Failed: ${results.stats.failed}`);
  lines.push(`Duration: ${results.stats.duration}ms`);
  lines.push('='.repeat(60) + '\n');

  return lines.join('\n');
}

/**
 * Build JSON report structure
 * @param {Object} results - Test results
 * @returns {Object} JSON report
 */
export function buildJSONReport(results) {
  return {
    summary: {
      total: results.stats.total,
      passed: results.stats.passed,
      failed: results.stats.failed,
      duration: results.stats.duration,
      timestamp: Date.now()
    },
    tests: results.tests.map(test => ({
      suite: test.suite,
      name: test.name,
      status: test.status,
      duration: test.duration,
      error: test.error ? {
        type: test.error.errorType,
        message: test.error.message,
        stack: test.error.stack,
        context: test.error
      } : null
    }))
  };
}
