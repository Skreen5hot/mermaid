/**
 * Unit tests for reportGenerator
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reportGenerator } from '../../../src/concepts/ontograde/reportGenerator.js';

// Test fixtures
const perfectScoreResult = {
  diagramId: 'test-1',
  finalScore: 5.0,
  breakdown: {
    bfo: { score: 100, weight: 0.3, contribution: 30, details: { totalClasses: 10, rootedClasses: 10, orphanClasses: 0 } },
    patterns: { score: 100, weight: 0.3, contribution: 30, details: { complianceScore: 100, violations: 0 } },
    logic: { score: 100, weight: 0.4, contribution: 40, details: { integrityScore: 100, inconsistencies: 0 } },
  },
  summary: {
    bfo_rooting: 'Pass',
    logic_consistency: 'Pass',
    pattern_adherence: 'Pass',
  },
  violations: [],
  timestamp: '2026-01-09T12:00:00Z',
};

const partialScoreResult = {
  diagramId: 'test-2',
  finalScore: 3.5,
  breakdown: {
    bfo: { score: 70, weight: 0.3, contribution: 21, details: { totalClasses: 10, rootedClasses: 7, orphanClasses: 3 } },
    patterns: { score: 80, weight: 0.3, contribution: 24, details: { complianceScore: 80, violations: 2 } },
    logic: { score: 90, weight: 0.4, contribution: 36, details: { integrityScore: 90, inconsistencies: 1 } },
  },
  summary: {
    bfo_rooting: 'Partial (7/10 classes rooted)',
    logic_consistency: 'Partial (1 inconsistencies)',
    pattern_adherence: 'Partial (2 violations)',
  },
  violations: [
    { type: 'BFO', severity: 'error', description: 'Orphan class', entity: 'ex:Orphan1' },
    { type: 'SHACL', severity: 'warning', description: 'Missing link', entity: 'ex:Entity1', pattern: 'Role Pattern' },
    { type: 'Logic', severity: 'error', description: 'Type collision', entity: 'ex:Entity2', inconsistencyType: 'type_collision' },
  ],
  timestamp: '2026-01-09T12:00:00Z',
};

describe('reportGenerator', () => {
  describe('generate', () => {
    it('should generate JSON-LD report from score result', () => {
      const report = reportGenerator.actions.generate({ scoreResult: perfectScoreResult });

      assert.ok(report);
      assert.equal(report['@type'], 'OntologyQualityReport');
      assert.equal(report.ontograde_version, '2.0');
      assert.equal(report.final_score, 5.0);
    });

    it('should include context and type', () => {
      const report = reportGenerator.actions.generate({ scoreResult: perfectScoreResult });

      assert.equal(report['@context'], 'https://ontograde.org/context/v2');
      assert.equal(report['@type'], 'OntologyQualityReport');
    });

    it('should include timestamp', () => {
      const report = reportGenerator.actions.generate({ scoreResult: perfectScoreResult });

      assert.ok(report.timestamp);
      assert.equal(report.timestamp, perfectScoreResult.timestamp);
    });

    it('should include summary', () => {
      const report = reportGenerator.actions.generate({ scoreResult: perfectScoreResult });

      assert.ok(report.summary);
      assert.equal(report.summary.bfo_rooting, 'Pass');
      assert.equal(report.summary.pattern_adherence, 'Pass');
      assert.equal(report.summary.logic_consistency, 'Pass');
    });

    it('should include breakdown with scores and weights', () => {
      const report = reportGenerator.actions.generate({ scoreResult: perfectScoreResult });

      assert.ok(report.breakdown);
      assert.ok(report.breakdown.bfo_rooting);
      assert.equal(report.breakdown.bfo_rooting.score, 100);
      assert.equal(report.breakdown.bfo_rooting.weight, 0.3);
      assert.ok(report.breakdown.bfo_rooting.details);
    });

    it('should include violations', () => {
      const report = reportGenerator.actions.generate({ scoreResult: partialScoreResult });

      assert.ok(report.violations);
      assert.equal(report.violations.length, 3);
    });

    it('should generate recommendations', () => {
      const report = reportGenerator.actions.generate({ scoreResult: partialScoreResult });

      assert.ok(report.recommendations);
      assert.ok(report.recommendations.length > 0);
    });

    it('should emit reportReady event', (t, done) => {
      const handler = (event, payload) => {
        if (event === 'reportReady') {
          assert.equal(payload.diagramId, perfectScoreResult.diagramId);
          assert.ok(payload.report);
          reportGenerator.unsubscribe(handler);
          done();
        }
      };

      reportGenerator.subscribe(handler);
      reportGenerator.actions.generate({ scoreResult: perfectScoreResult });
    });

    it('should store report in state', () => {
      reportGenerator.actions.generate({ scoreResult: perfectScoreResult });

      const stored = reportGenerator.state.reports.get(perfectScoreResult.diagramId);
      assert.ok(stored);
      assert.equal(stored.final_score, 5.0);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate BFO rooting recommendations', () => {
      const violations = [
        { type: 'BFO', entity: 'ex:Orphan1' },
        { type: 'BFO', entity: 'ex:Orphan2' },
      ];

      const recommendations = reportGenerator.helpers.generateRecommendations(violations, perfectScoreResult.breakdown);

      assert.ok(recommendations.some(r => r.includes('Root') && r.includes('orphan')));
    });

    it('should generate pattern recommendations', () => {
      const violations = [
        { type: 'SHACL', pattern: 'Information Staircase' },
        { type: 'SHACL', pattern: 'Role Pattern' },
      ];

      const recommendations = reportGenerator.helpers.generateRecommendations(violations, perfectScoreResult.breakdown);

      assert.ok(recommendations.some(r => r.includes('Information Staircase')));
      assert.ok(recommendations.some(r => r.includes('Role Pattern')));
    });

    it('should generate logic recommendations', () => {
      const violations = [
        { type: 'Logic', inconsistencyType: 'type_collision' },
      ];

      const recommendations = reportGenerator.helpers.generateRecommendations(violations, perfectScoreResult.breakdown);

      assert.ok(recommendations.some(r => r.includes('type collision')));
    });

    it('should add positive feedback for perfect score', () => {
      const recommendations = reportGenerator.helpers.generateRecommendations([], perfectScoreResult.breakdown);

      assert.ok(recommendations.some(r => r.includes('Excellent') || r.includes('🎉')));
    });
  });

  describe('formatAsText', () => {
    it('should format report as readable text', () => {
      const report = reportGenerator.actions.generate({ scoreResult: perfectScoreResult });
      const text = reportGenerator.helpers.formatAsText(report);

      assert.ok(text);
      assert.ok(text.includes('OntoGrade Quality Report'));
      assert.ok(text.includes('5.0'));
      assert.ok(text.includes('FINAL SCORE'));
    });

    it('should include all sections', () => {
      const report = reportGenerator.actions.generate({ scoreResult: partialScoreResult });
      const text = reportGenerator.helpers.formatAsText(report);

      assert.ok(text.includes('SUMMARY'));
      assert.ok(text.includes('BREAKDOWN'));
      assert.ok(text.includes('VIOLATIONS'));
      assert.ok(text.includes('RECOMMENDATIONS'));
    });
  });
});
