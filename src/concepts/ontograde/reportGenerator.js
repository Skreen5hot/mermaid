/**
 * @module reportGenerator
 * @description Generates JSON-LD reports from OntoGrade score results
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

export const reportGenerator = {
  state: {
    latestReport: null,
    reports: new Map(), // diagramId -> report
  },

  actions: {
    /**
     * Generates a JSON-LD report from a score result
     * @param {Object} params
     * @param {Object} params.scoreResult - Score result from gradingEngine
     * @returns {Object} JSON-LD report
     */
    generate({ scoreResult }) {
      console.log(`[reportGenerator] Generating report for diagram ${scoreResult.diagramId}...`);

      const report = reportGenerator.helpers.createReport(scoreResult);

      reportGenerator.state.latestReport = report;
      reportGenerator.state.reports.set(scoreResult.diagramId, report);

      console.log(`[reportGenerator] Report generated:`);
      console.log(`  - Final score: ${report.final_score}/5.0`);
      console.log(`  - Violations: ${report.violations.length}`);
      console.log(`  - Recommendations: ${report.recommendations.length}`);

      notify('reportReady', { diagramId: scoreResult.diagramId, report });

      return report;
    },

    /**
     * Downloads the report as a JSON file
     * @param {Object} params
     * @param {string} params.diagramId - Diagram identifier
     * @param {string} params.filename - Optional filename
     */
    download({ diagramId, filename }) {
      const report = reportGenerator.state.reports.get(diagramId);

      if (!report) {
        console.error(`[reportGenerator] No report found for diagram ${diagramId}`);
        return;
      }

      const jsonString = JSON.stringify(report, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `ontograde-report-${diagramId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`[reportGenerator] Report downloaded: ${link.download}`);
    },
  },

  helpers: {
    /**
     * Creates a JSON-LD report from a score result
     * @param {Object} scoreResult - Score result from gradingEngine
     * @returns {Object} JSON-LD report
     */
    createReport(scoreResult) {
      const { finalScore, summary, violations, breakdown, timestamp } = scoreResult;

      // Generate recommendations based on violations
      const recommendations = reportGenerator.helpers.generateRecommendations(violations, breakdown);

      const report = {
        '@context': 'https://ontograde.org/context/v2',
        '@type': 'OntologyQualityReport',
        ontograde_version: '2.0',
        timestamp,
        final_score: finalScore,
        summary,
        breakdown: {
          bfo_rooting: {
            score: breakdown.bfo.score,
            weight: breakdown.bfo.weight,
            contribution: Math.round(breakdown.bfo.contribution * 10) / 10,
            details: breakdown.bfo.details,
          },
          pattern_adherence: {
            score: breakdown.patterns.score,
            weight: breakdown.patterns.weight,
            contribution: Math.round(breakdown.patterns.contribution * 10) / 10,
            details: breakdown.patterns.details,
          },
          logic_consistency: {
            score: breakdown.logic.score,
            weight: breakdown.logic.weight,
            contribution: Math.round(breakdown.logic.contribution * 10) / 10,
            details: breakdown.logic.details,
          },
        },
        violations,
        recommendations,
      };

      return report;
    },

    /**
     * Generates recommendations based on violations
     * @param {Array<Object>} violations - Array of violations
     * @param {Object} breakdown - Score breakdown
     * @returns {Array<string>} Array of recommendations
     */
    generateRecommendations(violations, breakdown) {
      const recommendations = [];

      // BFO rooting recommendations
      const bfoViolations = violations.filter(v => v.type === 'BFO');
      if (bfoViolations.length > 0) {
        recommendations.push(
          `Root ${bfoViolations.length} orphan class(es) in BFO hierarchy using rdfs:subClassOf`
        );

        // Specific recommendations for common orphan classes
        bfoViolations.slice(0, 3).forEach(v => {
          const className = v.entity.split('/').pop();
          recommendations.push(
            `Add subclass relationship for ${className} (e.g., ${className} rdfs:subClassOf bfo:MaterialEntity)`
          );
        });
      }

      // Pattern adherence recommendations
      const shaclViolations = violations.filter(v => v.type === 'SHACL');
      if (shaclViolations.length > 0) {
        // Group by pattern
        const byPattern = {};
        shaclViolations.forEach(v => {
          if (!byPattern[v.pattern]) byPattern[v.pattern] = [];
          byPattern[v.pattern].push(v);
        });

        Object.keys(byPattern).forEach(pattern => {
          const count = byPattern[pattern].length;

          if (pattern === 'Information Staircase') {
            recommendations.push(
              `Fix ${count} Information Staircase violation(s): ensure ICE → is_concretized_by → IBE → has_text_value → Literal`
            );
          } else if (pattern === 'Role Pattern') {
            recommendations.push(
              `Fix ${count} Role Pattern violation(s): ensure Entity → is_bearer_of → Role AND Process → realizes → Role`
            );
          } else if (pattern === 'Designation Pattern') {
            recommendations.push(
              `Fix ${count} Designation Pattern violation(s): add is_designated_by or designates relationships`
            );
          }
        });
      }

      // Logic consistency recommendations
      const logicViolations = violations.filter(v => v.type === 'Logic');
      if (logicViolations.length > 0) {
        const typeCollisions = logicViolations.filter(v => v.inconsistencyType === 'type_collision');
        const disjointnessViolations = logicViolations.filter(v => v.inconsistencyType === 'disjointness_violation');

        if (typeCollisions.length > 0) {
          recommendations.push(
            `Resolve ${typeCollisions.length} type collision(s): entities cannot be both Process and Object`
          );
        }

        if (disjointnessViolations.length > 0) {
          recommendations.push(
            `Resolve ${disjointnessViolations.length} disjointness violation(s): check for contradictory class memberships`
          );
        }
      }

      // General recommendations based on score
      if (breakdown.bfo.score < 100) {
        recommendations.push(
          'Ensure all custom classes inherit from appropriate BFO classes'
        );
      }

      if (breakdown.patterns.score < 100) {
        recommendations.push(
          'Review CCO design patterns documentation at https://github.com/CommonCoreOntology/CommonCoreOntologies'
        );
      }

      if (breakdown.logic.score < 100) {
        recommendations.push(
          'Check for logical inconsistencies using an OWL reasoner'
        );
      }

      // If perfect score, add positive feedback
      if (violations.length === 0) {
        recommendations.push(
          '🎉 Excellent work! Your ontology follows all best practices.'
        );
      }

      return recommendations;
    },

    /**
     * Formats a report as human-readable text
     * @param {Object} report - JSON-LD report
     * @returns {string} Formatted text
     */
    formatAsText(report) {
      const lines = [];

      lines.push('='.repeat(60));
      lines.push('OntoGrade Quality Report');
      lines.push('='.repeat(60));
      lines.push('');
      lines.push(`Timestamp: ${report.timestamp}`);
      lines.push(`OntoGrade Version: ${report.ontograde_version}`);
      lines.push('');
      lines.push(`FINAL SCORE: ${report.final_score}/5.0`);
      lines.push('');

      lines.push('SUMMARY:');
      lines.push(`  - BFO Rooting: ${report.summary.bfo_rooting}`);
      lines.push(`  - Pattern Adherence: ${report.summary.pattern_adherence}`);
      lines.push(`  - Logic Consistency: ${report.summary.logic_consistency}`);
      lines.push('');

      lines.push('BREAKDOWN:');
      lines.push(`  BFO Rooting: ${report.breakdown.bfo_rooting.score}% (weight: ${report.breakdown.bfo_rooting.weight * 100}%)`);
      lines.push(`    → Contribution: ${report.breakdown.bfo_rooting.contribution}`);
      lines.push(`  Pattern Adherence: ${report.breakdown.pattern_adherence.score}% (weight: ${report.breakdown.pattern_adherence.weight * 100}%)`);
      lines.push(`    → Contribution: ${report.breakdown.pattern_adherence.contribution}`);
      lines.push(`  Logic Consistency: ${report.breakdown.logic_consistency.score}% (weight: ${report.breakdown.logic_consistency.weight * 100}%)`);
      lines.push(`    → Contribution: ${report.breakdown.logic_consistency.contribution}`);
      lines.push('');

      if (report.violations.length > 0) {
        lines.push(`VIOLATIONS (${report.violations.length}):`);
        report.violations.forEach((v, i) => {
          lines.push(`  ${i + 1}. [${v.type}] ${v.description}`);
        });
        lines.push('');
      }

      if (report.recommendations.length > 0) {
        lines.push(`RECOMMENDATIONS (${report.recommendations.length}):`);
        report.recommendations.forEach((r, i) => {
          lines.push(`  ${i + 1}. ${r}`);
        });
        lines.push('');
      }

      lines.push('='.repeat(60));

      return lines.join('\n');
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
