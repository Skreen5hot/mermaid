/**
 * CCO-to-BFO Mapping
 *
 * This file provides rdfs:subClassOf relationships between CCO classes and BFO
 * for rooting validation. The mapping is auto-generated from CCO ontology files.
 *
 * Regenerate with: node scripts/extract-cco-classes.js
 *
 * Source: Auto-generated from CCO 2.0 ontology files + legacy merged ontology
 * License: BSD-3-Clause (CCO) + CC-BY 4.0 (BFO)
 */

// Import auto-generated BFO mapping
import {
  CCO_BFO_MAPPING as GENERATED_CCO_BFO_MAPPING,
  CCO_CLASSES_WITH_BFO_ROOTING as GENERATED_CCO_CLASSES_WITH_BFO_ROOTING,
  hasBFORooting as generatedHasBFORooting,
  BFO_MAPPING_STATS,
} from './cco-bfo-mapping.generated.js';

// Re-export the generated mapping
export const CCO_BFO_MAPPING = GENERATED_CCO_BFO_MAPPING;

/**
 * Helper to check if an IRI is a CCO class
 */
export function isCCOClass(iri) {
  return iri.includes('CommonCoreOntologies');
}

/**
 * Helper to check if a class name has BFO rooting
 * @param {string} className - The class name to check
 * @returns {boolean} True if the class has BFO rooting
 */
export function hasBFORooting(className) {
  return generatedHasBFORooting(className);
}

/**
 * List of CCO classes that have BFO rooting (auto-generated)
 * Use this for validation to check if a class is supported
 */
export const SUPPORTED_CCO_CLASSES = GENERATED_CCO_CLASSES_WITH_BFO_ROOTING;

// Export stats for debugging
export { BFO_MAPPING_STATS };
