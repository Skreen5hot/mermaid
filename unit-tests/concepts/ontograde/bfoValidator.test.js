/**
 * Unit tests for bfoValidator concept
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { bfoValidator } from '../../../src/concepts/ontograde/bfoValidator.js';
import { Parser, Store, DataFactory } from 'n3';

const { namedNode, literal } = DataFactory;

/**
 * Helper to create a simple RDF graph for testing
 */
function createTestGraph(triples) {
  const store = new Store();
  for (const [s, p, o] of triples) {
    store.addQuad(
      namedNode(s),
      namedNode(p),
      typeof o === 'string' && o.startsWith('http') ? namedNode(o) : literal(o)
    );
  }
  return store;
}

describe('bfoValidator', () => {
  // Initialize once before all tests
  before(async () => {
    if (!bfoValidator.state.initialized) {
      await bfoValidator.actions.initialize();
    }
  });

  describe('initialization', () => {
    it('should initialize BFO reference ontology', () => {
      assert.ok(bfoValidator.state.initialized, 'Should be initialized');
      assert.ok(bfoValidator.state.referenceStore, 'Should have reference store');
      assert.ok(bfoValidator.state.referenceStore.size > 0, 'Store should have triples');
    });

    it('should load ontology in less than 100ms', async () => {
      // Re-initialize to test performance
      bfoValidator.state.initialized = false;
      const start = Date.now();
      await bfoValidator.actions.initialize();
      const elapsed = Date.now() - start;

      assert.ok(elapsed < 100, `Should load in <100ms, took ${elapsed}ms`);
    });

    it('should emit bfoInitialized event', async () => {
      let eventReceived = false;

      const handler = (event, payload) => {
        if (event === 'bfoInitialized') {
          eventReceived = true;
          assert.ok(payload.tripleCount > 0, 'Should have triple count');
          assert.ok(payload.elapsed >= 0, 'Should have elapsed time');
        }
      };

      bfoValidator.subscribe(handler);
      bfoValidator.state.initialized = false;
      await bfoValidator.actions.initialize();
      bfoValidator.unsubscribe(handler);

      assert.ok(eventReceived, 'Should emit bfoInitialized event');
    });
  });

  describe('extractUserClasses', () => {
    it('should extract CCO classes from RDF graph', () => {
      const graph = createTestGraph([
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
      ]);

      const classes = bfoValidator.helpers.extractUserClasses(graph);

      assert.equal(classes.length, 2, 'Should find 2 classes');
      assert.ok(classes.includes('http://www.ontologyrepository.com/CommonCoreOntologies/Person'));
      assert.ok(classes.includes('http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'));
    });

    it('should include BFO classes (Iteration 5 enhancement)', () => {
      const graph = createTestGraph([
        ['http://example.org/Thing_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000001'], // BFO class
      ]);

      const classes = bfoValidator.helpers.extractUserClasses(graph);

      assert.equal(classes.length, 1, 'Should include BFO classes for direct usage');
      assert.ok(classes.includes('http://purl.obolibrary.org/obo/BFO_0000001'));
    });

    it('should include example.org classes', () => {
      const graph = createTestGraph([
        ['http://example.org/Custom_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example.org/CustomClass'],
      ]);

      const classes = bfoValidator.helpers.extractUserClasses(graph);

      assert.equal(classes.length, 1);
      assert.ok(classes.includes('http://example.org/CustomClass'));
    });

    it('should return empty array for graph with no classes', () => {
      const graph = createTestGraph([
        ['http://example.org/Thing_0', 'http://example.org/hasName', 'Test'],
      ]);

      const classes = bfoValidator.helpers.extractUserClasses(graph);

      assert.equal(classes.length, 0);
    });
  });

  describe('findPathToEntity', () => {
    it('should find path from Person to Entity', () => {
      const userGraph = createTestGraph([
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000040'], // Material Entity
      ]);

      const path = bfoValidator.helpers.findPathToEntity(
        'http://www.ontologyrepository.com/CommonCoreOntologies/Person',
        'http://purl.obolibrary.org/obo/BFO_0000001', // Entity
        userGraph,
        bfoValidator.state.referenceStore
      );

      assert.ok(path, 'Should find a path');
      assert.ok(path.length > 0, 'Path should have steps');
      assert.equal(path[0], 'http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'Should start with Person');
      assert.equal(path[path.length - 1], 'http://purl.obolibrary.org/obo/BFO_0000001', 'Should end with Entity');
    });

    it('should find path from Role to Entity', () => {
      const userGraph = createTestGraph([
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000023'], // Role
      ]);

      const path = bfoValidator.helpers.findPathToEntity(
        'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole',
        'http://purl.obolibrary.org/obo/BFO_0000001', // Entity
        userGraph,
        bfoValidator.state.referenceStore
      );

      assert.ok(path, 'Should find a path');
      assert.ok(path.includes('http://purl.obolibrary.org/obo/BFO_0000023'), 'Should include Role');
      assert.ok(path.includes('http://purl.obolibrary.org/obo/BFO_0000001'), 'Should include Entity');
    });

    it('should return null for orphan class with no path', () => {
      const userGraph = createTestGraph([
        // Orphan class with no subClassOf relationship
        ['http://example.org/OrphanClass', 'http://www.w3.org/2000/01/rdf-schema#label', 'Orphan'],
      ]);

      const path = bfoValidator.helpers.findPathToEntity(
        'http://example.org/OrphanClass',
        'http://purl.obolibrary.org/obo/BFO_0000001',
        userGraph,
        bfoValidator.state.referenceStore
      );

      assert.equal(path, null, 'Should return null for orphan');
    });

    it('should handle cyclic references', () => {
      const userGraph = createTestGraph([
        ['http://example.org/ClassA', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://example.org/ClassB'],
        ['http://example.org/ClassB', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://example.org/ClassA'], // Cycle!
      ]);

      const path = bfoValidator.helpers.findPathToEntity(
        'http://example.org/ClassA',
        'http://purl.obolibrary.org/obo/BFO_0000001',
        userGraph,
        bfoValidator.state.referenceStore
      );

      assert.equal(path, null, 'Should handle cycles gracefully');
    });
  });

  describe('checkRooting', () => {
    it('should pass for all rooted classes', () => {
      const graph = createTestGraph([
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000040'],
      ]);

      const result = bfoValidator.helpers.checkRooting(graph);

      assert.ok(result.pass, 'Should pass validation');
      assert.equal(result.totalClasses, 1);
      assert.equal(result.rootedClasses, 1);
      assert.equal(result.orphanClasses, 0);
      assert.equal(result.orphans.length, 0);
    });

    it('should fail for orphan classes', () => {
      const graph = createTestGraph([
        ['http://example.org/Custom_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example.org/OrphanClass'],
        // No subClassOf relationship!
      ]);

      const result = bfoValidator.helpers.checkRooting(graph);

      assert.equal(result.pass, false, 'Should fail validation');
      assert.equal(result.totalClasses, 1);
      assert.equal(result.rootedClasses, 0);
      assert.equal(result.orphanClasses, 1);
      assert.equal(result.orphans.length, 1);
      assert.ok(result.orphans.includes('http://example.org/OrphanClass'));
    });

    it('should handle mixed rooted and orphan classes', () => {
      const graph = createTestGraph([
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://example.org/Orphan_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example.org/OrphanClass'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000040'],
      ]);

      const result = bfoValidator.helpers.checkRooting(graph);

      assert.equal(result.pass, false, 'Should fail if any orphans');
      assert.equal(result.totalClasses, 2);
      assert.equal(result.rootedClasses, 1);
      assert.equal(result.orphanClasses, 1);
    });

    it('should return pass for empty graph', () => {
      const graph = createTestGraph([]);

      const result = bfoValidator.helpers.checkRooting(graph);

      assert.ok(result.pass, 'Empty graph should pass');
      assert.equal(result.totalClasses, 0);
      assert.ok(result.message.includes('No user-defined classes'));
    });

    it('should include paths for rooted classes', () => {
      const graph = createTestGraph([
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000040'],
      ]);

      const result = bfoValidator.helpers.checkRooting(graph);

      assert.ok(result.paths, 'Should have paths object');
      assert.ok(result.paths['http://www.ontologyrepository.com/CommonCoreOntologies/Person'], 'Should have path for Person');
    });
  });

  describe('validateRooting action', () => {
    it('should validate and emit rootingValidated event', () => {
      const graph = createTestGraph([
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000040'],
      ]);

      let eventReceived = false;

      const handler = (event, payload) => {
        if (event === 'rootingValidated') {
          eventReceived = true;
          assert.equal(payload.diagramId, 'test-1');
          assert.ok(payload.result);
          assert.ok(payload.result.pass);
        }
      };

      bfoValidator.subscribe(handler);
      bfoValidator.actions.validateRooting({ diagramId: 'test-1', rdfGraph: graph });
      bfoValidator.unsubscribe(handler);

      assert.ok(eventReceived, 'Should emit rootingValidated event');
    });

    it('should store validation results in state', () => {
      const graph = createTestGraph([
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000040'],
      ]);

      bfoValidator.actions.validateRooting({ diagramId: 'test-2', rdfGraph: graph });

      assert.ok(bfoValidator.state.validationResults.has('test-2'), 'Should store result');
      const result = bfoValidator.state.validationResults.get('test-2');
      assert.ok(result.pass);
    });

    it('should emit rootingValidationFailed on error', () => {
      let eventReceived = false;

      const handler = (event, payload) => {
        if (event === 'rootingValidationFailed') {
          eventReceived = true;
          assert.equal(payload.diagramId, 'test-3');
          assert.ok(payload.error);
        }
      };

      bfoValidator.subscribe(handler);

      // Force an error by passing invalid input
      bfoValidator.actions.validateRooting({ diagramId: 'test-3', rdfGraph: null });

      bfoValidator.unsubscribe(handler);

      assert.ok(eventReceived, 'Should emit rootingValidationFailed event');
    });
  });

  describe('getClassLabel', () => {
    it('should return BFO label for BFO classes', () => {
      const label = bfoValidator.helpers.getClassLabel('http://purl.obolibrary.org/obo/BFO_0000001');
      assert.equal(label, 'entity');
    });

    it('should return last part of IRI for unknown classes', () => {
      const label = bfoValidator.helpers.getClassLabel('http://www.ontologyrepository.com/CommonCoreOntologies/Person');
      assert.equal(label, 'Person');
    });

    it('should handle IRIs with # separator', () => {
      const label = bfoValidator.helpers.getClassLabel('http://example.org#CustomClass');
      assert.equal(label, 'CustomClass');
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return appropriate message for initialization error', () => {
      const error = new Error('not initialized');
      const message = bfoValidator.helpers.getUserFriendlyMessage(error);
      assert.ok(message.includes('not ready'));
    });

    it('should return generic message for other errors', () => {
      const error = new Error('Something went wrong');
      const message = bfoValidator.helpers.getUserFriendlyMessage(error);
      assert.ok(message.includes('error occurred'));
    });
  });
});
