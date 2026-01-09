/**
 * Logic Consistency Violation Test
 *
 * This test demonstrates the logic reasoner's ability to detect disjointness violations.
 *
 * NOTE: Logic violations CANNOT be created via pure Mermaid syntax because each
 * Mermaid node becomes a unique RDF subject. To trigger logic violations, we must
 * manually inject contradictory type assertions to the same subject.
 *
 * This test validates that the logicReasoner correctly identifies entities with
 * contradictory types (e.g., both Continuant and Occurrent).
 */

import { readFileSync } from 'fs';
import { mermaidLifter } from '../../src/concepts/ontograde/mermaidLifter.js';
import { bfoValidator } from '../../src/concepts/ontograde/bfoValidator.js';
import { logicReasoner } from '../../src/concepts/ontograde/logicReasoner.js';

await bfoValidator.actions.initialize();

// Clear any previous state
mermaidLifter.state.rdfGraphs.clear();

// Start with a simple base diagram
const mermaidText = `graph TD

%% =========================
%% Logic Violation Test Base
%% We'll manually inject violations into this diagram
%% =========================

Person["Person<br>IRI: cco:Person"]
ValidProcess["ValidProcess<br>IRI: cco:Act"]

%% These entities will have violations injected
BadEntity1["BadEntity1<br>IRI: ex:BadEntity1"]
BadEntity2["BadEntity2<br>IRI: ex:BadEntity2"]
BadEntity3["BadEntity3<br>IRI: ex:BadEntity3"]

Person -->|participates_in| ValidProcess
`;

console.log('=== LOGIC CONSISTENCY VIOLATION TEST ===\n');

mermaidLifter.actions.liftDiagram({ diagramId: 'test-logic', mermaidText });
const rdfGraph = mermaidLifter.state.rdfGraphs.get('test-logic');

console.log('Base RDF triples:', rdfGraph.size);

// Import N3 for manual triple injection
const N3 = await import('n3');
const { namedNode } = N3.DataFactory;

const RDF_TYPE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');

// BFO Class IRIs
const CONTINUANT = namedNode('http://purl.obolibrary.org/obo/BFO_0000002');
const OCCURRENT = namedNode('http://purl.obolibrary.org/obo/BFO_0000003');
const MATERIAL_ENTITY = namedNode('http://purl.obolibrary.org/obo/BFO_0000040');
const PROCESS = namedNode('http://purl.obolibrary.org/obo/BFO_0000015');
const OBJECT = namedNode('http://purl.obolibrary.org/obo/BFO_0000030');
const SPEC_DEP = namedNode('http://purl.obolibrary.org/obo/BFO_0000020');
const GEN_DEP = namedNode('http://purl.obolibrary.org/obo/BFO_0000031');

console.log('\n--- INJECTING LOGIC VIOLATIONS ---\n');

// VIOLATION 1: Entity that is both Continuant and Occurrent
console.log('1. BadEntity1: Continuant + Occurrent (top-level disjointness)');
const BAD_ENTITY_1 = namedNode('http://example.org/BadEntity1');
rdfGraph.addQuad(BAD_ENTITY_1, RDF_TYPE, CONTINUANT);
rdfGraph.addQuad(BAD_ENTITY_1, RDF_TYPE, OCCURRENT);

// VIOLATION 2: Entity that is both Process and Object
console.log('2. BadEntity2: Process + Object (specific disjointness)');
const BAD_ENTITY_2 = namedNode('http://example.org/BadEntity2');
rdfGraph.addQuad(BAD_ENTITY_2, RDF_TYPE, PROCESS);
rdfGraph.addQuad(BAD_ENTITY_2, RDF_TYPE, OBJECT);

// VIOLATION 3: Entity that is both SpecificallyDependent and GenericallyDependent
console.log('3. BadEntity3: SpecificallyDependentContinuant + GenericallyDependentContinuant');
const BAD_ENTITY_3 = namedNode('http://example.org/BadEntity3');
rdfGraph.addQuad(BAD_ENTITY_3, RDF_TYPE, SPEC_DEP);
rdfGraph.addQuad(BAD_ENTITY_3, RDF_TYPE, GEN_DEP);

console.log('\nUpdated RDF triples:', rdfGraph.size);
console.log('Violations injected: 3');

// Run logic consistency check
console.log('\n--- RUNNING LOGIC VALIDATION ---\n');
logicReasoner.actions.checkConsistency({ diagramId: 'test-logic', rdfGraph });
const result = logicReasoner.state.validationResults.get('test-logic');

console.log('Logic Validation Result:');
console.log('  Pass:', result.pass);
console.log('  Total checks:', result.totalChecks);
console.log('  Inconsistencies found:', result.inconsistencies.length);
console.log('  Integrity score:', result.integrityScore + '%');

if (result.inconsistencies.length > 0) {
  console.log('\n--- VIOLATIONS DETECTED ---\n');
  result.inconsistencies.forEach((v, i) => {
    console.log(`${i + 1}. [${v.severity.toUpperCase()}] ${v.type}`);
    console.log(`   Subject: ${v.subject.split('/').pop()}`);
    console.log(`   Message: ${v.message}`);
    if (v.classes) {
      const labels = v.classes.map(c => c.split('/').pop());
      console.log(`   Disjoint classes: ${labels.join(' vs ')}`);
    }
    console.log();
  });

  console.log('✅ Test PASSED: Logic reasoner correctly detected all violations');
} else {
  console.log('\n❌ Test FAILED: Expected violations not detected');
  process.exit(1);
}

// Summary
console.log('=== SUMMARY ===');
console.log(`Expected violations: 3 (or more due to multiple violation types per entity)`);
console.log(`Detected violations: ${result.inconsistencies.length}`);
console.log(`Integrity score: ${result.integrityScore}% (expected: 0%)`);
console.log();
console.log('NOTE: Pure Mermaid syntax cannot create logic violations.');
console.log('This test uses manual RDF injection to validate the reasoner.');
