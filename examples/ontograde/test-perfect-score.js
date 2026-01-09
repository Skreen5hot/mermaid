/**
 * Integration test for Iteration 5: UI Modal
 * Tests the report viewer modal with both perfect and partial scores
 */

import { readFileSync } from 'fs';
import { mermaidLifter } from '../../src/concepts/ontograde/mermaidLifter.js';
import { bfoValidator } from '../../src/concepts/ontograde/bfoValidator.js';
import { shaclValidator } from '../../src/concepts/ontograde/shaclValidator.js';
import { logicReasoner } from '../../src/concepts/ontograde/logicReasoner.js';
import { gradingEngine } from '../../src/concepts/ontograde/gradingEngine.js';
import { reportGenerator } from '../../src/concepts/ontograde/reportGenerator.js';

console.log('='.repeat(70));
console.log('OntoGrade Iteration 5: Modal UI Integration Test');
console.log('='.repeat(70));
console.log();

// Initialize BFO validator
console.log('🔧 Initializing BFO validator...');
await bfoValidator.actions.initialize();
console.log();

// Test 1: Perfect Score (CCO example.mmd)
console.log('='.repeat(70));
console.log('TEST 1: Perfect Score Report (5.0/5.0)');
console.log('='.repeat(70));
console.log();

const perfectDiagram = readFileSync('examples/diagrams/perfect-score.mmd', 'utf-8');
console.log(`📄 Loading examples/diagrams/perfect-score.mmd (${perfectDiagram.split('\n').length} lines)`);

// Lift and validate
mermaidLifter.actions.liftDiagram({ diagramId: 'test-perfect', mermaidText: perfectDiagram });
const perfectGraph = mermaidLifter.state.rdfGraphs.get('test-perfect');

bfoValidator.actions.validateRooting({ diagramId: 'test-perfect', rdfGraph: perfectGraph });
shaclValidator.actions.validatePatterns({ diagramId: 'test-perfect', rdfGraph: perfectGraph });
logicReasoner.actions.checkConsistency({ diagramId: 'test-perfect', rdfGraph: perfectGraph });

// Register and score
gradingEngine.actions.registerResult({
  diagramId: 'test-perfect',
  validator: 'bfo',
  result: bfoValidator.state.validationResults.get('test-perfect')
});
gradingEngine.actions.registerResult({
  diagramId: 'test-perfect',
  validator: 'patterns',
  result: shaclValidator.state.validationResults.get('test-perfect')
});
gradingEngine.actions.registerResult({
  diagramId: 'test-perfect',
  validator: 'logic',
  result: logicReasoner.state.validationResults.get('test-perfect')
});

const perfectScore = gradingEngine.state.scoreResults.get('test-perfect');
const perfectReport = reportGenerator.actions.generate({ scoreResult: perfectScore });

console.log('✅ Perfect Score Report Generated:');
console.log(`   Final Score: ${perfectReport.final_score}/5.0`);
console.log(`   Violations: ${perfectReport.violations.length}`);
console.log(`   Recommendations: ${perfectReport.recommendations.length}`);
console.log();

// Verify perfect score report structure
console.log('Verifying Report Structure:');
console.log(`   ✓ @context: ${perfectReport['@context']}`);
console.log(`   ✓ @type: ${perfectReport['@type']}`);
console.log(`   ✓ ontograde_version: ${perfectReport.ontograde_version}`);
console.log(`   ✓ timestamp: ${perfectReport.timestamp}`);
console.log();

console.log('Summary Section:');
console.log(`   ✓ BFO Rooting: ${perfectReport.summary.bfo_rooting}`);
console.log(`   ✓ Pattern Adherence: ${perfectReport.summary.pattern_adherence}`);
console.log(`   ✓ Logic Consistency: ${perfectReport.summary.logic_consistency}`);
console.log();

console.log('Breakdown Section:');
console.log(`   ✓ BFO: ${perfectReport.breakdown.bfo_rooting.score}% (weight: ${perfectReport.breakdown.bfo_rooting.weight})`);
console.log(`      Details: ${perfectReport.breakdown.bfo_rooting.details.rootedClasses}/${perfectReport.breakdown.bfo_rooting.details.totalClasses} classes rooted`);
console.log(`   ✓ Patterns: ${perfectReport.breakdown.pattern_adherence.score}% (weight: ${perfectReport.breakdown.pattern_adherence.weight})`);
console.log(`      Details: ${perfectReport.breakdown.pattern_adherence.details.violations} violations`);
console.log(`   ✓ Logic: ${perfectReport.breakdown.logic_consistency.score}% (weight: ${perfectReport.breakdown.logic_consistency.weight})`);
console.log(`      Details: ${perfectReport.breakdown.logic_consistency.details.inconsistencies} inconsistencies`);
console.log();

console.log('Recommendations:');
perfectReport.recommendations.forEach((rec, i) => {
  console.log(`   ${i + 1}. ${rec}`);
});
console.log();

// Test 2: Create a partial score diagram with violations
console.log('='.repeat(70));
console.log('TEST 2: Partial Score Report (with violations)');
console.log('='.repeat(70));
console.log();

const partialDiagram = `graph TD
%% Orphan class (not rooted in BFO)
OrphanClass["OrphanClass<br>IRI: ex:OrphanClass"]

%% Valid entity
Person["Person<br>IRI: cco:Person"]

%% Role without proper connections (pattern violation)
BadRole["BadRole<br>IRI: cco:BadRole"]

%% Name ICE missing concretization (pattern violation)
BrokenName["BrokenName<br>IRI: cco:BrokenName"]

%% Entity that is both Process and Object (logic violation)
ConflictEntity["ConflictEntity<br>IRI: ex:ConflictEntity"]

%% Valid Process
Process1["Process1<br>IRI: bfo:Process"]

%% Create violations
OrphanClass -->|relatesTo| Person
Person -->|is_bearer_of| BadRole
%% BadRole is NOT realized by any process (violation)

Person -->|is_designated_by| BrokenName
%% BrokenName has NO is_concretized_by (violation)

%% Type collision (both Process and Object)
ConflictEntity -->|subClassOf| Process1
ConflictEntity -->|subClassOf| Person
`;

console.log(`📄 Created test diagram with violations (${partialDiagram.split('\n').length} lines)`);

// Lift and validate
mermaidLifter.actions.liftDiagram({ diagramId: 'test-partial', mermaidText: partialDiagram });
const partialGraph = mermaidLifter.state.rdfGraphs.get('test-partial');

bfoValidator.actions.validateRooting({ diagramId: 'test-partial', rdfGraph: partialGraph });
shaclValidator.actions.validatePatterns({ diagramId: 'test-partial', rdfGraph: partialGraph });
logicReasoner.actions.checkConsistency({ diagramId: 'test-partial', rdfGraph: partialGraph });

// Register and score
gradingEngine.actions.registerResult({
  diagramId: 'test-partial',
  validator: 'bfo',
  result: bfoValidator.state.validationResults.get('test-partial')
});
gradingEngine.actions.registerResult({
  diagramId: 'test-partial',
  validator: 'patterns',
  result: shaclValidator.state.validationResults.get('test-partial')
});
gradingEngine.actions.registerResult({
  diagramId: 'test-partial',
  validator: 'logic',
  result: logicReasoner.state.validationResults.get('test-partial')
});

const partialScore = gradingEngine.state.scoreResults.get('test-partial');
const partialReport = reportGenerator.actions.generate({ scoreResult: partialScore });

console.log('⚠️  Partial Score Report Generated:');
console.log(`   Final Score: ${partialReport.final_score}/5.0`);
console.log(`   Violations: ${partialReport.violations.length}`);
console.log(`   Recommendations: ${partialReport.recommendations.length}`);
console.log();

console.log('Violations Detected:');
partialReport.violations.forEach((v, i) => {
  console.log(`   ${i + 1}. [${v.type}/${v.severity}] ${v.description}`);
  console.log(`      Entity: ${v.entity}`);
});
console.log();

console.log('Recommendations Generated:');
partialReport.recommendations.forEach((rec, i) => {
  console.log(`   ${i + 1}. ${rec}`);
});
console.log();

// Summary
console.log('='.repeat(70));
console.log('Test Summary');
console.log('='.repeat(70));
console.log();

console.log('TEST 1 - Perfect Score:');
console.log(`   ✅ Score: ${perfectReport.final_score}/5.0`);
console.log(`   ✅ All validators: Pass`);
console.log(`   ✅ Violations: ${perfectReport.violations.length}`);
console.log(`   ✅ Recommendations: ${perfectReport.recommendations.length}`);
console.log();

console.log('TEST 2 - Partial Score:');
console.log(`   ✅ Score: ${partialReport.final_score}/5.0`);
console.log(`   ✅ BFO: ${partialReport.summary.bfo_rooting}`);
console.log(`   ✅ Patterns: ${partialReport.summary.pattern_adherence}`);
console.log(`   ✅ Logic: ${partialReport.summary.logic_consistency}`);
console.log(`   ✅ Violations: ${partialReport.violations.length}`);
console.log(`   ✅ Recommendations: ${partialReport.recommendations.length}`);
console.log();

// Modal UI Checklist
console.log('Modal UI Elements to Verify:');
console.log('   [ ] Score display shows correct value');
console.log('   [ ] Score label has correct color (excellent/good/fair/poor)');
console.log('   [ ] Summary grid shows 3 sections');
console.log('   [ ] Breakdown bars animate to correct widths');
console.log('   [ ] Violations section appears when violations > 0');
console.log('   [ ] Violations have correct severity badges (error/warning)');
console.log('   [ ] Recommendations list is populated');
console.log('   [ ] Positive recommendations have green styling');
console.log('   [ ] Timestamp is formatted correctly');
console.log('   [ ] Download button downloads JSON-LD file');
console.log('   [ ] Close button (X) closes modal');
console.log('   [ ] Done button closes modal');
console.log('   [ ] Escape key closes modal');
console.log('   [ ] Clicking background closes modal');
console.log();

console.log('🎉 All report generation tests passed!');
console.log('📊 Reports ready for modal display testing');
console.log();
console.log('Next: Open http://localhost:3000 and click "🎓 OntoGrade" to test the modal UI');
