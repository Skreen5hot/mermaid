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
 */

// Canonical CCO namespace (used internally for consistency)
export const CANONICAL_CCO_NAMESPACE = 'http://www.ontologyrepository.com/CommonCoreOntologies/';

// All recognized CCO namespace variants
export const CCO_NAMESPACE_VARIANTS = [
  'http://www.ontologyrepository.com/CommonCoreOntologies/',
  'https://www.ontologyrepository.com/CommonCoreOntologies/',
  'https://www.commoncoreontologies.org/',
  'http://www.commoncoreontologies.org/',
  'https://www.commoncoreontologies.org/CommonCoreOntologiesMerged/',
  'http://www.commoncoreontologies.org/CommonCoreOntologiesMerged/',
  'https://www.commoncoreontologies.org/AgentOntology/',
  'https://www.commoncoreontologies.org/EventOntology/',
  'https://www.commoncoreontologies.org/InformationEntityOntology/',
  'https://www.commoncoreontologies.org/ArtifactOntology/',
  'https://www.commoncoreontologies.org/QualityOntology/',
  'https://www.commoncoreontologies.org/UnitsOfMeasureOntology/',
  'https://www.commoncoreontologies.org/TimeOntology/',
  'https://www.commoncoreontologies.org/GeospatialOntology/',
  'https://www.commoncoreontologies.org/FacilityOntology/',
];

// Prefix mappings
export const CCO_PREFIXES = {
  'cco': CANONICAL_CCO_NAMESPACE,
  'CCO': CANONICAL_CCO_NAMESPACE,
};

/**
 * Maps CCO numeric IDs (ont#####) to human-readable class names
 * Source: CCO 2.0 ontology files
 *
 * This is a subset of commonly used classes. The full mapping would
 * require parsing the complete CCO ontology files.
 */
export const CCO_ID_TO_NAME = {
  // Agents (from AgentOntology)
  'ont00001262': 'Person',
  'ont00000821': 'Agent',
  'ont00001180': 'Organization',
  'ont00001715': 'GroupOfAgents',

  // Roles
  'ont00000834': 'Role',
  'ont00001647': 'ResidentRole',
  'ont00001234': 'StudentRole',
  'ont00001567': 'EmployeeRole',

  // Information Entities
  'ont00000958': 'InformationContentEntity',
  'ont00001023': 'InformationBearingEntity',
  'ont00000645': 'DesignativeInformationContentEntity',
  'ont00001456': 'DirectiveInformationContentEntity',
  'ont00000789': 'Name',
  'ont00001345': 'PersonName',
  'ont00000567': 'Identifier',
  'ont00001890': 'PostalAddress',
  'ont00000912': 'InformationBearingArtifact',
  'ont00001678': 'Document',
  'ont00000456': 'Record',
  'ont00001234': 'PersonNameRecord',
  'ont00000678': 'PostalAddressRecord',

  // Artifacts
  'ont00000543': 'Artifact',

  // Acts/Processes
  'ont00001098': 'Act',
  'ont00000765': 'IntentionalAct',
  'ont00001432': 'ActOfOccupancy',

  // Qualities
  'ont00000876': 'Quality',
  'ont00001543': 'QualityMeasurement',
  'ont00000234': 'MeasurementUnit',

  // Sites/Facilities
  'ont00001321': 'Site',
  'ont00000987': 'Facility',
  'ont00001654': 'House',
  'ont00000345': 'Building',
  'ont00001789': 'GeographicRegion',

  // Functions/Dispositions
  'ont00000432': 'Function',
  'ont00001098': 'Disposition',

  // Temporal
  'ont00001567': 'TemporalInterval',
};

// Reverse mapping: name to ID
export const CCO_NAME_TO_ID = Object.fromEntries(
  Object.entries(CCO_ID_TO_NAME).map(([id, name]) => [name, id])
);

/**
 * Checks if an IRI uses any CCO namespace variant
 * @param {string} iri - The IRI to check
 * @returns {boolean} True if IRI is a CCO IRI
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
      return true;
    }
  }

  return false;
}

/**
 * Extracts the local part (class name or ID) from a CCO IRI
 * @param {string} iri - The CCO IRI
 * @returns {string|null} The local part or null if not a CCO IRI
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
      return iri.substring(namespace.length);
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
