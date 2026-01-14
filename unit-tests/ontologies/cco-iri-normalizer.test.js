import { describe, test, assert } from '../test-utils.js';
import {
  isCCOIri,
  extractLocalPart,
  normalizeLocalPart,
  normalizeCCOIri,
  areSameCCOClass,
  getEquivalentIris,
  expandCCOPrefix,
  CANONICAL_CCO_NAMESPACE,
  CCO_ID_TO_NAME,
} from '../../src/ontologies/cco-iri-normalizer.js';

describe('CCO IRI Normalizer', () => {

  describe('isCCOIri', () => {
    test('should recognize cco: prefix', () => {
      assert.ok(isCCOIri('cco:Person'));
      assert.ok(isCCOIri('cco:ont00001262'));
      assert.ok(isCCOIri('CCO:Person'));
    });

    test('should recognize legacy CCO namespace', () => {
      assert.ok(isCCOIri('http://www.ontologyrepository.com/CommonCoreOntologies/Person'));
    });

    test('should recognize current CCO namespace', () => {
      assert.ok(isCCOIri('https://www.commoncoreontologies.org/Person'));
      assert.ok(isCCOIri('https://www.commoncoreontologies.org/ont00001262'));
    });

    test('should NOT recognize module-specific paths as CCO IRIs (module paths are metadata, not entity IRIs)', () => {
      // In CCO 2.0+, entity IRIs use https://www.commoncoreontologies.org/ont##### directly
      // Module paths like AgentOntology/ are metadata, NOT part of entity IRIs
      assert.strictEqual(isCCOIri('https://www.commoncoreontologies.org/AgentOntology/Person'), false);
      assert.strictEqual(isCCOIri('https://www.commoncoreontologies.org/EventOntology/Act'), false);
      assert.strictEqual(isCCOIri('https://www.commoncoreontologies.org/CommonCoreOntologiesMerged/Person'), false);
    });

    test('should reject non-CCO IRIs', () => {
      assert.strictEqual(isCCOIri('http://example.org/Person'), false);
      assert.strictEqual(isCCOIri('http://purl.obolibrary.org/obo/BFO_0000040'), false);
      assert.strictEqual(isCCOIri('bfo:Entity'), false);
    });

    test('should handle null/undefined', () => {
      assert.strictEqual(isCCOIri(null), false);
      assert.strictEqual(isCCOIri(undefined), false);
      assert.strictEqual(isCCOIri(''), false);
    });
  });

  describe('extractLocalPart', () => {
    test('should extract from cco: prefix', () => {
      assert.strictEqual(extractLocalPart('cco:Person'), 'Person');
      assert.strictEqual(extractLocalPart('cco:ont00001262'), 'ont00001262');
    });

    test('should extract from full namespace', () => {
      assert.strictEqual(
        extractLocalPart('http://www.ontologyrepository.com/CommonCoreOntologies/Person'),
        'Person'
      );
      assert.strictEqual(
        extractLocalPart('https://www.commoncoreontologies.org/ont00001262'),
        'ont00001262'
      );
    });

    test('should return null for module-specific paths (not valid entity IRIs)', () => {
      // Module paths are metadata, not entity IRIs
      assert.strictEqual(extractLocalPart('https://www.commoncoreontologies.org/AgentOntology/Person'), null);
      assert.strictEqual(extractLocalPart('https://www.commoncoreontologies.org/CommonCoreOntologiesMerged/Person'), null);
    });

    test('should return null for non-CCO IRIs', () => {
      assert.strictEqual(extractLocalPart('http://example.org/Person'), null);
      assert.strictEqual(extractLocalPart('bfo:Entity'), null);
    });
  });

  describe('normalizeLocalPart', () => {
    test('should convert numeric ID to class name', () => {
      assert.strictEqual(normalizeLocalPart('ont00001262'), 'Person');
      assert.strictEqual(normalizeLocalPart('ont00000821'), 'Agent');
    });

    test('should return class name unchanged', () => {
      assert.strictEqual(normalizeLocalPart('Person'), 'Person');
      assert.strictEqual(normalizeLocalPart('Agent'), 'Agent');
    });

    test('should return unknown IDs unchanged', () => {
      assert.strictEqual(normalizeLocalPart('ont99999999'), 'ont99999999');
    });
  });

  describe('normalizeCCOIri', () => {
    test('should normalize cco: prefix to canonical form', () => {
      assert.strictEqual(
        normalizeCCOIri('cco:Person'),
        `${CANONICAL_CCO_NAMESPACE}Person`
      );
    });

    test('should normalize numeric ID to canonical form with class name', () => {
      assert.strictEqual(
        normalizeCCOIri('cco:ont00001262'),
        `${CANONICAL_CCO_NAMESPACE}Person`
      );
    });

    test('should normalize current namespace to canonical', () => {
      assert.strictEqual(
        normalizeCCOIri('https://www.commoncoreontologies.org/Person'),
        `${CANONICAL_CCO_NAMESPACE}Person`
      );
    });

    test('should NOT normalize module-specific paths (they are invalid entity IRIs)', () => {
      // Module paths are metadata, not entity IRIs - they should be returned unchanged
      assert.strictEqual(
        normalizeCCOIri('https://www.commoncoreontologies.org/AgentOntology/Person'),
        'https://www.commoncoreontologies.org/AgentOntology/Person'
      );
      assert.strictEqual(
        normalizeCCOIri('https://www.commoncoreontologies.org/CommonCoreOntologiesMerged/Person'),
        'https://www.commoncoreontologies.org/CommonCoreOntologiesMerged/Person'
      );
    });

    test('should normalize numeric ID from current namespace', () => {
      assert.strictEqual(
        normalizeCCOIri('https://www.commoncoreontologies.org/ont00001262'),
        `${CANONICAL_CCO_NAMESPACE}Person`
      );
    });

    test('should return non-CCO IRIs unchanged', () => {
      assert.strictEqual(
        normalizeCCOIri('http://example.org/Person'),
        'http://example.org/Person'
      );
      assert.strictEqual(
        normalizeCCOIri('http://purl.obolibrary.org/obo/BFO_0000040'),
        'http://purl.obolibrary.org/obo/BFO_0000040'
      );
    });
  });

  describe('areSameCCOClass', () => {
    test('should recognize same class with different namespaces', () => {
      assert.ok(areSameCCOClass(
        'cco:Person',
        'https://www.commoncoreontologies.org/Person'
      ));
      assert.ok(areSameCCOClass(
        'http://www.ontologyrepository.com/CommonCoreOntologies/Person',
        'https://www.commoncoreontologies.org/Person'
      ));
    });

    test('should recognize class name equals numeric ID', () => {
      assert.ok(areSameCCOClass(
        'cco:Person',
        'cco:ont00001262'
      ));
      assert.ok(areSameCCOClass(
        'https://www.commoncoreontologies.org/Person',
        'https://www.commoncoreontologies.org/ont00001262'
      ));
    });

    test('should reject different classes', () => {
      assert.strictEqual(areSameCCOClass('cco:Person', 'cco:Agent'), false);
    });

    test('should reject module-path IRIs (invalid entity format)', () => {
      // Module paths are not valid entity IRIs
      assert.strictEqual(areSameCCOClass(
        'cco:Person',
        'https://www.commoncoreontologies.org/AgentOntology/Person'
      ), false);
    });
  });

  describe('expandCCOPrefix', () => {
    test('should expand cco: prefix', () => {
      assert.strictEqual(
        expandCCOPrefix('cco:Person'),
        `${CANONICAL_CCO_NAMESPACE}Person`
      );
    });

    test('should expand and normalize numeric ID', () => {
      assert.strictEqual(
        expandCCOPrefix('cco:ont00001262'),
        `${CANONICAL_CCO_NAMESPACE}Person`
      );
    });

    test('should handle CCO: uppercase prefix', () => {
      assert.strictEqual(
        expandCCOPrefix('CCO:Person'),
        `${CANONICAL_CCO_NAMESPACE}Person`
      );
    });

    test('should return non-cco prefixes unchanged', () => {
      assert.strictEqual(expandCCOPrefix('bfo:Entity'), 'bfo:Entity');
      assert.strictEqual(expandCCOPrefix('ex:Thing'), 'ex:Thing');
    });
  });

  describe('getEquivalentIris', () => {
    test('should return valid variants for Person', () => {
      const equivalents = getEquivalentIris('Person');

      // Should include valid namespace variants
      assert.ok(equivalents.includes('http://www.ontologyrepository.com/CommonCoreOntologies/Person'));
      assert.ok(equivalents.includes('https://www.commoncoreontologies.org/Person'));

      // Should NOT include module-path variants (those are invalid)
      assert.strictEqual(equivalents.includes('https://www.commoncoreontologies.org/AgentOntology/Person'), false);
      assert.strictEqual(equivalents.includes('https://www.commoncoreontologies.org/CommonCoreOntologiesMerged/Person'), false);

      // Should include numeric ID variants
      assert.ok(equivalents.some(iri => iri.includes('ont00001262')));

      // Should include prefix forms
      assert.ok(equivalents.includes('cco:Person'));
    });
  });

  describe('CCO_ID_TO_NAME mapping', () => {
    test('should have common CCO classes mapped', () => {
      assert.strictEqual(CCO_ID_TO_NAME['ont00001262'], 'Person');
      assert.strictEqual(CCO_ID_TO_NAME['ont00000821'], 'Agent');
      assert.strictEqual(CCO_ID_TO_NAME['ont00001180'], 'Organization');
    });
  });

});
