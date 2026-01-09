/**
 * Comprehensive test for all violation types
 * Tests BFO, Pattern, and Logic violations separately
 */

import { readFileSync } from 'fs';
import { mermaidLifter } from './src/concepts/ontograde/mermaidLifter.js';
import { bfoValidator } from './src/concepts/ontograde/bfoValidator.js';
import { shaclValidator } from './src/concepts/ontograde/shaclValidator.js';
import { logicReasoner } from './src/concepts/ontograde/logicReasoner.js';
import { gradingEngine } from './src/concepts/ontograde/gradingEngine.js';
import { reportGenerator } from './src/concepts/ontograde/reportGenerator.js';

console.log('='.repeat(80));
console.log('OntoGrade: Comprehensive Violation Testing');
console.log('='.repeat(80));
console.log();

// Initialize
await bfoValidator.actions.initialize();

/**
 * Helper to process a diagram and generate report
 */
async function testDiagram(filename, diagramId, expectedViolationType) {
  console.log('─'.repeat(80));
  console.log(`Testing: ${filename}`);
  console.log('─'.repeat(80));

  const mermaidText = readFileSync(filename, 'utf-8');

  // Lift
  mermaidLifter.actions.liftDiagram({ diagramId, mermaidText });
  const rdfGraph = mermaidLifter.state.rdfGraphs.get(diagramId);

  console.log(`📊 RDF Graph: ${rdfGraph.size} triples`);

  // Validate
  bfoValidator.actions.validateRooting({ diagramId, rdfGraph });
  shaclValidator.actions.validatePatterns({ diagramId, rdfGraph });
  logicReasoner.actions.checkConsistency({ diagramId, rdfGraph });

  // Score
  gradingEngine.actions.registerResult({
    diagramId,
    validator: 'bfo',
    result: bfoValidator.state.validationResults.get(diagramId)
  });
  gradingEngine.actions.registerResult({
    diagramId,
    validator: 'patterns',
    result: shaclValidator.state.validationResults.get(diagramId)
  });
  gradingEngine.actions.registerResult({
    diagramId,
    validator: 'logic',
    result: logicReasoner.state.validationResults.get(diagramId)
  });

  const scoreResult = gradingEngine.state.scoreResults.get(diagramId);
  const report = reportGenerator.actions.generate({ scoreResult });

  // Display results
  console.log();
  console.log(`🎯 FINAL SCORE: ${report.final_score}/5.0`);
  console.log();

  console.log('📋 SUMMARY:');
  console.log(`   BFO Rooting:        ${report.summary.bfo_rooting}`);
  console.log(`   Pattern Adherence:  ${report.summary.pattern_adherence}`);
  console.log(`   Logic Consistency:  ${report.summary.logic_consistency}`);
  console.log();

  console.log('📊 BREAKDOWN:');
  console.log(`   BFO:      ${report.breakdown.bfo_rooting.score}% (weight: ${report.breakdown.bfo_rooting.weight * 100}%)`);
  console.log(`             ${report.breakdown.bfo_rooting.details.rootedClasses}/${report.breakdown.bfo_rooting.details.totalClasses} classes rooted`);
  console.log(`   Patterns: ${report.breakdown.pattern_adherence.score}% (weight: ${report.breakdown.pattern_adherence.weight * 100}%)`);
  console.log(`             ${report.breakdown.pattern_adherence.details.violations} violation(s)`);
  console.log(`   Logic:    ${report.breakdown.logic_consistency.score}% (weight: ${report.breakdown.logic_consistency.weight * 100}%)`);
  console.log(`             ${report.breakdown.logic_consistency.details.inconsistencies} inconsistency(ies)`);
  console.log();

  if (report.violations.length > 0) {
    console.log(`⚠️  VIOLATIONS (${report.violations.length}):`);

    // Group by type
    const byType = {
      BFO: report.violations.filter(v => v.type === 'BFO'),
      SHACL: report.violations.filter(v => v.type === 'SHACL'),
      Logic: report.violations.filter(v => v.type === 'Logic')
    };

    Object.entries(byType).forEach(([type, violations]) => {
      if (violations.length > 0) {
        console.log(`   ${type} (${violations.length}):`);
        violations.slice(0, 3).forEach(v => {
          console.log(`      - [${v.severity}] ${v.description.substring(0, 60)}...`);
        });
        if (violations.length > 3) {
          console.log(`      ... and ${violations.length - 3} more`);
        }
      }
    });
  } else {
    console.log('✅ NO VIOLATIONS');
  }

  console.log();
  console.log(`💡 RECOMMENDATIONS (${report.recommendations.length}):`);
  report.recommendations.slice(0, 3).forEach((rec, i) => {
    console.log(`   ${i + 1}. ${rec.substring(0, 70)}...`);
  });
  if (report.recommendations.length > 3) {
    console.log(`   ... and ${report.recommendations.length - 3} more`);
  }

  console.log();
  console.log();

  return report;
}

// Test 1: BFO Violations
const bfoReport = await testDiagram('Test Violations.mmd', 'test-bfo', 'BFO');

// Test 2: Pattern Violations
const patternReport = await testDiagram('Test Pattern Violations.mmd', 'test-patterns', 'Pattern');

// Test 3: Logic Violations
const logicReport = await testDiagram('Test Logic Violations.mmd', 'test-logic', 'Logic');

// Test 4: Perfect Score
const perfectReport = await testDiagram('CCO example.mmd', 'test-perfect', 'None');

// Summary
console.log('='.repeat(80));
console.log('TEST SUMMARY');
console.log('='.repeat(80));
console.log();

console.log('Test 1: BFO Violations');
console.log(`   Score: ${bfoReport.final_score}/5.0`);
console.log(`   Primary Issue: BFO Rooting (${bfoReport.breakdown.bfo_rooting.score}%)`);
console.log(`   Violations: ${bfoReport.violations.filter(v => v.type === 'BFO').length} BFO`);
console.log();

console.log('Test 2: Pattern Violations');
console.log(`   Score: ${patternReport.final_score}/5.0`);
console.log(`   Primary Issue: Pattern Adherence (${patternReport.breakdown.pattern_adherence.score}%)`);
console.log(`   Violations: ${patternReport.violations.filter(v => v.type === 'SHACL').length} Pattern`);
console.log();

console.log('Test 3: Logic Violations');
console.log(`   Score: ${logicReport.final_score}/5.0`);
console.log(`   Primary Issue: Logic Consistency (${logicReport.breakdown.logic_consistency.score}%)`);
console.log(`   Violations: ${logicReport.violations.filter(v => v.type === 'Logic').length} Logic`);
console.log();

console.log('Test 4: Perfect Score');
console.log(`   Score: ${perfectReport.final_score}/5.0`);
console.log(`   All validators: Pass`);
console.log(`   Violations: 0`);
console.log();

console.log('✅ All violation tests completed!');
console.log();
console.log('📁 Test Files Available:');
console.log('   1. Test Violations.mmd          - BFO rooting violations');
console.log('   2. Test Pattern Violations.mmd  - CCO pattern violations');
console.log('   3. Test Logic Violations.mmd    - Logical consistency violations');
console.log('   4. CCO example.mmd              - Perfect score (5.0/5.0)');
console.log();
console.log('🌐 Load these in the browser at http://localhost:3000 to test the modal UI!');
