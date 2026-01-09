import { readFileSync } from 'fs';
import { mermaidLifter } from './src/concepts/ontograde/mermaidLifter.js';
import { bfoValidator } from './src/concepts/ontograde/bfoValidator.js';
import { logicReasoner } from './src/concepts/ontograde/logicReasoner.js';

await bfoValidator.actions.initialize();

// Clear any previous state
mermaidLifter.state.rdfGraphs.clear();

const mermaidText = readFileSync('Test Logic Violations.mmd', 'utf-8');
mermaidLifter.actions.liftDiagram({ diagramId: 'test-logic', mermaidText });
const rdfGraph = mermaidLifter.state.rdfGraphs.get('test-logic');

console.log('RDF triples:', rdfGraph.size);

const N3 = await import('n3');
const RDF_TYPE = N3.DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');

console.log('\nAll type assertions:');
const types = rdfGraph.getQuads(null, RDF_TYPE, null);
types.forEach(q => {
  const subj = q.subject.value.split('/').pop();
  const obj = q.object.value.split('/').pop();
  console.log(`  ${subj} -> ${obj}`);
});

logicReasoner.actions.checkConsistency({ diagramId: 'test-logic', rdfGraph });
const result = logicReasoner.state.validationResults.get('test-logic');

console.log('\nLogic Validation Result:');
console.log('  Pass:', result.pass);
console.log('  Inconsistencies:', result.inconsistencies.length);
console.log('  Integrity Score:', result.integrityScore);

if (result.inconsistencies.length > 0) {
  result.inconsistencies.forEach(v => {
    console.log(`\n  [${v.severity.toUpperCase()}] ${v.message}`);
    console.log(`    Subject: ${v.subject}`);
    if (v.types) console.log(`    Types: ${v.types.join(', ')}`);
  });
}
