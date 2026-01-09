/**
 * Integration test for Iteration 4: Scoring & Reporting
 * Tests the full pipeline from diagram lifting to report generation
 */

import { readFileSync } from 'fs';
import { mermaidLifter } from './src/concepts/ontograde/mermaidLifter.js';
import { bfoValidator } from './src/concepts/ontograde/bfoValidator.js';
import { shaclValidator } from './src/concepts/ontograde/shaclValidator.js';
import { logicReasoner } from './src/concepts/ontograde/logicReasoner.js';
import { gradingEngine } from './src/concepts/ontograde/gradingEngine.js';
import { reportGenerator } from './src/concepts/ontograde/reportGenerator.js';

const TEST_DIAGRAM = 'CCO example.mmd';

// Event tracking
let events = [];
function trackEvent(concept, name) {
  concept.subscribe((event, payload) => {
    if (event === name) {
      events.push({ concept: name, event, payload });
      console.log(`✓ Event: ${event}`, payload ? `(${Object.keys(payload).join(', ')})` : '');
    }
  });
}

// Track all critical events
trackEvent(mermaidLifter, 'diagramLifted');
trackEvent(bfoValidator, 'rootingValidated');
trackEvent(shaclValidator, 'patternsValidated');
trackEvent(logicReasoner, 'consistencyChecked');
trackEvent(gradingEngine, 'scoreCalculated');
trackEvent(reportGenerator, 'reportReady');

console.log('='.repeat(70));
console.log('OntoGrade Iteration 4: End-to-End Integration Test');
console.log('='.repeat(70));
console.log();

// Load test diagram
console.log(`📄 Loading diagram: ${TEST_DIAGRAM}`);
const mermaidText = readFileSync(TEST_DIAGRAM, 'utf-8');
console.log(`   Lines: ${mermaidText.split('\n').length}`);
console.log();

// Initialize BFO validator
console.log('🔧 Initializing BFO validator...');
await bfoValidator.actions.initialize();
console.log();

// Step 1: Lift diagram to RDF
console.log('Step 1: Lifting Mermaid diagram to RDF...');
mermaidLifter.actions.liftDiagram({
  diagramId: 'test-cco',
  mermaidText
});
const rdfGraph = mermaidLifter.state.rdfGraphs.get('test-cco');
if (!rdfGraph) {
  console.error('❌ ERROR: RDF graph not created!');
  process.exit(1);
}
console.log(`   RDF Graph: ${rdfGraph.size} triples`);
console.log();

// Step 2: Run all 3 validators
console.log('Step 2: Running validators in parallel...');
const bfoResult = bfoValidator.actions.validateRooting({
  diagramId: 'test-cco',
  rdfGraph
});
const patternsResult = shaclValidator.actions.validatePatterns({
  diagramId: 'test-cco',
  rdfGraph
});
const logicResult = logicReasoner.actions.checkConsistency({
  diagramId: 'test-cco',
  rdfGraph
});
console.log();

// Step 3: Register results in grading engine
console.log('Step 3: Registering validator results...');
gradingEngine.actions.registerResult({
  diagramId: 'test-cco',
  validator: 'bfo',
  result: bfoValidator.state.validationResults.get('test-cco')
});
gradingEngine.actions.registerResult({
  diagramId: 'test-cco',
  validator: 'patterns',
  result: shaclValidator.state.validationResults.get('test-cco')
});
gradingEngine.actions.registerResult({
  diagramId: 'test-cco',
  validator: 'logic',
  result: logicReasoner.state.validationResults.get('test-cco')
});
console.log();

// Step 4: Get score result
console.log('Step 4: Retrieving score result...');
const scoreResult = gradingEngine.state.scoreResults.get('test-cco');
if (!scoreResult) {
  console.error('❌ ERROR: Score result not found!');
  process.exit(1);
}
console.log(`   Final Score: ${scoreResult.finalScore}/5.0`);
console.log(`   Violations: ${scoreResult.violations.length}`);
console.log();

// Step 5: Generate report
console.log('Step 5: Generating JSON-LD report...');
const report = reportGenerator.actions.generate({ scoreResult });
console.log(`   Report Type: ${report['@type']}`);
console.log(`   OntoGrade Version: ${report.ontograde_version}`);
console.log();

// Validate results
console.log('='.repeat(70));
console.log('Validation Results');
console.log('='.repeat(70));
console.log();

console.log('✅ BFO Rooting:');
console.log(`   Score: ${report.breakdown.bfo_rooting.score}%`);
console.log(`   Weight: ${report.breakdown.bfo_rooting.weight * 100}%`);
console.log(`   Contribution: ${report.breakdown.bfo_rooting.contribution}`);
console.log(`   Summary: ${report.summary.bfo_rooting}`);
console.log();

console.log('✅ Pattern Adherence:');
console.log(`   Score: ${report.breakdown.pattern_adherence.score}%`);
console.log(`   Weight: ${report.breakdown.pattern_adherence.weight * 100}%`);
console.log(`   Contribution: ${report.breakdown.pattern_adherence.contribution}`);
console.log(`   Summary: ${report.summary.pattern_adherence}`);
console.log();

console.log('✅ Logic Consistency:');
console.log(`   Score: ${report.breakdown.logic_consistency.score}%`);
console.log(`   Weight: ${report.breakdown.logic_consistency.weight * 100}%`);
console.log(`   Contribution: ${report.breakdown.logic_consistency.contribution}`);
console.log(`   Summary: ${report.summary.logic_consistency}`);
console.log();

console.log('📊 Final Score:');
console.log(`   ${report.final_score}/5.0`);
console.log();

console.log('💡 Recommendations:');
report.recommendations.forEach((rec, i) => {
  console.log(`   ${i + 1}. ${rec}`);
});
console.log();

// Display report as formatted text
console.log('='.repeat(70));
console.log('Generated Report (Text Format)');
console.log('='.repeat(70));
console.log();
const textReport = reportGenerator.helpers.formatAsText(report);
console.log(textReport);

// Summary
console.log('='.repeat(70));
console.log('Test Summary');
console.log('='.repeat(70));
console.log();
console.log(`✅ Events fired: ${events.length}/6`);
console.log(`✅ Final score: ${report.final_score}/5.0`);
console.log(`✅ Violations: ${report.violations.length}`);
console.log(`✅ Recommendations: ${report.recommendations.length}`);
console.log();

// Check expected values
const EXPECTED_SCORE = 5.0;
const EXPECTED_VIOLATIONS = 0;

if (report.final_score === EXPECTED_SCORE && report.violations.length === EXPECTED_VIOLATIONS) {
  console.log('🎉 ALL TESTS PASSED! Iteration 4 is complete!');
  process.exit(0);
} else {
  console.error(`❌ TEST FAILED:`);
  console.error(`   Expected score: ${EXPECTED_SCORE}, got: ${report.final_score}`);
  console.error(`   Expected violations: ${EXPECTED_VIOLATIONS}, got: ${report.violations.length}`);
  process.exit(1);
}
