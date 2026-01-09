/**
 * Unit tests for gradingEngine
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { gradingEngine } from '../../../src/concepts/ontograde/gradingEngine.js';

// Test fixtures
const perfectBFOResult = {
  pass: true,
  totalClasses: 10,
  rootedClasses: 10,
  orphanClasses: 0,
  orphans: [],
};

const partialBFOResult = {
  pass: false,
  totalClasses: 10,
  rootedClasses: 7,
  orphanClasses: 3,
  orphans: ['http://example.org/Orphan1', 'http://example.org/Orphan2', 'http://example.org/Orphan3'],
};

const perfectPatternsResult = {
  pass: true,
  complianceScore: 100,
  violations: [],
};

const partialPatternsResult = {
  pass: false,
  complianceScore: 67,
  violations: [
    { type: 'SHACL', severity: 'warning', pattern: 'Role Pattern', subject: 'ex:Role1', message: 'Missing bearer' },
  ],
};

const perfectLogicResult = {
  pass: true,
  integrityScore: 100,
  inconsistencies: [],
};

const partialLogicResult = {
  pass: false,
  integrityScore: 80,
  inconsistencies: [
    { type: 'type_collision', severity: 'error', subject: 'ex:Entity1', message: 'Both Process and Object' },
  ],
};

describe('gradingEngine', () => {
  beforeEach(() => {
    // Clear state before each test
    gradingEngine.state.pendingResults.clear();
    gradingEngine.state.scoreResults.clear();
  });

  describe('Result Registration', () => {
    it('should register BFO result and wait for others', () => {
      gradingEngine.actions.registerResult({
        diagramId: 'test-1',
        validator: 'bfo',
        result: perfectBFOResult,
      });

      const pending = gradingEngine.state.pendingResults.get('test-1');
      assert.ok(pending);
      assert.ok(pending.bfo);
      assert.ok(!pending.patterns);
      assert.ok(!pending.logic);
    });

    it('should calculate score when all 3 validators complete', (t, done) => {
      const handler = (event, payload) => {
        if (event === 'scoreCalculated') {
          assert.equal(payload.diagramId, 'test-1');
          assert.ok(payload.scoreResult);
          assert.equal(typeof payload.scoreResult.finalScore, 'number');
          gradingEngine.unsubscribe(handler);
          done();
        }
      };

      gradingEngine.subscribe(handler);

      // Register all 3 results
      gradingEngine.actions.registerResult({ diagramId: 'test-1', validator: 'bfo', result: perfectBFOResult });
      gradingEngine.actions.registerResult({ diagramId: 'test-1', validator: 'patterns', result: perfectPatternsResult });
      gradingEngine.actions.registerResult({ diagramId: 'test-1', validator: 'logic', result: perfectLogicResult });
    });

    it('should handle multiple diagrams independently', () => {
      gradingEngine.actions.registerResult({ diagramId: 'test-1', validator: 'bfo', result: perfectBFOResult });
      gradingEngine.actions.registerResult({ diagramId: 'test-2', validator: 'patterns', result: perfectPatternsResult });

      assert.ok(gradingEngine.state.pendingResults.has('test-1'));
      assert.ok(gradingEngine.state.pendingResults.has('test-2'));
      assert.notEqual(gradingEngine.state.pendingResults.get('test-1'), gradingEngine.state.pendingResults.get('test-2'));
    });
  });

  describe('Score Calculation', () => {
    it('should calculate 5.0 for perfect results', () => {
      gradingEngine.actions.calculateScore({
        diagramId: 'test-perfect',
        results: {
          bfo: perfectBFOResult,
          patterns: perfectPatternsResult,
          logic: perfectLogicResult,
        },
      });

      const result = gradingEngine.state.scoreResults.get('test-perfect');
      assert.equal(result.finalScore, 5.0);
    });

    it('should calculate weighted score correctly', () => {
      // BFO: 70% (70 * 0.3 = 21)
      // Patterns: 60% (60 * 0.3 = 18)
      // Logic: 80% (80 * 0.4 = 32)
      // Total: 71% → 3.55/5

      gradingEngine.actions.calculateScore({
        diagramId: 'test-weighted',
        results: {
          bfo: { ...perfectBFOResult, totalClasses: 10, rootedClasses: 7 },
          patterns: { ...perfectPatternsResult, complianceScore: 60 },
          logic: { ...perfectLogicResult, integrityScore: 80 },
        },
      });

      const result = gradingEngine.state.scoreResults.get('test-weighted');
      assert.ok(result.finalScore >= 3.5 && result.finalScore <= 3.6);
    });

    it('should include breakdown for all validators', () => {
      gradingEngine.actions.calculateScore({
        diagramId: 'test-breakdown',
        results: {
          bfo: perfectBFOResult,
          patterns: perfectPatternsResult,
          logic: perfectLogicResult,
        },
      });

      const result = gradingEngine.state.scoreResults.get('test-breakdown');
      assert.ok(result.breakdown);
      assert.ok(result.breakdown.bfo);
      assert.ok(result.breakdown.patterns);
      assert.ok(result.breakdown.logic);
      assert.equal(result.breakdown.bfo.weight, 0.3);
      assert.equal(result.breakdown.patterns.weight, 0.3);
      assert.equal(result.breakdown.logic.weight, 0.4);
    });

    it('should create summary status', () => {
      gradingEngine.actions.calculateScore({
        diagramId: 'test-summary',
        results: {
          bfo: partialBFOResult,
          patterns: perfectPatternsResult,
          logic: partialLogicResult,
        },
      });

      const result = gradingEngine.state.scoreResults.get('test-summary');
      assert.ok(result.summary);
      assert.ok(result.summary.bfo_rooting.includes('Partial'));
      assert.equal(result.summary.pattern_adherence, 'Pass');
      assert.ok(result.summary.logic_consistency.includes('Partial'));
    });

    it('should collect all violations', () => {
      gradingEngine.actions.calculateScore({
        diagramId: 'test-violations',
        results: {
          bfo: partialBFOResult,
          patterns: partialPatternsResult,
          logic: partialLogicResult,
        },
      });

      const result = gradingEngine.state.scoreResults.get('test-violations');
      assert.ok(result.violations);
      assert.equal(result.violations.length, 5); // 3 BFO + 1 pattern + 1 logic

      const bfoViolations = result.violations.filter(v => v.type === 'BFO');
      const shaclViolations = result.violations.filter(v => v.type === 'SHACL');
      const logicViolations = result.violations.filter(v => v.type === 'Logic');

      assert.equal(bfoViolations.length, 3);
      assert.equal(shaclViolations.length, 1);
      assert.equal(logicViolations.length, 1);
    });
  });

  describe('Individual Score Calculations', () => {
    it('calculateBFOScore should return 100 for all rooted', () => {
      const score = gradingEngine.helpers.calculateBFOScore(perfectBFOResult);
      assert.equal(score, 100);
    });

    it('calculateBFOScore should return percentage for partial', () => {
      const score = gradingEngine.helpers.calculateBFOScore(partialBFOResult);
      assert.equal(score, 70); // 7/10 = 70%
    });

    it('calculateBFOScore should return 100 for empty graph', () => {
      const score = gradingEngine.helpers.calculateBFOScore({ totalClasses: 0, rootedClasses: 0 });
      assert.equal(score, 100);
    });

    it('calculatePatternsScore should use complianceScore', () => {
      const score = gradingEngine.helpers.calculatePatternsScore(perfectPatternsResult);
      assert.equal(score, 100);

      const partialScore = gradingEngine.helpers.calculatePatternsScore(partialPatternsResult);
      assert.equal(partialScore, 67);
    });

    it('calculateLogicScore should use integrityScore', () => {
      const score = gradingEngine.helpers.calculateLogicScore(perfectLogicResult);
      assert.equal(score, 100);

      const partialScore = gradingEngine.helpers.calculateLogicScore(partialLogicResult);
      assert.equal(partialScore, 80);
    });
  });

  describe('getSummaryText', () => {
    it('should return excellent for high scores', () => {
      const scoreResult = {
        finalScore: 4.8,
        violations: [],
      };

      const text = gradingEngine.helpers.getSummaryText(scoreResult);
      assert.ok(text.includes('Excellent'));
      assert.ok(text.includes('4.8'));
    });

    it('should return good for medium-high scores', () => {
      const scoreResult = {
        finalScore: 3.7,
        violations: [{}],
      };

      const text = gradingEngine.helpers.getSummaryText(scoreResult);
      assert.ok(text.includes('Good'));
    });

    it('should return fair for medium scores', () => {
      const scoreResult = {
        finalScore: 2.8,
        violations: [{}, {}],
      };

      const text = gradingEngine.helpers.getSummaryText(scoreResult);
      assert.ok(text.includes('Fair'));
    });

    it('should return needs work for low scores', () => {
      const scoreResult = {
        finalScore: 1.5,
        violations: [{}, {}, {}],
      };

      const text = gradingEngine.helpers.getSummaryText(scoreResult);
      assert.ok(text.includes('needs significant work'));
    });
  });
});
