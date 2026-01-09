/**
 * Unit tests for logicReasoner
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Store, DataFactory } from 'n3';
import { logicReasoner } from '../../../src/concepts/ontograde/logicReasoner.js';

const { namedNode, literal } = DataFactory;

/**
 * Helper to create test RDF graphs
 */
function createTestGraph(triples) {
  const store = new Store();
  for (const [s, p, o] of triples) {
    store.addQuad(
      namedNode(s),
      namedNode(p),
      o.startsWith('http://') ? namedNode(o) : literal(o)
    );
  }
  return store;
}

describe('logicReasoner', () => {
  describe('Disjointness Checking', () => {
    it('should pass for consistent ontology (no disjoint violations)', () => {
      const graph = createTestGraph([
        // Person as Material Entity (Continuant) - valid
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000040'], // material entity
      ]);

      const inconsistencies = logicReasoner.helpers.checkDisjointness(graph);

      assert.equal(inconsistencies.length, 0, 'Should have no disjointness violations');
    });

    it('should detect Continuant vs Occurrent violation', () => {
      const graph = createTestGraph([
        // Entity marked as both Continuant and Occurrent - invalid!
        ['http://example.org/Entity_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000002'], // continuant
        ['http://example.org/Entity_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000003'], // occurrent
      ]);

      const inconsistencies = logicReasoner.helpers.checkDisjointness(graph);

      assert.ok(inconsistencies.length > 0);
      assert.equal(inconsistencies[0].type, 'disjointness_violation');
      assert.ok(inconsistencies[0].message.includes('continuant'));
      assert.ok(inconsistencies[0].message.includes('occurrent'));
    });

    it('should detect Material vs Immaterial violation', () => {
      const graph = createTestGraph([
        // Entity marked as both Material and Immaterial - invalid!
        ['http://example.org/Entity_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000040'], // material entity
        ['http://example.org/Entity_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000141'], // immaterial entity
      ]);

      const inconsistencies = logicReasoner.helpers.checkDisjointness(graph);

      assert.ok(inconsistencies.length > 0);
      assert.equal(inconsistencies[0].type, 'disjointness_violation');
      assert.ok(inconsistencies[0].message.includes('material'));
    });

    it('should detect Specifically vs Generically Dependent violation', () => {
      const graph = createTestGraph([
        // Entity marked as both types of dependent continuant - invalid!
        ['http://example.org/Entity_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000020'], // specifically dependent
        ['http://example.org/Entity_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000031'], // generically dependent
      ]);

      const inconsistencies = logicReasoner.helpers.checkDisjointness(graph);

      assert.ok(inconsistencies.length > 0);
      assert.equal(inconsistencies[0].type, 'disjointness_violation');
    });
  });

  describe('Type Collision Detection', () => {
    it('should detect Process AND Object collision', () => {
      const graph = createTestGraph([
        // Entity marked as both Process and Object - invalid!
        ['http://example.org/Entity_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000015'], // process
        ['http://example.org/Entity_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000030'], // object
      ]);

      const inconsistencies = logicReasoner.helpers.checkTypeCollisions(graph);

      assert.ok(inconsistencies.length > 0);
      assert.equal(inconsistencies[0].type, 'type_collision');
      assert.ok(inconsistencies[0].message.includes('Process'));
      assert.ok(inconsistencies[0].message.includes('Object'));
    });

    it('should pass for non-colliding types', () => {
      const graph = createTestGraph([
        // Person (Object) - valid
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000030'], // object
      ]);

      const inconsistencies = logicReasoner.helpers.checkTypeCollisions(graph);

      assert.equal(inconsistencies.length, 0);
    });
  });

  describe('Superclass Inference', () => {
    it('should infer direct superclasses', () => {
      const graph = createTestGraph([
        // Person subClassOf MaterialEntity
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000040'],
      ]);

      const superclasses = logicReasoner.helpers.inferSuperclasses(
        'http://www.ontologyrepository.com/CommonCoreOntologies/Person',
        graph
      );

      assert.ok(superclasses.has('http://purl.obolibrary.org/obo/BFO_0000040'));
    });

    it('should infer transitive superclasses', () => {
      const graph = createTestGraph([
        // Person subClassOf MaterialEntity subClassOf IndependentContinuant
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000040'],
        ['http://purl.obolibrary.org/obo/BFO_0000040', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000004'],
      ]);

      const superclasses = logicReasoner.helpers.inferSuperclasses(
        'http://www.ontologyrepository.com/CommonCoreOntologies/Person',
        graph
      );

      assert.ok(superclasses.has('http://purl.obolibrary.org/obo/BFO_0000040'));
      assert.ok(superclasses.has('http://purl.obolibrary.org/obo/BFO_0000004'));
    });

    it('should handle cycles without infinite loop', () => {
      const graph = createTestGraph([
        // A subClassOf B, B subClassOf A (cycle)
        ['http://example.org/ClassA', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://example.org/ClassB'],
        ['http://example.org/ClassB', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://example.org/ClassA'],
      ]);

      const superclasses = logicReasoner.helpers.inferSuperclasses('http://example.org/ClassA', graph);

      // Should not crash, should include both classes
      assert.ok(superclasses.has('http://example.org/ClassB'));
      assert.ok(superclasses.has('http://example.org/ClassA'));
    });
  });

  describe('performReasoning', () => {
    it('should pass for consistent model', () => {
      const graph = createTestGraph([
        // Person (Material Entity) - consistent
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000040'],
      ]);

      const result = logicReasoner.helpers.performReasoning(graph);

      assert.equal(result.pass, true);
      assert.equal(result.inconsistencies.length, 0);
      assert.equal(result.integrityScore, 100);
    });

    it('should detect inconsistencies', () => {
      const graph = createTestGraph([
        // Entity as both Process and Object
        ['http://example.org/Entity_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000015'], // process
        ['http://example.org/Entity_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000030'], // object
      ]);

      const result = logicReasoner.helpers.performReasoning(graph);

      assert.equal(result.pass, false);
      assert.ok(result.inconsistencies.length > 0);
      assert.ok(result.integrityScore < 100);
    });

    it('should return 100% score for empty graph', () => {
      const graph = createTestGraph([]);

      const result = logicReasoner.helpers.performReasoning(graph);

      assert.equal(result.pass, true);
      assert.equal(result.inconsistencies.length, 0);
      assert.equal(result.integrityScore, 100);
    });
  });

  describe('checkConsistency action', () => {
    it('should validate and emit consistencyChecked event', (t, done) => {
      const graph = createTestGraph([
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
      ]);

      const handler = (event, payload) => {
        if (event === 'consistencyChecked') {
          assert.equal(payload.diagramId, 'test-1');
          assert.ok(payload.result);
          assert.equal(typeof payload.result.integrityScore, 'number');
          logicReasoner.unsubscribe(handler);
          done();
        }
      };

      logicReasoner.subscribe(handler);
      logicReasoner.actions.checkConsistency({ diagramId: 'test-1', rdfGraph: graph });
    });

    it('should store validation results in state', () => {
      const graph = createTestGraph([]);

      logicReasoner.actions.checkConsistency({ diagramId: 'test-2', rdfGraph: graph });

      const result = logicReasoner.state.validationResults.get('test-2');
      assert.ok(result);
      assert.equal(typeof result.integrityScore, 'number');
    });
  });

  describe('Helper functions', () => {
    it('getBFOLabel should return friendly labels', () => {
      const label = logicReasoner.helpers.getBFOLabel('http://purl.obolibrary.org/obo/BFO_0000040');
      assert.equal(label, 'material entity');
    });

    it('getShortIri should return cco: prefix for CCO IRIs', () => {
      const short = logicReasoner.helpers.getShortIri('http://www.ontologyrepository.com/CommonCoreOntologies/Person');
      assert.equal(short, 'cco:Person');
    });

    it('getShortIri should return bfo: prefix for BFO IRIs', () => {
      const short = logicReasoner.helpers.getShortIri('http://purl.obolibrary.org/obo/BFO_0000040');
      assert.equal(short, 'bfo:BFO_0000040');
    });

    it('getShortIri should return ex: prefix for example.org IRIs', () => {
      const short = logicReasoner.helpers.getShortIri('http://example.org/Person_0');
      assert.equal(short, 'ex:Person_0');
    });
  });
});
