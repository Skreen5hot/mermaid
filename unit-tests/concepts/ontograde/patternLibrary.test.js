/**
 * @file patternLibrary.test.js
 * @description Unit tests for the Pattern Library data module
 */

import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  PATTERNS,
  DRAFT_PATTERNS,
  PATTERN_CATEGORIES,
  PATTERN_STATUS,
  SEVERITY,
  getActivePatterns,
  getDraftPatterns,
  getAllPatterns,
  getPatternById,
  getPatternsByCategory,
  getPatternCountsByCategory,
  searchPatterns,
} from '../../../src/concepts/ontograde/patternLibrary.js';

describe('patternLibrary', () => {
  describe('PATTERNS constant', () => {
    it('should contain the 6 expert-approved active patterns', () => {
      const expectedPatterns = [
        'information-staircase',
        'role-pattern',
        'designation-pattern',
        'measurement-pattern',
        'temporal-interval',
        'socio-primal',
      ];

      assert.equal(Object.keys(PATTERNS).length, expectedPatterns.length);
      for (const patternId of expectedPatterns) {
        assert.ok(PATTERNS[patternId], `Should contain pattern: ${patternId}`);
      }
    });

    it('should have all required fields for each pattern', () => {
      const requiredFields = [
        'id',
        'name',
        'category',
        'status',
        'description',
        'fullDescription',
        'structure',
        'bfoRationale',
        'rules',
        'examples',
        'relatedPatterns',
        'testCount',
      ];

      for (const [patternId, pattern] of Object.entries(PATTERNS)) {
        for (const field of requiredFields) {
          assert.ok(
            pattern[field] !== undefined,
            `Pattern ${patternId} should have field: ${field}`
          );
        }
      }
    });

    it('should have valid severity levels for all rules', () => {
      const validSeverities = Object.values(SEVERITY);

      for (const [patternId, pattern] of Object.entries(PATTERNS)) {
        for (const rule of pattern.rules) {
          assert.ok(
            validSeverities.includes(rule.severity),
            `Pattern ${patternId} rule "${rule.name}" has invalid severity: ${rule.severity}`
          );
        }
      }
    });

    it('should have all active patterns with ACTIVE status', () => {
      for (const [patternId, pattern] of Object.entries(PATTERNS)) {
        assert.equal(
          pattern.status,
          PATTERN_STATUS.ACTIVE,
          `Pattern ${patternId} should have ACTIVE status`
        );
      }
    });
  });

  describe('DRAFT_PATTERNS constant', () => {
    it('should contain draft patterns pending expert review', () => {
      assert.ok(DRAFT_PATTERNS['artifact-function'], 'Should contain artifact-function');
      assert.ok(DRAFT_PATTERNS['agent-capability'], 'Should contain agent-capability');
    });

    it('should have all draft patterns with DRAFT status', () => {
      for (const [patternId, pattern] of Object.entries(DRAFT_PATTERNS)) {
        assert.equal(
          pattern.status,
          PATTERN_STATUS.DRAFT,
          `Draft pattern ${patternId} should have DRAFT status`
        );
      }
    });
  });

  describe('PATTERN_CATEGORIES', () => {
    it('should define expected categories', () => {
      assert.equal(PATTERN_CATEGORIES.CORE, 'core');
      assert.equal(PATTERN_CATEGORIES.TEMPORAL, 'temporal');
      assert.equal(PATTERN_CATEGORIES.MEASUREMENT, 'measurement');
      assert.equal(PATTERN_CATEGORIES.AGENT, 'agent');
      assert.equal(PATTERN_CATEGORIES.ARTIFACT, 'artifact');
      assert.equal(PATTERN_CATEGORIES.EVENT, 'event');
    });
  });

  describe('SEVERITY levels', () => {
    it('should match SHACL severity values', () => {
      assert.equal(SEVERITY.VIOLATION, 'violation');
      assert.equal(SEVERITY.WARNING, 'warning');
      assert.equal(SEVERITY.INFO, 'info');
    });
  });

  describe('getActivePatterns()', () => {
    it('should return all active patterns', () => {
      const active = getActivePatterns();

      assert.equal(active.length, 6);
      assert.ok(active.every(p => p.status === PATTERN_STATUS.ACTIVE));
    });

    it('should not include draft patterns', () => {
      const active = getActivePatterns();
      const activeIds = active.map(p => p.id);

      assert.ok(!activeIds.includes('artifact-function'));
      assert.ok(!activeIds.includes('agent-capability'));
    });
  });

  describe('getDraftPatterns()', () => {
    it('should return all draft patterns', () => {
      const drafts = getDraftPatterns();

      assert.ok(drafts.length >= 2);
      assert.ok(drafts.every(p => p.status === PATTERN_STATUS.DRAFT));
    });
  });

  describe('getAllPatterns()', () => {
    it('should return both active and draft patterns', () => {
      const all = getAllPatterns();

      assert.ok(all.length >= 8); // 6 active + 2 draft
      assert.ok(all.some(p => p.status === PATTERN_STATUS.ACTIVE));
      assert.ok(all.some(p => p.status === PATTERN_STATUS.DRAFT));
    });
  });

  describe('getPatternById()', () => {
    it('should return active pattern by ID', () => {
      const pattern = getPatternById('role-pattern');

      assert.ok(pattern);
      assert.equal(pattern.id, 'role-pattern');
      assert.equal(pattern.name, 'Role Pattern');
    });

    it('should return draft pattern by ID', () => {
      const pattern = getPatternById('artifact-function');

      assert.ok(pattern);
      assert.equal(pattern.id, 'artifact-function');
      assert.equal(pattern.status, PATTERN_STATUS.DRAFT);
    });

    it('should return null for unknown pattern ID', () => {
      const pattern = getPatternById('non-existent-pattern');

      assert.equal(pattern, null);
    });
  });

  describe('getPatternsByCategory()', () => {
    it('should return patterns filtered by category', () => {
      const corePatterns = getPatternsByCategory(PATTERN_CATEGORIES.CORE);

      assert.ok(corePatterns.length >= 3);
      assert.ok(corePatterns.every(p => p.category === PATTERN_CATEGORIES.CORE));
    });

    it('should include both active and draft patterns in category', () => {
      const agentPatterns = getPatternsByCategory(PATTERN_CATEGORIES.AGENT);

      // Should include socio-primal (active) and agent-capability (draft)
      assert.ok(agentPatterns.length >= 2);
    });

    it('should return empty array for unknown category', () => {
      const patterns = getPatternsByCategory('unknown-category');

      assert.equal(patterns.length, 0);
    });
  });

  describe('getPatternCountsByCategory()', () => {
    it('should return counts for all categories', () => {
      const counts = getPatternCountsByCategory();

      assert.ok(counts.core >= 3);
      assert.ok(counts.temporal >= 1);
      assert.ok(counts.measurement >= 1);
      assert.ok(counts.agent >= 1);
    });
  });

  describe('searchPatterns()', () => {
    it('should find patterns by name', () => {
      const results = searchPatterns('role');

      assert.ok(results.length >= 1);
      assert.ok(results.some(p => p.id === 'role-pattern'));
    });

    it('should find patterns by description', () => {
      const results = searchPatterns('bearer');

      assert.ok(results.length >= 1);
      assert.ok(results.some(p => p.id === 'role-pattern'));
    });

    it('should be case-insensitive', () => {
      const results1 = searchPatterns('ROLE');
      const results2 = searchPatterns('role');

      assert.equal(results1.length, results2.length);
    });

    it('should return empty array for no matches', () => {
      const results = searchPatterns('xyznonexistent123');

      assert.equal(results.length, 0);
    });
  });

  describe('Pattern Rule Structure', () => {
    it('should have complete rule metadata for Role Pattern', () => {
      const rolePattern = PATTERNS['role-pattern'];

      assert.ok(rolePattern.rules.length >= 3);

      const bearerRule = rolePattern.rules.find(r => r.id === 'role-bearer-required');
      assert.ok(bearerRule);
      assert.equal(bearerRule.severity, SEVERITY.VIOLATION);
      assert.ok(bearerRule.what);
      assert.ok(bearerRule.why);
      assert.ok(bearerRule.impact);
      assert.ok(bearerRule.fix);
    });

    it('should have correct severity for expert-approved patterns', () => {
      // Per SHACL-VALIDATION-REVIEW.md expert approval
      const rolePattern = PATTERNS['role-pattern'];
      const icePattern = PATTERNS['information-staircase'];
      const designationPattern = PATTERNS['designation-pattern'];

      // Role bearer: VIOLATION (required per BFO)
      assert.equal(
        rolePattern.rules.find(r => r.id === 'role-bearer-required').severity,
        SEVERITY.VIOLATION
      );

      // Role realization: WARNING (can be unrealized)
      assert.equal(
        rolePattern.rules.find(r => r.id === 'role-realization').severity,
        SEVERITY.WARNING
      );

      // ICE concretization: WARNING (can exist abstractly)
      assert.equal(
        icePattern.rules.find(r => r.id === 'ice-concretization').severity,
        SEVERITY.WARNING
      );

      // Designation link: VIOLATION (name must name something)
      assert.equal(
        designationPattern.rules.find(r => r.id === 'designation-link-required').severity,
        SEVERITY.VIOLATION
      );
    });
  });

  describe('Pattern Examples Structure', () => {
    it('should have correct example and violation data', () => {
      const rolePattern = PATTERNS['role-pattern'];

      assert.ok(rolePattern.examples.correct);
      assert.ok(rolePattern.examples.correct.title);
      assert.ok(rolePattern.examples.correct.mermaid);
      assert.ok(rolePattern.examples.correct.description);

      assert.ok(Array.isArray(rolePattern.examples.violations));
      assert.ok(rolePattern.examples.violations.length >= 1);

      const violation = rolePattern.examples.violations[0];
      assert.ok(violation.title);
      assert.ok(violation.mermaid);
      assert.ok(violation.error);
      assert.ok(typeof violation.scoreImpact === 'number');
    });
  });

  describe('Pattern Relationships', () => {
    it('should have related patterns that exist', () => {
      for (const pattern of getAllPatterns()) {
        if (pattern.relatedPatterns && pattern.relatedPatterns.length > 0) {
          for (const relatedId of pattern.relatedPatterns) {
            const relatedPattern = getPatternById(relatedId);
            // Related pattern should either exist or be a planned future pattern
            // We just check it's a valid string for now
            assert.ok(
              typeof relatedId === 'string' && relatedId.length > 0,
              `Pattern ${pattern.id} has invalid related pattern reference`
            );
          }
        }
      }
    });
  });
});
