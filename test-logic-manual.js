import { readFileSync } from 'fs';
import { mermaidLifter } from './src/concepts/ontograde/mermaidLifter.js';
import { bfoValidator } from './src/concepts/ontograde/bfoValidator.js';
import { logicReasoner } from './src/concepts/ontograde/logicReasoner.js';

await bfoValidator.actions.initialize();

// Start with a simple diagram
const mermaidText = `graph TD
Person["Person<br>IRI: cco:Person"]
BadEntity["BadEntity<br>IRI: ex:BadEntity"]
`;

mermaidLifter.actions.liftDiagram({ diagramId: 'test-logic', mermaidText });
const rdfGraph = mermaidLifter.state.rdfGraphs.get('test-logic');

console.log('=== MANUAL LOGIC VIOLATION TEST ===\n');
console.log('Initial RDF triples:', rdfGraph.size);

// Manually inject contradictory types for BadEntity
const N3 = await import('n3');
const { namedNode } = N3.DataFactory;

const BAD_ENTITY = namedNode('http://example.org/BadEntity');
const RDF_TYPE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
const CONTINUANT = namedNode('http://purl.obolibrary.org/obo/BFO_0000002'); // Continuant
const OCCURRENT = namedNode('http://purl.obolibrary.org/obo/BFO_0000003'); // Occurrent

console.log('\n--- INJECTING CONTRADICTORY TYPES ---');
console.log('Adding: BadEntity rdf:type Continuant');
rdfGraph.addQuad(BAD_ENTITY, RDF_TYPE, CONTINUANT);

console.log('Adding: BadEntity rdf:type Occurrent');
rdfGraph.addQuad(BAD_ENTITY, RDF_TYPE, OCCURRENT);

console.log('\nUpdated RDF triples:', rdfGraph.size);

// Check what types BadEntity now has
const badEntityTypes = rdfGraph.getQuads(BAD_ENTITY, RDF_TYPE, null);
console.log('\nBadEntity types:');
badEntityTypes.forEach(q => {
  console.log('  -', q.object.value.split('/').pop());
});

// Run logic validation
console.log('\n--- RUNNING LOGIC VALIDATION ---');
logicReasoner.actions.checkConsistency({ diagramId: 'test-logic', rdfGraph });
const result = logicReasoner.state.validationResults.get('test-logic');

console.log('\n=== RESULTS ===');
console.log('Pass:', result.pass);
console.log('Inconsistencies:', result.inconsistencies.length);
console.log('Integrity Score:', result.integrityScore + '%');

if (result.inconsistencies.length > 0) {
  console.log('\n--- VIOLATIONS DETECTED! ---');
  result.inconsistencies.forEach((v, i) => {
    console.log(`\n${i + 1}. [${v.severity.toUpperCase()}] ${v.type}`);
    console.log('   Message:', v.message);
    console.log('   Subject:', v.subject);
    if (v.classes) {
      console.log('   Disjoint classes:');
      v.classes.forEach(c => console.log('     -', c));
    }
  });
} else {
  console.log('\n❌ No violations detected (unexpected!)');
}
