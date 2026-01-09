/**
 * @module gradingEngine
 * @description Aggregates results from all validators and calculates the final OntoGrade score
 */

const subscribers = new Set();

/**
 * Notifies all subscribed listeners of an event.
 * @param {string} event - The name of the event.
 * @param {*} payload - The data associated with the event.
 */
function notify(event, payload) {
  for (const subscriber of subscribers) {
    subscriber(event, payload);
  }
}

// Scoring weights
const WEIGHTS = {
  bfo: 0.30,      // 30% - BFO rooting
  logic: 0.40,    // 40% - Logical consistency
  patterns: 0.30, // 30% - CCO pattern adherence
};

export const gradingEngine = {
  state: {
    pendingResults: new Map(), // diagramId -> { bfo, patterns, logic }
    finalScore: null,
    breakdown: null,
    scoreResults: new Map(), // diagramId -> final score result
  },

  actions: {
    /**
     * Registers a validation result and checks if all validators are complete
     * @param {Object} params
     * @param {string} params.diagramId - Diagram identifier
     * @param {string} params.validator - Validator name ('bfo' | 'patterns' | 'logic')
     * @param {Object} params.result - Validation result
     */
    registerResult({ diagramId, validator, result }) {
      console.log(`[gradingEngine] Registering ${validator} result for diagram ${diagramId}`);

      // Get or create pending results for this diagram
      if (!gradingEngine.state.pendingResults.has(diagramId)) {
        gradingEngine.state.pendingResults.set(diagramId, {});
      }

      const pending = gradingEngine.state.pendingResults.get(diagramId);
      pending[validator] = result;

      // Check if all 3 validators have reported
      if (pending.bfo && pending.patterns && pending.logic) {
        console.log(`[gradingEngine] All validators complete for ${diagramId}, calculating score...`);
        gradingEngine.actions.calculateScore({ diagramId, results: pending });

        // Clean up pending results
        gradingEngine.state.pendingResults.delete(diagramId);
      } else {
        const waiting = [];
        if (!pending.bfo) waiting.push('bfo');
        if (!pending.patterns) waiting.push('patterns');
        if (!pending.logic) waiting.push('logic');
        console.log(`[gradingEngine] Waiting for: ${waiting.join(', ')}`);
      }
    },

    /**
     * Calculates the final weighted score
     * @param {Object} params
     * @param {string} params.diagramId - Diagram identifier
     * @param {Object} params.results - Results from all 3 validators
     */
    calculateScore({ diagramId, results }) {
      const { bfo, patterns, logic } = results;

      // Calculate individual scores (0-100)
      const bfoScore = gradingEngine.helpers.calculateBFOScore(bfo);
      const patternsScore = gradingEngine.helpers.calculatePatternsScore(patterns);
      const logicScore = gradingEngine.helpers.calculateLogicScore(logic);

      // Apply weights and calculate final score (0-5 scale)
      const weightedScore =
        (bfoScore * WEIGHTS.bfo) +
        (patternsScore * WEIGHTS.patterns) +
        (logicScore * WEIGHTS.logic);

      // Convert to 0-5 scale
      const finalScore = (weightedScore / 100) * 5;

      // Create breakdown
      const breakdown = {
        bfo: {
          score: bfoScore,
          weight: WEIGHTS.bfo,
          contribution: bfoScore * WEIGHTS.bfo,
          details: {
            totalClasses: bfo.totalClasses,
            rootedClasses: bfo.rootedClasses,
            orphanClasses: bfo.orphanClasses,
          },
        },
        patterns: {
          score: patternsScore,
          weight: WEIGHTS.patterns,
          contribution: patternsScore * WEIGHTS.patterns,
          details: {
            complianceScore: patterns.complianceScore,
            violations: patterns.violations.length,
          },
        },
        logic: {
          score: logicScore,
          weight: WEIGHTS.logic,
          contribution: logicScore * WEIGHTS.logic,
          details: {
            integrityScore: logic.integrityScore,
            inconsistencies: logic.inconsistencies.length,
          },
        },
      };

      // Create summary
      const summary = {
        bfo_rooting: bfo.pass ? 'Pass' : `Partial (${bfo.rootedClasses}/${bfo.totalClasses} classes rooted)`,
        logic_consistency: logic.pass ? 'Pass' : `Partial (${logic.inconsistencies.length} inconsistencies)`,
        pattern_adherence: patterns.pass ? 'Pass' : `Partial (${patterns.violations.length} violations)`,
      };

      // Collect all violations
      const violations = [
        ...bfo.orphans.map(iri => ({
          type: 'BFO',
          severity: 'error',
          description: `Class not rooted in BFO: ${iri}`,
          entity: iri,
        })),
        ...patterns.violations.map(v => ({
          type: 'SHACL',
          severity: v.severity,
          description: v.message,
          entity: v.subject,
          pattern: v.pattern,
        })),
        ...logic.inconsistencies.map(i => ({
          type: 'Logic',
          severity: i.severity,
          description: i.message,
          entity: i.subject,
          inconsistencyType: i.type,
        })),
      ];

      const scoreResult = {
        diagramId,
        finalScore: Math.round(finalScore * 10) / 10, // Round to 1 decimal
        breakdown,
        summary,
        violations,
        timestamp: new Date().toISOString(),
      };

      gradingEngine.state.finalScore = scoreResult.finalScore;
      gradingEngine.state.breakdown = breakdown;
      gradingEngine.state.scoreResults.set(diagramId, scoreResult);

      console.log(`[gradingEngine] Final score calculated: ${scoreResult.finalScore}/5.0`);
      console.log(`  - BFO: ${bfoScore}% (contribution: ${breakdown.bfo.contribution.toFixed(1)})`);
      console.log(`  - Patterns: ${patternsScore}% (contribution: ${breakdown.patterns.contribution.toFixed(1)})`);
      console.log(`  - Logic: ${logicScore}% (contribution: ${breakdown.logic.contribution.toFixed(1)})`);

      notify('scoreCalculated', { diagramId, scoreResult });
    },
  },

  helpers: {
    /**
     * Calculates BFO rooting score (0-100)
     * @param {Object} bfoResult - Result from bfoValidator
     * @returns {number} Score 0-100
     */
    calculateBFOScore(bfoResult) {
      if (bfoResult.totalClasses === 0) return 100; // No classes = perfect score

      const rootingPercentage = (bfoResult.rootedClasses / bfoResult.totalClasses) * 100;
      return Math.round(rootingPercentage);
    },

    /**
     * Calculates CCO pattern adherence score (0-100)
     * @param {Object} patternsResult - Result from shaclValidator
     * @returns {number} Score 0-100
     */
    calculatePatternsScore(patternsResult) {
      // Use the compliance score directly (already 0-100)
      return patternsResult.complianceScore;
    },

    /**
     * Calculates logical consistency score (0-100)
     * @param {Object} logicResult - Result from logicReasoner
     * @returns {number} Score 0-100
     */
    calculateLogicScore(logicResult) {
      // Use the integrity score directly (already 0-100)
      return logicResult.integrityScore;
    },

    /**
     * Gets human-readable summary of a score result
     * @param {Object} scoreResult - Score result object
     * @returns {string} Summary text
     */
    getSummaryText(scoreResult) {
      const { finalScore, violations } = scoreResult;

      if (finalScore >= 4.5) {
        return `Excellent ontology! Score: ${finalScore}/5.0 with ${violations.length} minor issues.`;
      } else if (finalScore >= 3.5) {
        return `Good ontology with some issues. Score: ${finalScore}/5.0 with ${violations.length} violations.`;
      } else if (finalScore >= 2.5) {
        return `Fair ontology needing improvement. Score: ${finalScore}/5.0 with ${violations.length} violations.`;
      } else {
        return `Ontology needs significant work. Score: ${finalScore}/5.0 with ${violations.length} violations.`;
      }
    },
  },

  subscribe(fn) {
    subscribers.add(fn);
  },

  unsubscribe(fn) {
    subscribers.delete(fn);
  },

  notify, // Expose for testing
};
