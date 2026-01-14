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
      (o.startsWith('http://') || o.startsWith('https://')) ? namedNode(o) : literal(o)
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

      const result = shaclValidator.helpers.checkInformationStaircase(graph);

      assert.equal(result.issues.length, 0, 'Should have no issues');
    });

    it('should warn when ICE missing is_concretized_by', () => {
      const graph = createTestGraph([
        // ICE entity without is_concretized_by
        ['http://example.org/Name_ICE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'],
      ]);

      const result = shaclValidator.helpers.checkInformationStaircase(graph);

      assert.equal(result.issues.length, 1);
      assert.equal(result.issues[0].pattern, 'Information Staircase');
      // Expert review: ICE can exist abstractly, so this is a WARNING
      assert.equal(result.issues[0].severity, 'warning');
      assert.ok(result.issues[0].message.includes('is_concretized_by'));
    });

    it('should warn when IBE missing has_text_value', () => {
      const graph = createTestGraph([
        // ICE entity
        ['http://example.org/Name_ICE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'],

        // is_concretized_by relationship
        ['http://example.org/Name_ICE', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_concretized_by', 'http://example.org/Name_IBE'],

        // IBE entity WITHOUT has_text_value
        ['http://example.org/Name_IBE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonNameRecord'],
      ]);

      const result = shaclValidator.helpers.checkInformationStaircase(graph);

      assert.equal(result.issues.length, 1);
      assert.equal(result.issues[0].pattern, 'Information Staircase');
      assert.ok(result.issues[0].message.includes('has_text_value'));
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

      const result = shaclValidator.helpers.checkInformationStaircase(graph);

      assert.equal(result.issues.length, 1);
      assert.ok(result.issues[0].subject.includes('Address_ICE'));
    });
  });

  describe('Role Pattern', () => {
    it('should pass for valid role pattern: Entity → is_bearer_of → Role AND Process → realizes → Role', () => {
      const graph = createTestGraph([
        // Person bears Role (with proper BFO typing)
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000004'],
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of', 'http://example.org/Role_0'],

        // Process realizes Role (with proper BFO typing)
        ['http://example.org/Process_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ActOfOccupancy'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ActOfOccupancy', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000015'],
        ['http://example.org/Process_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/realizes', 'http://example.org/Role_0'],
      ]);

      const result = shaclValidator.helpers.checkRolePattern(graph);

      assert.equal(result.issues.length, 0, 'Should have no issues');
    });

    it('should error when role not borne by any entity (VIOLATION per expert)', () => {
      const graph = createTestGraph([
        // Role without bearer
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],

        // Process realizes Role (with proper BFO typing)
        ['http://example.org/Process_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ActOfOccupancy'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ActOfOccupancy', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000015'],
        ['http://example.org/Process_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/realizes', 'http://example.org/Role_0'],
      ]);

      const result = shaclValidator.helpers.checkRolePattern(graph);

      // Should have at least one issue - the missing bearer (VIOLATION)
      assert.ok(result.issues.length >= 1);
      const bearerViolation = result.issues.find(i => i.rule === 'Role Bearer');
      assert.ok(bearerViolation, 'Should have bearer violation');
      assert.equal(bearerViolation.severity, 'violation');
      assert.ok(bearerViolation.message.includes('must be borne'));
    });

    it('should warn when role not realized by any process (WARNING per expert)', () => {
      const graph = createTestGraph([
        // Person bears Role (with proper BFO typing)
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000004'],
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of', 'http://example.org/Role_0'],

        // NO Process realizes Role
      ]);

      const result = shaclValidator.helpers.checkRolePattern(graph);

      // Should have realization warning
      const realizationWarning = result.issues.find(i => i.rule === 'Role Realization');
      assert.ok(realizationWarning, 'Should have realization warning');
      assert.equal(realizationWarning.severity, 'warning');
      assert.ok(realizationWarning.message.includes('not realized'));
    });

    it('should detect issues for both bearer and realization', () => {
      const graph = createTestGraph([
        // Orphan role - no bearer, no realization
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
      ]);

      const result = shaclValidator.helpers.checkRolePattern(graph);

      assert.equal(result.issues.length, 2);
      assert.ok(result.issues.some(v => v.message.includes('must be borne')));
      assert.ok(result.issues.some(v => v.message.includes('not realized')));
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

      const result = shaclValidator.helpers.checkDesignationPattern(graph);

      assert.equal(result.issues.length, 0, 'Should have no issues');
    });

    it('should pass when designative ICE designates entity', () => {
      const graph = createTestGraph([
        // Name designates Person
        ['http://example.org/Name_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/DesignativeInformationContentEntity'],
        ['http://example.org/Name_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/designates', 'http://example.org/Person_0'],
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
      ]);

      const result = shaclValidator.helpers.checkDesignationPattern(graph);

      assert.equal(result.issues.length, 0, 'Should have no issues');
    });

    it('should error when designative entity has no designation links (VIOLATION per expert)', () => {
      const graph = createTestGraph([
        // Orphan Name - doesn't designate anything
        ['http://example.org/Name_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/DesignativeInformationContentEntity'],
      ]);

      const result = shaclValidator.helpers.checkDesignationPattern(graph);

      assert.equal(result.issues.length, 1);
      assert.equal(result.issues[0].pattern, 'Designation Pattern');
      // Expert review: Name that names nothing is VIOLATION
      assert.equal(result.issues[0].severity, 'violation');
      assert.ok(result.issues[0].message.includes('must designate'));
    });
  });

  describe('checkPatterns', () => {
    it('should pass for valid CCO patterns (no violations)', () => {
      const graph = createTestGraph([
        // Valid Information Staircase
        ['http://example.org/Name_ICE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/DesignativeInformationContentEntity'],
        ['http://example.org/Name_ICE', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_concretized_by', 'http://example.org/Name_IBE'],
        ['http://example.org/Name_IBE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationBearingEntity'],
        ['http://example.org/Name_IBE', 'http://www.ontologyrepository.com/CommonCoreOntologies/concretizes', 'http://example.org/Name_ICE'],
        ['http://example.org/Name_IBE', 'http://www.ontologyrepository.com/CommonCoreOntologies/has_text_value', 'John Doe'],

        // Valid Role Pattern (with proper BFO typing)
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000004'],
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of', 'http://example.org/Role_0'],
        ['http://example.org/Process_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ActOfOccupancy'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ActOfOccupancy', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://purl.obolibrary.org/obo/BFO_0000015'],
        ['http://example.org/Process_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/realizes', 'http://example.org/Role_0'],

        // Valid Designation Pattern
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_designated_by', 'http://example.org/Name_ICE'],
        ['http://example.org/Name_ICE', 'http://www.ontologyrepository.com/CommonCoreOntologies/designates', 'http://example.org/Person_0'],
      ]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      // Should pass (no violations)
      assert.equal(result.pass, true);
      // Violations should be 0
      assert.equal(result.violationCount, 0);
      // Score may not be exactly 100 if there are warnings, but should be high
      assert.ok(result.complianceScore >= 90, `Compliance score should be >= 90, got ${result.complianceScore}`);
    });

    it('should fail when violations are present', () => {
      const graph = createTestGraph([
        // Invalid role (no bearer) - VIOLATION per expert
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
      ]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      // Should fail due to VIOLATION (missing bearer)
      assert.equal(result.pass, false);
      assert.ok(result.violationCount > 0);
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

  describe('Vocabulary Validation', () => {
    it('should detect entities with unrecognized namespaces', () => {
      const graph = createTestGraph([
        // Entity with unrecognized namespace (typo in CCO URL)
        ['http://example.org/Peson_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'https://www.commoncoreontolog.org/fon'],
      ]);

      const result = shaclValidator.helpers.checkVocabulary(graph);

      // EXPERT REVIEW (2026-01-13): Elevated from INFO to WARNING per CCO expert
      // A typo represents a failure to ground the model in CCO's semantic space
      assert.ok(result.issues.length >= 1, 'Should have at least one issue');
      const entityIssue = result.issues.find(i => i.rule === 'Unrecognized Namespace');
      assert.ok(entityIssue, 'Should have unrecognized namespace issue');
      assert.equal(entityIssue.severity, 'warning');
      assert.ok(entityIssue.message.includes('not using a recognized CCO/BFO namespace'));
    });

    it('should detect typos in CCO class names', () => {
      const graph = createTestGraph([
        // Entity with correct CCO namespace but misspelled class name
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'https://www.commoncoreontologies.org/Persosn'],
      ]);

      const result = shaclValidator.helpers.checkVocabulary(graph);

      // EXPERT REVIEW (2026-01-13): Elevated from INFO to WARNING per CCO expert
      assert.ok(result.issues.length >= 1, 'Should have at least one issue');
      const classIssue = result.issues.find(i => i.rule === 'Unknown CCO Class');
      assert.ok(classIssue, 'Should have unknown CCO class issue');
      assert.equal(classIssue.severity, 'warning');
      assert.ok(classIssue.message.includes('does not exist in CCO vocabulary'));
    });

    it('should detect predicates not in known vocabulary', () => {
      const graph = createTestGraph([
        // Using a made-up predicate "foo:is_bearer_of" instead of cco:is_bearer_of
        ['http://example.org/Person_0', 'http://foo.org/is_bearer_of', 'http://example.org/Role_0'],
      ]);

      const result = shaclValidator.helpers.checkVocabulary(graph);

      // EXPERT REVIEW (2026-01-13): Elevated from INFO to WARNING per CCO expert
      const predicateIssue = result.issues.find(i => i.rule === 'Unknown Predicate');
      assert.ok(predicateIssue, 'Should have unknown predicate issue');
      assert.equal(predicateIssue.severity, 'warning');
      assert.ok(predicateIssue.message.includes('not a recognized CCO/BFO/RDF property'));
    });

    it('should not flag entities in CCO namespace', () => {
      const graph = createTestGraph([
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
      ]);

      const result = shaclValidator.helpers.checkVocabulary(graph);

      // CCO namespace should be recognized
      const ccoIssue = result.issues.find(i =>
        i.subject && i.subject.includes('CommonCoreOntologies/Person')
      );
      assert.ok(!ccoIssue, 'Should not flag CCO namespace entities');
    });

    it('should not flag entities in BFO namespace', () => {
      const graph = createTestGraph([
        ['http://example.org/Entity_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://purl.obolibrary.org/obo/BFO_0000040'],
      ]);

      const result = shaclValidator.helpers.checkVocabulary(graph);

      // BFO namespace should be recognized
      const bfoIssue = result.issues.find(i =>
        i.subject && i.subject.includes('obo/BFO_')
      );
      assert.ok(!bfoIssue, 'Should not flag BFO namespace entities');
    });

    it('should not flag known RDF/RDFS predicates', () => {
      const graph = createTestGraph([
        ['http://example.org/Class', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://example.org/SubClass', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://example.org/Class'],
      ]);

      const result = shaclValidator.helpers.checkVocabulary(graph);

      // rdf:type and rdfs:subClassOf should be recognized
      const rdfIssue = result.issues.find(i =>
        i.rule === 'Unknown Predicate' && i.subject.includes('rdf-syntax-ns#type')
      );
      assert.ok(!rdfIssue, 'Should not flag rdf:type');

      const rdfsIssue = result.issues.find(i =>
        i.rule === 'Unknown Predicate' && i.subject.includes('rdfs#subClassOf')
      );
      assert.ok(!rdfsIssue, 'Should not flag rdfs:subClassOf');
    });

    it('should allow example.org namespace for testing purposes', () => {
      const graph = createTestGraph([
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
      ]);

      const result = shaclValidator.helpers.checkVocabulary(graph);

      // example.org should be allowed (for testing)
      const exampleIssue = result.issues.find(i =>
        i.subject && i.subject === 'http://example.org/Person_0'
      );
      assert.ok(!exampleIssue, 'Should not flag example.org namespace');
    });

    it('should include vocabulary validation in checkPatterns', () => {
      const graph = createTestGraph([
        // Entity with bad namespace
        ['http://bad.org/Thing', 'http://bad.org/weird_predicate', 'http://worse.org/OtherThing'],
      ]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      // Should include vocabulary validation pattern
      assert.ok(result.patternsChecked.includes('Vocabulary Validation'), 'Should check vocabulary');
      // Should have WARNING messages (not violations) - EXPERT REVIEW 2026-01-13: elevated from INFO
      assert.ok(result.warningCount >= 1, 'Should have WARNING messages for vocabulary issues');
    });

    it('should report counts of unrecognized entities and predicates', () => {
      const graph = createTestGraph([
        ['http://bad.org/Thing1', 'http://bad.org/predicate1', 'http://bad.org/Thing2'],
        ['http://bad.org/Thing3', 'http://bad.org/predicate2', 'http://bad.org/Thing4'],
      ]);

      const result = shaclValidator.helpers.checkVocabulary(graph);

      // Should report counts
      assert.ok(result.unrecognizedEntityCount >= 4, 'Should count unrecognized entities');
      assert.ok(result.unrecognizedPredicateCount >= 2, 'Should count unrecognized predicates');
    });

    it('should include vocabularyStatus in checkPatterns result', () => {
      const graph = createTestGraph([
        // Mix of recognized and unrecognized entities
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://bad.org/UnknownThing', 'http://bad.org/unknown_predicate', 'http://worse.org/AnotherThing'],
      ]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      // Should include vocabularyStatus
      assert.ok(result.vocabularyStatus, 'Should have vocabularyStatus');
      assert.equal(typeof result.vocabularyStatus.totalEntities, 'number');
      assert.equal(typeof result.vocabularyStatus.unknownEntities, 'number');
      assert.equal(typeof result.vocabularyStatus.unknownPercentage, 'number');
      assert.equal(typeof result.vocabularyStatus.hasUnknownVocabulary, 'boolean');
    });

    it('should show hasUnknownVocabulary=true when unrecognized entities exist', () => {
      const graph = createTestGraph([
        ['http://bad.org/Thing', 'http://bad.org/predicate', 'http://worse.org/OtherThing'],
      ]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      assert.equal(result.vocabularyStatus.hasUnknownVocabulary, true);
      assert.ok(result.vocabularyStatus.unknownPercentage > 0);
    });

    it('should show hasUnknownVocabulary=false when all entities are recognized', () => {
      const graph = createTestGraph([
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
      ]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      assert.equal(result.vocabularyStatus.hasUnknownVocabulary, false);
      assert.equal(result.vocabularyStatus.unknownPercentage, 0);
    });

    it('should update message when unknown vocabulary exists', () => {
      const graph = createTestGraph([
        ['http://bad.org/Thing', 'http://bad.org/predicate', 'http://worse.org/OtherThing'],
      ]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      // New message format: "X% unrecognized (Y entities, Z predicates)"
      assert.ok(result.message.includes('unrecognized'), `Message should mention unrecognized: ${result.message}`);
    });
  });

  describe('isKnownNamespace', () => {
    it('should recognize CCO namespace', () => {
      assert.equal(
        shaclValidator.helpers.isKnownNamespace('http://www.ontologyrepository.com/CommonCoreOntologies/Person'),
        true
      );
    });

    it('should recognize BFO namespace', () => {
      assert.equal(
        shaclValidator.helpers.isKnownNamespace('http://purl.obolibrary.org/obo/BFO_0000040'),
        true
      );
    });

    it('should recognize RDF namespace', () => {
      assert.equal(
        shaclValidator.helpers.isKnownNamespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        true
      );
    });

    it('should recognize RDFS namespace', () => {
      assert.equal(
        shaclValidator.helpers.isKnownNamespace('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        true
      );
    });

    it('should recognize example.org for testing', () => {
      assert.equal(
        shaclValidator.helpers.isKnownNamespace('http://example.org/Thing'),
        true
      );
    });

    it('should reject unknown namespaces', () => {
      assert.equal(
        shaclValidator.helpers.isKnownNamespace('http://foo.org/Bar'),
        false
      );
    });

    it('should reject misspelled CCO namespace', () => {
      assert.equal(
        shaclValidator.helpers.isKnownNamespace('https://www.commoncoreontolog.org/fon'),
        false
      );
    });
  });

  describe('getDisplayIri', () => {
    it('should return short form for CCO IRIs', () => {
      const display = shaclValidator.helpers.getDisplayIri('http://www.ontologyrepository.com/CommonCoreOntologies/Person');
      assert.equal(display, 'cco:Person');
    });

    it('should return short form for BFO IRIs', () => {
      const display = shaclValidator.helpers.getDisplayIri('http://purl.obolibrary.org/obo/BFO_0000040');
      assert.equal(display, 'bfo:BFO_0000040');
    });

    it('should return full IRI for unknown namespaces', () => {
      const iri = 'http://unknown.org/Something';
      const display = shaclValidator.helpers.getDisplayIri(iri);
      assert.equal(display, iri);
    });

    it('should handle prefixed names without protocol', () => {
      const display = shaclValidator.helpers.getDisplayIri('foo:Bar');
      assert.equal(display, 'foo:Bar');
    });
  });

  describe('Domain/Range Validation', () => {
    it('should pass for valid is_bearer_of domain (IndependentContinuant → Role)', () => {
      const graph = createTestGraph([
        // Person (IndependentContinuant) is_bearer_of Role
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://example.org/StudentRole_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/StudentRole'],
        // Role subclass hierarchy
        ['http://www.ontologyrepository.com/CommonCoreOntologies/StudentRole', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
        // is_bearer_of relationship
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of', 'http://example.org/StudentRole_0'],
      ]);

      const result = shaclValidator.helpers.checkDomainRange(graph);

      // Should have no domain/range issues (Person can bear Role)
      const domainIssue = result.issues.find(i => i.rule === 'Domain Constraint');
      assert.ok(!domainIssue, 'Should not flag valid domain');
    });

    it('should warn when realizes has wrong domain type (expected Process)', () => {
      const graph = createTestGraph([
        // Person typed as Person (not Process)
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://example.org/StudentRole_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/StudentRole'],
        // INCORRECT: Person realizes Role (should be Process realizes Role)
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/realizes', 'http://example.org/StudentRole_0'],
      ]);

      const result = shaclValidator.helpers.checkDomainRange(graph);

      // Should warn that Person is not a Process
      const domainIssue = result.issues.find(i => i.rule === 'Domain Constraint');
      assert.ok(domainIssue, 'Should flag invalid domain for realizes');
      assert.equal(domainIssue.severity, 'warning');
      assert.ok(domainIssue.message.includes('realizes'));
    });

    it('should warn when is_concretized_by has wrong range type', () => {
      const graph = createTestGraph([
        // ICE entity
        ['http://example.org/Name_ICE', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/PersonName'],
        ['http://www.ontologyrepository.com/CommonCoreOntologies/PersonName', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'],
        // Person entity (NOT an IBE)
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        // INCORRECT: ICE is_concretized_by Person (should be IBE)
        ['http://example.org/Name_ICE', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_concretized_by', 'http://example.org/Person_0'],
      ]);

      const result = shaclValidator.helpers.checkDomainRange(graph);

      // Should warn that Person is not an IBE
      const rangeIssue = result.issues.find(i => i.rule === 'Range Constraint');
      assert.ok(rangeIssue, 'Should flag invalid range for is_concretized_by');
      assert.equal(rangeIssue.severity, 'warning');
    });

    it('should pass when participates_in connects Agent to Act', () => {
      const graph = createTestGraph([
        // Agent/Person
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        // Act
        ['http://example.org/Act_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Act'],
        // Valid: Person participates_in Act
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/participates_in', 'http://example.org/Act_0'],
      ]);

      const result = shaclValidator.helpers.checkDomainRange(graph);

      // Should have no issues
      const participatesIssue = result.issues.find(i =>
        i.message && i.message.includes('participates_in')
      );
      assert.ok(!participatesIssue, 'Should not flag valid participates_in');
    });

    it('should warn when participates_in has wrong range type (expected Process/Act)', () => {
      const graph = createTestGraph([
        // Person
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        // Another Person (NOT an Act)
        ['http://example.org/Person_1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        // INCORRECT: Person participates_in Person (should be Act)
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/participates_in', 'http://example.org/Person_1'],
      ]);

      const result = shaclValidator.helpers.checkDomainRange(graph);

      // Should warn that Person_1 is not an Act
      const rangeIssue = result.issues.find(i => i.rule === 'Range Constraint');
      assert.ok(rangeIssue, 'Should flag invalid range for participates_in');
    });

    it('should not flag relationships without type information', () => {
      const graph = createTestGraph([
        // Entities without type declarations
        ['http://example.org/Thing_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of', 'http://example.org/OtherThing_0'],
      ]);

      const result = shaclValidator.helpers.checkDomainRange(graph);

      // Should not flag when we don't have type info (can't validate)
      assert.equal(result.issues.length, 0, 'Should not flag when types are unknown');
    });

    it('should count relationships checked', () => {
      const graph = createTestGraph([
        ['http://example.org/A', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of', 'http://example.org/B'],
        ['http://example.org/C', 'http://www.ontologyrepository.com/CommonCoreOntologies/realizes', 'http://example.org/D'],
        ['http://example.org/E', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example.org/F'], // Not a constrained predicate
      ]);

      const result = shaclValidator.helpers.checkDomainRange(graph);

      // Should count only CCO predicates with constraints
      assert.equal(result.relationshipsChecked, 2, 'Should count only constrained predicates');
    });

    it('should include Domain/Range Validation in checkPatterns when vocabulary is recognized', () => {
      const graph = createTestGraph([
        // Valid vocabulary
        ['http://example.org/Person_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'],
        ['http://example.org/Role_0', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.ontologyrepository.com/CommonCoreOntologies/Role'],
        ['http://example.org/Person_0', 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of', 'http://example.org/Role_0'],
      ]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      // Domain/Range Validation should be in patterns checked
      assert.ok(
        result.patternsChecked.includes('Domain/Range Validation'),
        'Should include Domain/Range Validation in patterns checked'
      );
    });

    it('should skip Domain/Range Validation when vocabulary is mostly unrecognized', () => {
      const graph = createTestGraph([
        // Mostly unrecognized vocabulary
        ['http://bad.org/Thing1', 'http://bad.org/predicate', 'http://bad.org/Thing2'],
        ['http://bad.org/Thing3', 'http://bad.org/predicate2', 'http://bad.org/Thing4'],
      ]);

      const result = shaclValidator.helpers.checkPatterns(graph);

      // Domain/Range Validation should be skipped (can't validate unknown vocab)
      assert.ok(
        !result.patternsChecked.includes('Domain/Range Validation'),
        'Should skip Domain/Range Validation when vocabulary is unrecognized'
      );
    });
  });

  describe('getPredicateName', () => {
    it('should extract predicate name from CCO IRI', () => {
      const name = shaclValidator.helpers.getPredicateName(
        'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of'
      );
      assert.equal(name, 'is_bearer_of');
    });

    it('should extract predicate name from hash-separated IRI', () => {
      const name = shaclValidator.helpers.getPredicateName(
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
      );
      assert.equal(name, 'type');
    });

    it('should return original if no separator found', () => {
      const name = shaclValidator.helpers.getPredicateName('predicate');
      assert.equal(name, 'predicate');
    });
  });

  describe('isSubclassOf', () => {
    it('should detect direct subclass relationship', () => {
      const graph = createTestGraph([
        ['http://example.org/SubClass', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://example.org/SuperClass'],
      ]);

      const result = shaclValidator.helpers.isSubclassOf(
        graph,
        'http://example.org/SubClass',
        'http://example.org/SuperClass'
      );

      assert.equal(result, true);
    });

    it('should detect transitive subclass relationship', () => {
      const graph = createTestGraph([
        ['http://example.org/A', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://example.org/B'],
        ['http://example.org/B', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'http://example.org/C'],
      ]);

      const result = shaclValidator.helpers.isSubclassOf(
        graph,
        'http://example.org/A',
        'http://example.org/C'
      );

      assert.equal(result, true);
    });

    it('should return false when no subclass relationship exists', () => {
      const graph = createTestGraph([
        ['http://example.org/A', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://example.org/Class'],
      ]);

      const result = shaclValidator.helpers.isSubclassOf(
        graph,
        'http://example.org/A',
        'http://example.org/B'
      );

      assert.equal(result, false);
    });
  });
});
