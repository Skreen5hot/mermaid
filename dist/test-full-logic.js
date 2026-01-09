import { readFileSync } from 'fs';
import { mermaidLifter } from './src/concepts/ontograde/mermaidLifter.js';
import { bfoValidator } from './src/concepts/ontograde/bfoValidator.js';
import { shaclValidator } from './src/concepts/ontograde/shaclValidator.js';
import { logicReasoner } from './src/concepts/ontograde/logicReasoner.js';

await bfoValidator.actions.initialize();

// Clear any previous state
mermaidLifter.state.rdfGraphs.clear();

const mermaidText = readFileSync('Test Logic Violations.mmd', 'utf-8');
mermaidLifter.actions.liftDiagram({ diagramId: 'test-logic', mermaidText });
const rdfGraph = mermaidLifter.state.rdfGraphs.get('test-logic');

console.log('=== FULL VALIDATION TEST ===\n');
console.log('RDF triples:', rdfGraph.size);

// BFO Validation
bfoValidator.actions.validateRooting({ diagramId: 'test-logic', rdfGraph });
const bfoResult = bfoValidator.state.validationResults.get('test-logic');

console.log('\n--- BFO ROOTING ---');
console.log('  Pass:', bfoResult.pass);
console.log('  Total classes:', bfoResult.totalClasses);
console.log('  Rooted:', bfoResult.rootedClasses);
console.log('  Orphans:', bfoResult.orphanClasses);
if (bfoResult.orphans.length > 0) {
  console.log('  Orphan classes:');
  bfoResult.orphans.forEach(o => console.log('    -', o.split('/').pop()));
}

// Pattern Validation
shaclValidator.actions.validatePatterns({ diagramId: 'test-logic', rdfGraph });
const patternResult = shaclValidator.state.validationResults.get('test-logic');

console.log('\n--- PATTERN ADHERENCE ---');
console.log('  Violations:', patternResult.violations.length);
console.log('  Compliance:', patternResult.complianceScore + '%');

// Logic Validation
logicReasoner.actions.checkConsistency({ diagramId: 'test-logic', rdfGraph });
const logicResult = logicReasoner.state.validationResults.get('test-logic');

console.log('\n--- LOGIC CONSISTENCY ---');
console.log('  Pass:', logicResult.pass);
console.log('  Inconsistencies:', logicResult.inconsistencies.length);
console.log('  Integrity Score:', logicResult.integrityScore + '%');

console.log('\n=== EXPECTED vs ACTUAL ===');
console.log('Expected: BFO 100%, Patterns 100%, Logic ~20%');
console.log(`Actual:   BFO ${bfoResult.pass ? '100%' : Math.round(bfoResult.rootedClasses/bfoResult.totalClasses*100) + '%'}, Patterns ${patternResult.complianceScore}%, Logic ${logicResult.integrityScore}%`);
