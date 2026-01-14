/**
 * Integration tests for CCO IRI normalization in the Mermaid lifter
 * Tests that all CCO IRI variants are properly recognized and normalized
 */

import { describe, test, assert, beforeEach } from '../../test-utils.js';
import { mermaidLifter } from '../../../src/concepts/ontograde/mermaidLifter.js';
import { bfoValidator } from '../../../src/concepts/ontograde/bfoValidator.js';
import { shaclValidator } from '../../../src/concepts/ontograde/shaclValidator.js';

describe('IRI Normalization Integration Tests', () => {

  beforeEach(async () => {
    // Clear state
    mermaidLifter.state.rdfGraphs.clear();
    mermaidLifter.state.errors.clear();

    // Initialize BFO validator if not already
    if (!bfoValidator.state.initialized) {
      await bfoValidator.actions.initialize();
    }
  });

  describe('Positive Tests - Valid CCO IRI Variants', () => {

    test('should accept cco:ClassName prefix format', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]
Role_0["ResidentRole<br>IRI: cco:ResidentRole"]
Person_0 -->|is_bearer_of| Role_0`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);

      // Should have Person typed correctly
      const personQuads = store.getQuads(
        'http://example.org/Person_0',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://www.ontologyrepository.com/CommonCoreOntologies/Person'
      );
      assert.strictEqual(personQuads.length, 1, 'Person_0 should be typed as cco:Person');
    });

    test('should accept cco:ont##### numeric ID format', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: cco:ont00001262"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);

      // Numeric ID should be normalized to class name
      const personQuads = store.getQuads(
        'http://example.org/Person_0',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://www.ontologyrepository.com/CommonCoreOntologies/Person'
      );
      assert.strictEqual(personQuads.length, 1, 'ont00001262 should normalize to Person');
    });

    test('should accept legacy CCO namespace', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: http://www.ontologyrepository.com/CommonCoreOntologies/Person"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);

      const personQuads = store.getQuads(
        'http://example.org/Person_0',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://www.ontologyrepository.com/CommonCoreOntologies/Person'
      );
      assert.strictEqual(personQuads.length, 1, 'Legacy namespace should work');
    });

    test('should accept current CCO namespace (https)', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: https://www.commoncoreontologies.org/Person"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);

      // Should normalize to canonical namespace
      const personQuads = store.getQuads(
        'http://example.org/Person_0',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://www.ontologyrepository.com/CommonCoreOntologies/Person'
      );
      assert.strictEqual(personQuads.length, 1, 'Current namespace should normalize');
    });

    test('should accept full URL with numeric ID (base namespace)', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: https://www.commoncoreontologies.org/ont00001262"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);

      const personQuads = store.getQuads(
        'http://example.org/Person_0',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://www.ontologyrepository.com/CommonCoreOntologies/Person'
      );
      assert.strictEqual(personQuads.length, 1, 'Full URL with numeric ID should normalize');
    });

    test('should accept uppercase CCO: prefix', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: CCO:Person"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);

      const personQuads = store.getQuads(
        'http://example.org/Person_0',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://www.ontologyrepository.com/CommonCoreOntologies/Person'
      );
      assert.strictEqual(personQuads.length, 1, 'Uppercase CCO: prefix should work');
    });

    test('should handle mixed IRI formats in same diagram', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]
Role_0["ResidentRole<br>IRI: https://www.commoncoreontologies.org/ResidentRole"]
Act_0["ActOfOccupancy<br>IRI: https://www.commoncoreontologies.org/AgentOntology/ActOfOccupancy"]
Person_0 -->|is_bearer_of| Role_0
Act_0 -->|realizes| Role_0`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);

      // All should be normalized to canonical namespace
      const personQuads = store.getQuads(
        'http://example.org/Person_0',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://www.ontologyrepository.com/CommonCoreOntologies/Person'
      );
      const roleQuads = store.getQuads(
        'http://example.org/Role_0',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://www.ontologyrepository.com/CommonCoreOntologies/ResidentRole'
      );

      assert.strictEqual(personQuads.length, 1, 'Person should be typed');
      assert.strictEqual(roleQuads.length, 1, 'Role should be typed');
    });

  });

  describe('Negative Tests - Invalid/Unrecognized IRIs', () => {

    test('should reject misspelled CCO class names', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Persosn"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);
      const result = shaclValidator.helpers.checkVocabulary(store);

      // Should flag as unrecognized
      assert.ok(result.unrecognizedEntityCount > 0, 'Misspelled class should be flagged');
    });

    test('should reject unknown CCO class names', () => {
      const mermaid = `graph TD
Thing_0["Thing<br>IRI: cco:UnknownClass"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);
      const result = shaclValidator.helpers.checkVocabulary(store);

      assert.ok(result.unrecognizedEntityCount > 0, 'Unknown class should be flagged');
    });

    test('should reject invalid numeric IDs', () => {
      const mermaid = `graph TD
Thing_0["Thing<br>IRI: cco:ont99999999"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);

      // Invalid ID won't normalize, will be kept as-is
      // Validator should flag it
      const result = shaclValidator.helpers.checkVocabulary(store);
      assert.ok(result.unrecognizedEntityCount > 0, 'Invalid numeric ID should be flagged');
    });

    test('should reject unknown namespace prefixes', () => {
      const mermaid = `graph TD
Thing_0["Thing<br>IRI: foo:Person"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);
      const result = shaclValidator.helpers.checkVocabulary(store);

      assert.ok(result.unrecognizedEntityCount > 0, 'Unknown prefix should be flagged');
    });

    test('should reject typos in CCO namespace URL', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: http://www.ontologyrepositroy.com/CommonCoreOntologies/Person"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);
      const result = shaclValidator.helpers.checkVocabulary(store);

      assert.ok(result.unrecognizedEntityCount > 0, 'Typo in namespace should be flagged');
    });

    test('should reject module-path IRIs (module paths are metadata, not entity IRIs)', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: https://www.commoncoreontologies.org/AgentOntology/Person"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);
      const result = shaclValidator.helpers.checkVocabulary(store);

      // Module paths like AgentOntology/ are NOT valid entity IRIs
      assert.ok(result.unrecognizedEntityCount > 0, 'Module-path IRI should be flagged as invalid');
    });

    test('should reject merged module-path IRIs', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: https://www.commoncoreontologies.org/CommonCoreOntologiesMerged/Person"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);
      const result = shaclValidator.helpers.checkVocabulary(store);

      // Merged module paths are NOT valid entity IRIs
      assert.ok(result.unrecognizedEntityCount > 0, 'Merged module-path IRI should be flagged');
    });

    test('should handle nodes without IRI (defaults to example.org)', () => {
      const mermaid = `graph TD
Person_0["Person"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);

      // Without explicit IRI, defaults to example.org namespace
      const personQuads = store.getQuads(
        'http://example.org/Person_0',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        null
      );

      assert.strictEqual(personQuads.length, 1, 'Should still create type triple');
      // Type will be http://example.org/Person_0 (the default)
      assert.ok(
        personQuads[0].object.value.includes('example.org'),
        'Default type should use example.org'
      );
    });

  });

  describe('BFO Rooting Validation with Normalized IRIs', () => {

    test('should pass BFO rooting for normalized CCO classes', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);
      const result = bfoValidator.helpers.checkRooting(store);

      assert.ok(result.pass, 'Normalized CCO class should be rooted in BFO');
      assert.strictEqual(result.orphanClasses, 0, 'Should have no orphans');
    });

    test('should pass BFO rooting for numeric ID format', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: cco:ont00001262"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);
      const result = bfoValidator.helpers.checkRooting(store);

      assert.ok(result.pass, 'Numeric ID should normalize and pass BFO rooting');
    });

    test('should pass BFO rooting for base namespace with numeric ID', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: https://www.commoncoreontologies.org/ont00001262"]`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);
      const result = bfoValidator.helpers.checkRooting(store);

      assert.ok(result.pass, 'Base namespace with numeric ID should normalize and pass');
    });

  });

  describe('Full Validation Pipeline with Various IRI Formats', () => {

    test('complete diagram with cco: prefix should score well', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]
Role_0["ResidentRole<br>IRI: cco:ResidentRole"]
Act_0["ActOfOccupancy<br>IRI: cco:ActOfOccupancy"]
Person_0 -->|is_bearer_of| Role_0
Act_0 -->|realizes| Role_0
Person_0 -->|participates_in| Act_0`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);

      // Check BFO rooting
      const bfoResult = bfoValidator.helpers.checkRooting(store);
      assert.ok(bfoResult.pass, 'All classes should be rooted');

      // Check patterns
      const patternResult = shaclValidator.helpers.checkPatterns(store);
      assert.strictEqual(patternResult.violationCount, 0, 'Should have no violations');

      // Check vocabulary
      assert.strictEqual(
        patternResult.vocabularyStatus.unknownEntities,
        0,
        'Should have no unknown entities'
      );
    });

    test('complete diagram with mixed valid formats should score well', () => {
      const mermaid = `graph TD
Person_0["Person<br>IRI: cco:Person"]
Role_0["ResidentRole<br>IRI: https://www.commoncoreontologies.org/ResidentRole"]
Act_0["ActOfOccupancy<br>IRI: cco:ActOfOccupancy"]
TI_0["TemporalInterval<br>IRI: cco:TemporalInterval"]
Person_0 -->|is_bearer_of| Role_0
Act_0 -->|realizes| Role_0
Person_0 -->|participates_in| Act_0
Act_0 -->|occurs_during| TI_0
TI_0 -->|has_start_time| "2026-01-01T00:00:00"
TI_0 -->|has_end_time| "2026-12-31T23:59:59"`;

      const store = mermaidLifter.helpers.liftToRDF(mermaid);

      // Check BFO rooting
      const bfoResult = bfoValidator.helpers.checkRooting(store);
      assert.ok(bfoResult.pass, 'All valid format classes should be rooted');

      // Check vocabulary
      const vocabResult = shaclValidator.helpers.checkVocabulary(store);
      assert.strictEqual(
        vocabResult.unrecognizedEntityCount,
        0,
        'Valid formats should all be recognized'
      );
    });

  });

});
