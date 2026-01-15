/**
 * @module cco-iri-normalizer
 * @description Normalizes CCO IRIs to a canonical form for consistent validation
 *
 * CCO has evolved through multiple versions with different namespace conventions:
 * - Legacy: http://www.ontologyrepository.com/CommonCoreOntologies/
 * - Current: https://www.commoncoreontologies.org/
 * - Module-specific: https://www.commoncoreontologies.org/AgentOntology/
 * - Merged: https://www.commoncoreontologies.org/CommonCoreOntologiesMerged/
 *
 * Classes can be referenced by:
 * - Human-readable name: Person, Agent, Role
 * - Numeric ID: ont00001262, ont00000821
 *
 * This module normalizes all variants to the canonical form:
 * http://www.ontologyrepository.com/CommonCoreOntologies/{ClassName}
 *
 * NOTE: ID-to-name mappings are auto-generated from CCO ontology files.
 * Regenerate with: node scripts/extract-cco-classes.js
 */

// Import auto-generated mappings (regenerate with scripts/extract-cco-classes.js)
import {
  CCO_ID_TO_CLASS_NAME as GENERATED_CCO_ID_TO_CLASS_NAME,
  CCO_ID_TO_PREDICATE_NAME as GENERATED_CCO_ID_TO_PREDICATE_NAME,
  CCO_CLASS_NAME_TO_ID as GENERATED_CCO_CLASS_NAME_TO_ID,
} from './cco-classes.generated.js';

// Canonical CCO namespace (used internally for consistency)
// CCO 2.0+ uses: https://www.commoncoreontologies.org/
// Legacy uses: http://www.ontologyrepository.com/CommonCoreOntologies/
// We normalize to legacy for backwards compatibility with existing cco-bfo-mapping.ttl.js
export const CANONICAL_CCO_NAMESPACE = 'http://www.ontologyrepository.com/CommonCoreOntologies/';

// All recognized CCO namespace variants
// IMPORTANT: In CCO 2.0+, entity IRIs use the BASE namespace directly:
//   https://www.commoncoreontologies.org/ont00001262
// The module paths (AgentOntology, EventOntology, etc.) are NOT part of entity IRIs.
// They are metadata indicating which module defines the entity.
export const CCO_NAMESPACE_VARIANTS = [
  // Legacy namespace
  'http://www.ontologyrepository.com/CommonCoreOntologies/',
  'https://www.ontologyrepository.com/CommonCoreOntologies/',
  // Current CCO 2.0+ namespace (entities use this directly)
  'https://www.commoncoreontologies.org/',
  'http://www.commoncoreontologies.org/',
];

// Prefix mappings
export const CCO_PREFIXES = {
  'cco': CANONICAL_CCO_NAMESPACE,
  'CCO': CANONICAL_CCO_NAMESPACE,
};

/**
 * Maps CCO numeric IDs (ont#####) to human-readable class names
 * Source: Auto-generated from CCO 2.0 ontology files
 *
 * This mapping is automatically generated from the CCO ontology TTL files.
 * Regenerate with: node scripts/extract-cco-classes.js
 *
 * Total mappings: ~1400+ numeric IDs from CCO 2.0 modules
 */
export const CCO_ID_TO_NAME = GENERATED_CCO_ID_TO_CLASS_NAME;

// Reverse mapping: name to ID (auto-generated)
export const CCO_NAME_TO_ID = GENERATED_CCO_CLASS_NAME_TO_ID;

// Module paths that are metadata, NOT part of entity IRIs
// These appear in some CCO documentation but are NOT valid entity IRI paths
const INVALID_MODULE_PATHS = [
  'AgentOntology/',
  'EventOntology/',
  'ArtifactOntology/',
  'InformationEntityOntology/',
  'QualityOntology/',
  'TimeOntology/',
  'GeospatialOntology/',
  'UnitsOntology/',
  'ExtendedRelationOntology/',
  'CommonCoreOntologiesMerged/',
];

/**
 * Checks if a local part contains an invalid module path
 * @param {string} localPart - The local part after the namespace
 * @returns {boolean} True if it contains a module path (invalid)
 */
function hasModulePath(localPart) {
  if (!localPart) return false;
  for (const modulePath of INVALID_MODULE_PATHS) {
    if (localPart.startsWith(modulePath)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if an IRI uses any CCO namespace variant
 * Returns false for module-path IRIs (they are metadata, not entity IRIs)
 * @param {string} iri - The IRI to check
 * @returns {boolean} True if IRI is a valid CCO entity IRI
 */
export function isCCOIri(iri) {
  if (!iri) return false;

  // Check prefix form
  if (iri.startsWith('cco:') || iri.startsWith('CCO:')) {
    return true;
  }

  // Check full namespace variants
  for (const namespace of CCO_NAMESPACE_VARIANTS) {
    if (iri.startsWith(namespace)) {
      // Extract local part and check for module paths
      const localPart = iri.substring(namespace.length);
      if (hasModulePath(localPart)) {
        // Module paths are NOT valid entity IRIs
        return false;
      }
      return true;
    }
  }

  return false;
}

/**
 * Extracts the local part (class name or ID) from a CCO IRI
 * Returns null for module-path IRIs (they are invalid entity IRIs)
 * @param {string} iri - The CCO IRI
 * @returns {string|null} The local part or null if not a valid CCO IRI
 */
export function extractLocalPart(iri) {
  if (!iri) return null;

  // Handle prefix form: cco:Person -> Person
  if (iri.startsWith('cco:')) {
    return iri.substring(4);
  }
  if (iri.startsWith('CCO:')) {
    return iri.substring(4);
  }

  // Handle full namespace variants
  for (const namespace of CCO_NAMESPACE_VARIANTS) {
    if (iri.startsWith(namespace)) {
      const localPart = iri.substring(namespace.length);
      // Reject module paths - they are not valid entity IRIs
      if (hasModulePath(localPart)) {
        return null;
      }
      return localPart;
    }
  }

  return null;
}

/**
 * Normalizes a numeric ID (ont#####) to human-readable name
 * @param {string} localPart - The local part (could be ID or name)
 * @returns {string} Human-readable name or original if not found
 */
export function normalizeLocalPart(localPart) {
  if (!localPart) return localPart;

  // Check if it's a numeric ID
  if (localPart.startsWith('ont') && /^ont\d+$/.test(localPart)) {
    return CCO_ID_TO_NAME[localPart] || localPart;
  }

  return localPart;
}

/**
 * Normalizes any CCO IRI variant to the canonical form
 * @param {string} iri - Any CCO IRI variant
 * @returns {string} Canonical IRI or original if not a CCO IRI
 *
 * @example
 * normalizeCCOIri('cco:Person')
 *   -> 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'
 *
 * normalizeCCOIri('cco:ont00001262')
 *   -> 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'
 *
 * normalizeCCOIri('https://www.commoncoreontologies.org/AgentOntology/Person')
 *   -> 'http://www.ontologyrepository.com/CommonCoreOntologies/Person'
 */
export function normalizeCCOIri(iri) {
  if (!iri) return iri;

  // Check if it's a CCO IRI
  if (!isCCOIri(iri)) {
    return iri;
  }

  // Extract local part
  const localPart = extractLocalPart(iri);
  if (!localPart) return iri;

  // Normalize numeric IDs to names
  const normalizedLocal = normalizeLocalPart(localPart);

  // Return canonical form
  return CANONICAL_CCO_NAMESPACE + normalizedLocal;
}

/**
 * Checks if two CCO IRIs refer to the same class (after normalization)
 * @param {string} iri1 - First IRI
 * @param {string} iri2 - Second IRI
 * @returns {boolean} True if they refer to the same class
 */
export function areSameCCOClass(iri1, iri2) {
  return normalizeCCOIri(iri1) === normalizeCCOIri(iri2);
}

/**
 * Gets all equivalent IRIs for a CCO class
 * @param {string} className - The class name (e.g., 'Person')
 * @returns {Array<string>} Array of equivalent IRIs
 */
export function getEquivalentIris(className) {
  const equivalents = [];

  // Get numeric ID if available
  const numericId = CCO_NAME_TO_ID[className];

  // Add all namespace variants with class name
  for (const namespace of CCO_NAMESPACE_VARIANTS) {
    equivalents.push(namespace + className);
    if (numericId) {
      equivalents.push(namespace + numericId);
    }
  }

  // Add prefix forms
  equivalents.push(`cco:${className}`);
  if (numericId) {
    equivalents.push(`cco:${numericId}`);
  }

  return equivalents;
}

/**
 * Expands a prefixed CCO IRI to full canonical form
 * Handles both cco: prefix and numeric IDs
 * @param {string} prefixedIri - Prefixed IRI (e.g., 'cco:Person' or 'cco:ont00001262')
 * @returns {string} Full canonical IRI
 */
export function expandCCOPrefix(prefixedIri) {
  if (!prefixedIri) return prefixedIri;

  // Handle cco: prefix
  if (prefixedIri.startsWith('cco:') || prefixedIri.startsWith('CCO:')) {
    const localPart = prefixedIri.substring(4);
    const normalizedLocal = normalizeLocalPart(localPart);
    return CANONICAL_CCO_NAMESPACE + normalizedLocal;
  }

  return prefixedIri;
}

export default {
  CANONICAL_CCO_NAMESPACE,
  CCO_NAMESPACE_VARIANTS,
  CCO_PREFIXES,
  CCO_ID_TO_NAME,
  CCO_NAME_TO_ID,
  isCCOIri,
  extractLocalPart,
  normalizeLocalPart,
  normalizeCCOIri,
  areSameCCOClass,
  getEquivalentIris,
  expandCCOPrefix,
};
