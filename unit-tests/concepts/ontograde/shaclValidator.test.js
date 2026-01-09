/**
 * Unit tests for shaclValidator
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { Store, DataFactory } from 'n3';
import { shaclValidator } from '../../../src/concepts/ontograde/shaclValidator.js';

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

describe('shaclValidator', () => {
  describe('Information Staircase Pattern', () => {
    it('should pass for valid staircase: ICE → is_concretized_by → IBE → has_text_value → Literal', () => {
      const graph = createTestGraph([
        // ICE entity
        ['http://example.org/Name_ICE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'],

        // is_concretized_by relationship
        ['http://example.org/Name_ICE', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_concretized_by', 'http://example.org/Name_IBE'],

        // IBE entity
        ['http://example.org/Name_IBE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonNameRecord'],

        // has_text_value relationship
        ['http://example.org/Name_IBE', 'http://www.ontologyrepository.com/CommonCoreOntologies/has_text_value', 'John Doe'],
      ]);

      const violations = shaclValidator.helpers.checkInformationStaircase(graph);

      assert.equal(violations.length, 0, 'Should have no violations');
    });

    it('should fail when ICE missing is_concretized_by', () => {
      const graph = createTestGraph([
        // ICE entity without is_concretized_by
        ['http://example.org/Name_ICE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'],
      ]);

      const violations = shaclValidator.helpers.checkInformationStaircase(graph);

      assert.equal(violations.length, 1);
      assert.equal(violations[0].pattern, 'Information Staircase');
      assert.ok(violations[0].message.includes('missing is_concretized_by'));
    });

    it('should fail when IBE missing has_text_value', () => {
      const graph = createTestGraph([
        // ICE entity
        ['http://example.org/Name_ICE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'],

        // is_concretized_by relationship
        ['http://example.org/Name_ICE', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_concretized_by', 'http://example.org/Name_IBE'],

        // IBE entity WITHOUT has_text_value
        ['http://example.org/Name_IBE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonNameRecord'],
      ]);

      const violations = shaclValidator.helpers.checkInformationStaircase(graph);

      assert.equal(violations.length, 1);
      assert.equal(violations[0].pattern, 'Information Staircase');
      assert.ok(violations[0].message.includes('missing has_text_value'));
    });

    it('should handle multiple ICE entities', () => {
      const graph = createTestGraph([
        // First ICE - valid
        ['http://example.org/Name_ICE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'],
        ['http://example.org/Name_ICE', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_concretized_by', 'http://example.org/Name_IBE'],
        ['http://example.org/Name_IBE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonNameRecord'],
        ['http://example.org/Name_IBE', 'http://www.ontologyrepository.com/CommonCoreOntologies/has_text_value', 'John Doe'],

        // Second ICE - invalid (missing is_concretized_by)
        ['http://example.org/Address_ICE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PostalAddress'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PostalAddress', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'],
      ]);

      const violations = shaclValidator.helpers.checkInformationStaircase(graph);

      assert.equal(violations.length, 1);
      assert.ok(violations[0].subject.includes('Address_ICE'));
    });
  });

  describe('Role Pattern', () => {
    it('should pass for valid role pattern: Entity → is_bearer_of → Role AND Process → realizes → Role', () => {
      const graph = createTestGraph([
        // Person bears Role
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of', 'http://example.org/Role_0'],

        // Process realizes Role
        ['http://example.org/Process_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ActOfOccupancy'],
        ['http://example.org/Process_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/realizes', 'http://example.org/Role_0'],
      ]);

      const violations = shaclValidator.helpers.checkRolePattern(graph);

      assert.equal(violations.length, 0, 'Should have no violations');
    });

    it('should warn when role not borne by any entity', () => {
      const graph = createTestGraph([
        // Role without bearer
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],

        // Process realizes Role
        ['http://example.org/Process_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ActOfOccupancy'],
        ['http://example.org/Process_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/realizes', 'http://example.org/Role_0'],
      ]);

      const violations = shaclValidator.helpers.checkRolePattern(graph);

      assert.equal(violations.length, 1);
      assert.equal(violations[0].pattern, 'Role Pattern');
      assert.equal(violations[0].severity, 'warning');
      assert.ok(violations[0].message.includes('not borne by any entity'));
    });

    it('should warn when role not realized by any process', () => {
      const graph = createTestGraph([
        // Person bears Role
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of', 'http://example.org/Role_0'],

        // NO Process realizes Role
      ]);

      const violations = shaclValidator.helpers.checkRolePattern(graph);

      assert.equal(violations.length, 1);
      assert.equal(violations[0].pattern, 'Role Pattern');
      assert.ok(violations[0].message.includes('not realized by any process'));
    });

    it('should detect violations for both bearer and realization', () => {
      const graph = createTestGraph([
        // Orphan role - no bearer, no realization
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
      ]);

      const violations = shaclValidator.helpers.checkRolePattern(graph);

      assert.equal(violations.length, 2);
      assert.ok(violations.some(v => v.message.includes('not borne')));
      assert.ok(violations.some(v => v.message.includes('not realized')));
    });
  });

  describe('Designation Pattern', () => {
    it('should pass when entity is_designated_by designative ICE', () => {
      const graph = createTestGraph([
        // Person designated by Name
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://example.org/Name_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/DesignativeInformationContentEntity'],
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_designated_by', 'http://example.org/Name_0'],
      ]);

      const violations = shaclValidator.helpers.checkDesignationPattern(graph);

      assert.equal(violations.length, 0, 'Should have no violations');
    });

    it('should pass when designative ICE designates entity', () => {
      const graph = createTestGraph([
        // Name designates Person
        ['http://example.org/Name_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/DesignativeInformationContentEntity'],
        ['http://example.org/Name_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/designates', 'http://example.org/Person_0'],
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
      ]);

      const violations = shaclValidator.helpers.checkDesignationPattern(graph);

      assert.equal(violations.length, 0, 'Should have no violations');
    });

    it('should warn when designative entity has no designation links', () => {
      const graph = createTestGraph([
        // Orphan Name - doesn't designate anything
        ['http://example.org/Name_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/DesignativeInformationContentEntity'],
      ]);

      const violations = shaclValidator.helpers.checkDesignationPattern(graph);

      assert.equal(violations.length, 1);
      assert.equal(violations[0].pattern, 'Designation Pattern');
      assert.equal(violations[0].severity, 'warning');
      assert.ok(violations[0].message.includes('not linked'));
    });
  });

  describe('checkPatterns', () => {
    it('should pass for valid CCO patterns', () => {
      const graph = createTestGraph([
        // Valid Information Staircase
        ['http://example.org/Name_ICE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/DesignativeInformationContentEntity'],
        ['http://example.org/Name_ICE', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_concretized_by', 'http://example.org/Name_IBE'],
        ['http://example.org/Name_IBE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonNameRecord'],
        ['http://example.org/Name_IBE', 'http://www.ontologyrepository.com/CommonCoreOntologies/has_text_value', 'John Doe'],

        // Valid Role Pattern
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of', 'http://example.org/Role_0'],
        ['http://example.org/Process_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ActOfOccupancy'],
        ['http://example.org/Process_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/realizes', 'http://example.org/Role_0'],

        // Valid Designation Pattern
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_designated_by', 'http://example.org/Name_ICE'],
        ['http://example.org/Name_ICE', 'http://www.ontologyrepository.com/CommonCoreOntologies/designates', 'http://example.org/Person_0'],
      ]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      assert.equal(result.pass, true);
      assert.equal(result.violations.length, 0);
      assert.equal(result.complianceScore, 100);
    });

    it('should calculate compliance score based on violations', () => {
      const graph = createTestGraph([
        // Invalid staircase (missing is_concretized_by)
        ['http://example.org/Name_ICE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'],

        // Invalid role (no bearer, no realization)
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
      ]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      assert.equal(result.pass, false);
      assert.ok(result.violations.length > 0);
      assert.ok(result.complianceScore < 100);
    });

    it('should return 100% score for empty graph', () => {
      const graph = createTestGraph([]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      assert.equal(result.pass, true);
      assert.equal(result.violations.length, 0);
      assert.equal(result.complianceScore, 100);
    });
  });

  describe('validatePatterns action', () => {
    it('should validate and emit patternsValidated event', (t, done) => {
      const graph = createTestGraph([
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
      ]);

      const handler = (event, payload) => {
        if (event === 'patternsValidated') {
          assert.equal(payload.diagramId, 'test-1');
          assert.ok(payload.result);
          assert.ok(payload.result.complianceScore >= 0);
          shaclValidator.unsubscribe(handler);
          done();
        }
      };

      shaclValidator.subscribe(handler);
      shaclValidator.actions.validatePatterns({ diagramId: 'test-1', rdfGraph: graph });
    });

    it('should store validation results in state', () => {
      const graph = createTestGraph([]);

      shaclValidator.actions.validatePatterns({ diagramId: 'test-2', rdfGraph: graph });

      const result = shaclValidator.state.validationResults.get('test-2');
      assert.ok(result);
      assert.equal(typeof result.complianceScore, 'number');
    });
  });

  describe('getShortIri', () => {
    it('should return cco: prefix for CCO IRIs', () => {
      const short = shaclValidator.helpers.getShortIri('http://www.ontologyrepository.com/CommonCoreOntologies/Person');
      assert.equal(short, 'cco:Person');
    });

    it('should return bfo: prefix for BFO IRIs', () => {
      const short = shaclValidator.helpers.getShortIri('http://purl.obolibrary.org/obo/BFO_0000040');
      assert.equal(short, 'bfo:BFO_0000040');
    });

    it('should return ex: prefix for example.org IRIs', () => {
      const short = shaclValidator.helpers.getShortIri('http://example.org/Person_0');
      assert.equal(short, 'ex:Person_0');
    });

    it('should return full IRI for unknown namespaces', () => {
      const iri = 'http://unknown.org/Something';
      const short = shaclValidator.helpers.getShortIri(iri);
      assert.equal(short, iri);
    });
  });
});
