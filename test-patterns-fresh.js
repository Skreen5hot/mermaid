import { readFileSync } from 'fs';
import { mermaidLifter } from './src/concepts/ontograde/mermaidLifter.js';
import { bfoValidator } from './src/concepts/ontograde/bfoValidator.js';
import { shaclValidator } from './src/concepts/ontograde/shaclValidator.js';

await bfoValidator.actions.initialize();

// Clear any previous state
mermaidLifter.state.rdfGraphs.clear();

const mermaidText = readFileSync('Test Pattern Violations.mmd', 'utf-8');
mermaidLifter.actions.liftDiagram({ diagramId: 'test-patterns', mermaidText });
const rdfGraph = mermaidLifter.state.rdfGraphs.get('test-patterns');

console.log('RDF triples:', rdfGraph.size);

const N3 = await import('n3');
const IS_BEARER_OF = N3.DataFactory.namedNode('http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of');
const REALIZES = N3.DataFactory.namedNode('http://www.ontologyrepository.com/CommonCoreOntologies/realizes');

console.log('\nAll is_bearer_of relationships:');
const bearerQuads = rdfGraph.getQuads(null, IS_BEARER_OF, null);
bearerQuads.forEach(q => {
  const subj = q.subject.value.split('/').pop();
  const obj = q.object.value.split('/').pop();
  console.log(`  ${subj} -> ${obj}`);
});

console.log('\nAll realizes relationships:');
const realizesQuads = rdfGraph.getQuads(null, REALIZES, null);
realizesQuads.forEach(q => {
  const subj = q.subject.value.split('/').pop();
  const obj = q.object.value.split('/').pop();
  console.log(`  ${subj} -> ${obj}`);
});

shaclValidator.actions.validatePatterns({ diagramId: 'test-patterns', rdfGraph });
const result = shaclValidator.state.validationResults.get('test-patterns');

console.log('\nPattern Validation Result:');
console.log('  Violations:', result.violations.length);
console.log('  Score:', result.complianceScore);

result.violations.forEach(v => {
  console.log(`\n  [${v.pattern}] ${v.message}`);
  console.log(`    Subject: ${v.subject}`);
});
