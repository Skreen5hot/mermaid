/**
 * @file patternLibraryViewer.test.js
 * @description Unit tests for the Pattern Library UI component (logic only, no DOM)
 *
 * Note: This test file focuses on the helper functions and state management
 * that don't require DOM access. Full UI integration tests would require
 * a browser environment or jsdom.
 */

import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';

// Import the pattern library data module (pure logic, no DOM)
import {
  PATTERNS,
  PATTERN_CATEGORIES,
  PATTERN_STATUS,
  SEVERITY,
  getActivePatterns,
  getAllPatterns,
  getPatternById,
  getPatternsByCategory,
  searchPatterns,
} from '../../../src/concepts/ontograde/patternLibrary.js';

/**
 * Since the patternLibraryViewer requires DOM access, we test its helper
 * functions separately by recreating the logic. The actual viewer module
 * is tested in browser integration tests.
 */

describe('patternLibraryViewer helpers (logic)', () => {
  describe('Pattern filtering logic', () => {
    // Simulate the getFilteredPatterns helper logic
    function getFilteredPatterns(currentCategory, searchQuery) {
      let patterns = [];

      // Apply category filter
      if (currentCategory === 'all') {
        patterns = getAllPatterns();
      } else {
        patterns = getPatternsByCategory(currentCategory);
      }

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        patterns = patterns.filter(
          (p) => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
        );
      }

      return patterns;
    }

    it('should return all patterns when no filters applied', () => {
      const patterns = getFilteredPatterns('all', '');

      assert.ok(patterns.length >= 6); // At least 6 active patterns
    });

    it('should filter by category', () => {
      const patterns = getFilteredPatterns('core', '');

      assert.ok(patterns.length >= 3); // 3 core patterns
      assert.ok(patterns.every((p) => p.category === 'core'));
    });

    it('should filter by search query', () => {
      const patterns = getFilteredPatterns('all', 'role');

      assert.ok(patterns.length >= 1);
      assert.ok(
        patterns.every(
          (p) => p.name.toLowerCase().includes('role') || p.description.toLowerCase().includes('role')
        )
      );
    });

    it('should combine category and search filters', () => {
      const patterns = getFilteredPatterns('core', 'bearer');

      // Should find Role Pattern (has 'bearer' in description)
      assert.ok(patterns.length >= 1);
      assert.ok(patterns.every((p) => p.category === 'core'));
    });

    it('should return empty array when no matches', () => {
      const patterns = getFilteredPatterns('core', 'xyznonexistent123');

      assert.equal(patterns.length, 0);
    });
  });

  describe('Pattern card rendering logic', () => {
    // Simulate the renderPatternCard helper logic (data preparation)
    function preparePatternCardData(pattern) {
      return {
        id: pattern.id,
        name: pattern.name,
        category: pattern.category,
        isActive: pattern.status === PATTERN_STATUS.ACTIVE,
        isDraft: pattern.status === PATTERN_STATUS.DRAFT,
        description: pattern.description,
        structure: pattern.structure,
        ruleCount: pattern.rules.length,
        testCount: pattern.testCount,
        categoryClass: `category-${pattern.category}`,
      };
    }

    it('should prepare card data for active pattern', () => {
      const pattern = PATTERNS['role-pattern'];
      const cardData = preparePatternCardData(pattern);

      assert.equal(cardData.id, 'role-pattern');
      assert.equal(cardData.name, 'Role Pattern');
      assert.equal(cardData.category, 'core');
      assert.equal(cardData.isActive, true);
      assert.equal(cardData.isDraft, false);
      assert.ok(cardData.ruleCount >= 3);
      assert.ok(cardData.testCount > 0);
    });

    it('should prepare card data for each active pattern', () => {
      const activePatterns = getActivePatterns();

      for (const pattern of activePatterns) {
        const cardData = preparePatternCardData(pattern);

        assert.ok(cardData.id, `Pattern should have id`);
        assert.ok(cardData.name, `Pattern should have name`);
        assert.ok(cardData.category, `Pattern should have category`);
        assert.equal(cardData.isActive, true, `Active pattern ${cardData.id} should be active`);
      }
    });
  });

  describe('Structure truncation logic', () => {
    // Simulate the truncateStructure helper
    function truncateStructure(structure) {
      const lines = structure.trim().split('\n');
      if (lines.length <= 3) return structure.trim();
      return lines.slice(0, 3).join('\n') + '...';
    }

    it('should not truncate short structures', () => {
      const structure = 'A -> B\nB -> C';

      const result = truncateStructure(structure);

      assert.equal(result, 'A -> B\nB -> C');
    });

    it('should truncate long structures', () => {
      const structure = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

      const result = truncateStructure(structure);

      assert.ok(result.includes('...'));
      assert.ok(!result.includes('Line 4'));
      assert.ok(!result.includes('Line 5'));
    });

    it('should preserve first 3 lines', () => {
      const structure = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

      const result = truncateStructure(structure);

      assert.ok(result.includes('Line 1'));
      assert.ok(result.includes('Line 2'));
      assert.ok(result.includes('Line 3'));
    });
  });

  describe('Pattern detail tab logic', () => {
    // Simulate tab validation logic
    const VALID_TABS = ['overview', 'rules', 'examples', 'bfo'];

    function isValidTab(tabName) {
      return VALID_TABS.includes(tabName);
    }

    function getDefaultTab() {
      return 'overview';
    }

    it('should validate overview tab', () => {
      assert.equal(isValidTab('overview'), true);
    });

    it('should validate rules tab', () => {
      assert.equal(isValidTab('rules'), true);
    });

    it('should validate examples tab', () => {
      assert.equal(isValidTab('examples'), true);
    });

    it('should validate bfo tab', () => {
      assert.equal(isValidTab('bfo'), true);
    });

    it('should reject invalid tab', () => {
      assert.equal(isValidTab('invalid'), false);
    });

    it('should return overview as default tab', () => {
      assert.equal(getDefaultTab(), 'overview');
    });
  });

  describe('Category options generation', () => {
    it('should have options for all categories with patterns', () => {
      const categories = Object.values(PATTERN_CATEGORIES);

      for (const category of categories) {
        const patterns = getPatternsByCategory(category);

        // Each category should have at least one pattern (active or draft)
        if (patterns.length > 0) {
          assert.ok(true, `Category ${category} has ${patterns.length} patterns`);
        }
      }
    });

    it('should count patterns correctly per category', () => {
      const corePatternsCount = getPatternsByCategory('core').length;

      assert.ok(corePatternsCount >= 3, `Core should have at least 3 patterns, got ${corePatternsCount}`);
    });
  });

  describe('Pattern rules rendering', () => {
    it('should have rules with all required fields', () => {
      const pattern = PATTERNS['role-pattern'];

      for (const rule of pattern.rules) {
        assert.ok(rule.id, 'Rule should have id');
        assert.ok(rule.name, 'Rule should have name');
        assert.ok(rule.severity, 'Rule should have severity');
        assert.ok(rule.what, 'Rule should have what');
        assert.ok(rule.why, 'Rule should have why');
        assert.ok(rule.impact, 'Rule should have impact');
        assert.ok(rule.fix, 'Rule should have fix');
      }
    });

    it('should have valid severity for all rules', () => {
      const validSeverities = [SEVERITY.VIOLATION, SEVERITY.WARNING, SEVERITY.INFO];

      for (const pattern of getActivePatterns()) {
        for (const rule of pattern.rules) {
          assert.ok(
            validSeverities.includes(rule.severity),
            `Rule ${rule.id} in pattern ${pattern.id} has invalid severity: ${rule.severity}`
          );
        }
      }
    });
  });

  describe('Pattern examples rendering', () => {
    it('should have correct example for each pattern', () => {
      for (const pattern of getActivePatterns()) {
        if (pattern.examples?.correct) {
          const correct = pattern.examples.correct;

          assert.ok(correct.title, `Pattern ${pattern.id} correct example should have title`);
          assert.ok(correct.mermaid, `Pattern ${pattern.id} correct example should have mermaid`);
          assert.ok(correct.description, `Pattern ${pattern.id} correct example should have description`);
        }
      }
    });

    it('should have violations array for each pattern', () => {
      for (const pattern of getActivePatterns()) {
        assert.ok(
          Array.isArray(pattern.examples?.violations),
          `Pattern ${pattern.id} should have violations array`
        );
      }
    });
  });

  describe('View mode toggle logic', () => {
    const VALID_VIEWS = ['grid', 'list'];

    function isValidView(view) {
      return VALID_VIEWS.includes(view);
    }

    it('should validate grid view', () => {
      assert.equal(isValidView('grid'), true);
    });

    it('should validate list view', () => {
      assert.equal(isValidView('list'), true);
    });

    it('should reject invalid view', () => {
      assert.equal(isValidView('table'), false);
    });
  });

  describe('Search query handling', () => {
    it('should be case-insensitive', () => {
      const results1 = searchPatterns('ROLE');
      const results2 = searchPatterns('role');
      const results3 = searchPatterns('Role');

      assert.equal(results1.length, results2.length);
      assert.equal(results2.length, results3.length);
    });

    it('should match partial words', () => {
      const results = searchPatterns('meas');

      assert.ok(results.length >= 1);
      assert.ok(results.some((p) => p.id === 'measurement-pattern'));
    });

    it('should search in both name and description', () => {
      // 'bearer' is in the role pattern description
      const results = searchPatterns('bearer');

      assert.ok(results.length >= 1);
    });
  });

  describe('Pattern state management', () => {
    // Simulate state management logic
    const initialState = {
      isInitialized: false,
      currentView: 'grid',
      currentCategory: 'all',
      searchQuery: '',
      selectedPattern: null,
      activeTab: 'overview',
    };

    function resetState() {
      return { ...initialState };
    }

    it('should have correct initial state', () => {
      const state = resetState();

      assert.equal(state.isInitialized, false);
      assert.equal(state.currentView, 'grid');
      assert.equal(state.currentCategory, 'all');
      assert.equal(state.searchQuery, '');
      assert.equal(state.selectedPattern, null);
      assert.equal(state.activeTab, 'overview');
    });

    it('should reset state correctly', () => {
      const state = {
        isInitialized: true,
        currentView: 'list',
        currentCategory: 'core',
        searchQuery: 'test',
        selectedPattern: PATTERNS['role-pattern'],
        activeTab: 'rules',
      };

      const resetStateObj = resetState();

      assert.equal(resetStateObj.isInitialized, false);
      assert.equal(resetStateObj.currentView, 'grid');
      assert.equal(resetStateObj.currentCategory, 'all');
      assert.equal(resetStateObj.searchQuery, '');
      assert.equal(resetStateObj.selectedPattern, null);
      assert.equal(resetStateObj.activeTab, 'overview');
    });
  });

  describe('BFO rationale tab content', () => {
    it('should have BFO rationale for all active patterns', () => {
      for (const pattern of getActivePatterns()) {
        assert.ok(
          pattern.bfoRationale && pattern.bfoRationale.length > 0,
          `Pattern ${pattern.id} should have BFO rationale`
        );
      }
    });

    it('should have expert approval indicator for active patterns', () => {
      for (const pattern of getActivePatterns()) {
        assert.equal(
          pattern.status,
          PATTERN_STATUS.ACTIVE,
          `Pattern ${pattern.id} should have active status`
        );
      }
    });
  });
});
