import { readFileSync } from 'fs';
import { mermaidLifter } from './src/concepts/ontograde/mermaidLifter.js';
import { bfoValidator } from './src/concepts/ontograde/bfoValidator.js';
import { shaclValidator } from './src/concepts/ontograde/shaclValidator.js';

await bfoValidator.actions.initialize();

const mermaidText = readFileSync('Test Pattern Violations.mmd', 'utf-8');
mermaidLifter.actions.liftDiagram({ diagramId: 'test', mermaidText });
const rdfGraph = mermaidLifter.state.rdfGraphs.get('test');

console.log('RDF triples:', rdfGraph.size);
console.log('\nAll type assertions:');
const N3 = await import('n3');
const RDF_TYPE = N3.DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
const types = rdfGraph.getQuads(null, RDF_TYPE, null);
types.forEach(q => console.log(`  ${q.subject.value.split('/').pop()} -> ${q.object.value.split('/').pop()}`));

shaclValidator.actions.validatePatterns({ diagramId: 'test', rdfGraph });
const result = shaclValidator.state.validationResults.get('test');

console.log('\nPattern Validation Result:');
console.log('  Violations:', result.violations.length);
console.log('  Score:', result.complianceScore);

result.violations.forEach(v => {
  console.log(`\n  [${v.pattern}] ${v.message}`);
  console.log(`    Subject: ${v.subject}`);
});
