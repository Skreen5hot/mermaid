#!/usr/bin/env node

/**
 * CCO Class Extraction Script
 *
 * Extracts all CCO classes and predicates from CCO ontology TTL files
 * and generates JavaScript module with class mappings.
 *
 * Supports BOTH CCO versions:
 * - CCO 1.x: http://www.ontologyrepository.com/CommonCoreOntologies/ClassName
 * - CCO 2.0+: https://www.commoncoreontologies.org/ont##### with rdfs:label
 *
 * Primary source for numeric ID mappings:
 * - src/ontologies/iri-mapping-v2.0.csv (authoritative mapping from CCO project)
 *
 * Input:
 *   - src/ontologies/MergedAllCoreOntology-v1.5-2024-02-14.ttl (legacy, named classes)
 *   - src/ontologies/AgentOntology.ttl, EventOntology.ttl, etc. (CCO 2.0, numeric IDs)
 *   - src/ontologies/iri-mapping-v2.0.csv (numeric ID to class name mapping)
 *
 * Output: src/ontologies/cco-classes.generated.js
 *
 * Usage:
 *   node scripts/extract-cco-classes.js
 *   node scripts/extract-cco-classes.js --source path/to/ontology.ttl
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Parser, Store } from 'n3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Namespaces - support both CCO versions
const CCO_PREFIXES = [
  'http://www.ontologyrepository.com/CommonCoreOntologies/',  // CCO 1.x (legacy)
  'https://www.commoncoreontologies.org/',                    // CCO 2.0+
];
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const OWL_OBJECT_PROPERTY = 'http://www.w3.org/2002/07/owl#ObjectProperty';
const OWL_DATATYPE_PROPERTY = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const RDFS_SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

// Parse command line arguments
const args = process.argv.slice(2);
let sourceFiles = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--source' && args[i + 1]) {
    sourceFiles.push(args[i + 1]);
    i++;
  }
}

// Default: process both legacy merged file AND CCO 2.0 module files
if (sourceFiles.length === 0) {
  const ontologiesDir = path.join(__dirname, '../src/ontologies');

  // Legacy merged file (CCO 1.x with named classes)
  const legacyFile = path.join(ontologiesDir, 'MergedAllCoreOntology-v1.5-2024-02-14.ttl');
  if (fs.existsSync(legacyFile)) {
    sourceFiles.push(legacyFile);
  }

  // CCO 2.0 module files (with numeric IDs)
  const cco2Files = [
    'AgentOntology.ttl',
    'ArtifactOntology.ttl',
    'EventOntology.ttl',
    'ExtendedRelationOntology.ttl',
    'FacilityOntology.ttl',
    'GeospatialOntology.ttl',
    'InformationEntityOntology.ttl',
    'QualityOntology.ttl',
    'TimeOntology.ttl',
    'UnitsOfMeasureOntology.ttl',
    'CurrencyUnitOntology.ttl',
  ];

  for (const file of cco2Files) {
    const filePath = path.join(ontologiesDir, file);
    if (fs.existsSync(filePath)) {
      sourceFiles.push(filePath);
    }
  }
}

/**
 * Checks if an IRI belongs to CCO namespace
 */
function isCCOIri(iri) {
  return CCO_PREFIXES.some(prefix => iri.startsWith(prefix));
}

/**
 * Extracts local name from CCO IRI
 */
function getLocalName(iri) {
  for (const prefix of CCO_PREFIXES) {
    if (iri.startsWith(prefix)) {
      return iri.replace(prefix, '');
    }
  }
  return null;
}

/**
 * Clean a label to make it a valid identifier
 */
function cleanLabel(label, isClass = true) {
  const cleaned = label
    .replace(/@en$/, '')
    .trim();

  if (isClass) {
    // For classes: remove spaces, capitalize words (PascalCase)
    return cleaned.replace(/\s+/g, '');
  } else {
    // For predicates: use snake_case
    return cleaned.replace(/\s+/g, '_');
  }
}

/**
 * Load the IRI mapping CSV file to get authoritative numeric ID -> class name mappings
 * Format: old-iri,new-iri
 * Example: http://www.ontologyrepository.com/CommonCoreOntologies/ActOfEmployment,https://www.commoncoreontologies.org/ont00001226
 */
function loadIriMappingCsv(csvPath) {
  const mapping = new Map(); // numericId -> className

  if (!fs.existsSync(csvPath)) {
    console.warn(`  Warning: IRI mapping CSV not found at ${csvPath}`);
    return mapping;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i].trim();
    if (!line) continue;

    const [oldIri, newIri] = line.split(',');
    if (!oldIri || !newIri) continue;

    // Extract class name from old IRI (CCO 1.x format)
    const className = oldIri.replace('http://www.ontologyrepository.com/CommonCoreOntologies/', '');

    // Extract numeric ID from new IRI (CCO 2.0 format)
    const numericId = newIri.replace('https://www.commoncoreontologies.org/', '');

    if (className && numericId && /^ont\d+$/.test(numericId)) {
      mapping.set(numericId, className);
    }
  }

  return mapping;
}

console.log('CCO Class Extraction Script');
console.log('===========================\n');

// Load authoritative IRI mapping from CSV
const ontologiesDir = path.join(__dirname, '../src/ontologies');
const iriMappingPath = path.join(ontologiesDir, 'iri-mapping-v2.0.csv');
console.log('Loading IRI mapping CSV...');
const authoritativeMapping = loadIriMappingCsv(iriMappingPath);
console.log(`  Loaded ${authoritativeMapping.size} numeric ID -> class name mappings\n`);

if (sourceFiles.length === 0) {
  console.error('Error: No source files found');
  process.exit(1);
}

console.log(`Processing ${sourceFiles.length} ontology files:\n`);

// Merged data from all files
const allClasses = new Map(); // localName -> { iri, label, subClassOf, source }
const allPredicates = new Map(); // localName -> { iri, label, type, source }

// Process each file
for (const sourcePath of sourceFiles) {
  const fileName = path.basename(sourcePath);
  console.log(`  Processing: ${fileName}`);

  if (!fs.existsSync(sourcePath)) {
    console.warn(`    Warning: File not found, skipping`);
    continue;
  }

  const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
  console.log(`    Read ${(sourceContent.length / 1024).toFixed(1)}KB`);

  // Parse RDF
  const parser = new Parser();
  let quads;

  try {
    quads = parser.parse(sourceContent);
    console.log(`    Parsed ${quads.length} triples`);
  } catch (error) {
    console.warn(`    Parse error: ${error.message}, skipping`);
    continue;
  }

  // Load into store for querying
  const store = new Store();
  store.addQuads(quads);

  // Extract CCO classes
  let classCount = 0;
  const classQuads = store.getQuads(null, RDF_TYPE, OWL_CLASS, null);
  for (const quad of classQuads) {
    const iri = quad.subject.value;
    if (isCCOIri(iri)) {
      const localName = getLocalName(iri);

      // Get label
      const labelQuads = store.getQuads(iri, RDFS_LABEL, null, null);
      const label = labelQuads.length > 0
        ? labelQuads[0].object.value
        : localName;

      // Get superclass
      const subClassQuads = store.getQuads(iri, RDFS_SUBCLASS_OF, null, null);
      const subClassOf = subClassQuads
        .map(q => q.object.value)
        .filter(v => !v.startsWith('_:')); // Filter out blank nodes

      allClasses.set(localName, { iri, label, subClassOf, source: fileName });
      classCount++;
    }
  }

  // Extract CCO predicates (object properties and datatype properties)
  let predicateCount = 0;
  const objectPropertyQuads = store.getQuads(null, RDF_TYPE, OWL_OBJECT_PROPERTY, null);
  for (const quad of objectPropertyQuads) {
    const iri = quad.subject.value;
    if (isCCOIri(iri)) {
      const localName = getLocalName(iri);
      const labelQuads = store.getQuads(iri, RDFS_LABEL, null, null);
      const label = labelQuads.length > 0 ? labelQuads[0].object.value : localName;
      allPredicates.set(localName, { iri, label, type: 'ObjectProperty', source: fileName });
      predicateCount++;
    }
  }

  const datatypePropertyQuads = store.getQuads(null, RDF_TYPE, OWL_DATATYPE_PROPERTY, null);
  for (const quad of datatypePropertyQuads) {
    const iri = quad.subject.value;
    if (isCCOIri(iri)) {
      const localName = getLocalName(iri);
      const labelQuads = store.getQuads(iri, RDFS_LABEL, null, null);
      const label = labelQuads.length > 0 ? labelQuads[0].object.value : localName;
      allPredicates.set(localName, { iri, label, type: 'DatatypeProperty', source: fileName });
      predicateCount++;
    }
  }

  console.log(`    Found ${classCount} classes, ${predicateCount} predicates\n`);
}

console.log('Merging results...\n');
console.log(`Total unique classes: ${allClasses.size}`);
console.log(`Total unique predicates: ${allPredicates.size}\n`);

// Separate classes with numeric IDs (ont#####) from named classes
const numericIdClasses = new Map(); // ont##### -> className
const namedClasses = new Set(); // Set of class names (deduped)

for (const [localName, info] of allClasses) {
  if (/^ont\d+$/.test(localName)) {
    // This is a numeric ID - prefer authoritative mapping from CSV, fallback to label
    let className;
    if (authoritativeMapping.has(localName)) {
      className = authoritativeMapping.get(localName);
    } else {
      // Fallback: use the label (may have case issues)
      className = cleanLabel(info.label, true);
      console.warn(`  Warning: No authoritative mapping for ${localName}, using label: ${className}`);
    }
    numericIdClasses.set(localName, className);
    // Also add the class name to named classes for completeness
    namedClasses.add(className);
  } else {
    namedClasses.add(localName);
  }
}

// Also extract predicates with numeric IDs
const numericIdPredicates = new Map();
const namedPredicates = new Set();

for (const [localName, info] of allPredicates) {
  if (/^ont\d+$/.test(localName)) {
    const cleanedLabel = cleanLabel(info.label, false);
    numericIdPredicates.set(localName, cleanedLabel);
    namedPredicates.add(cleanedLabel);
  } else {
    namedPredicates.add(localName);
  }
}

// Sort arrays
const sortedNamedClasses = Array.from(namedClasses).sort();
const sortedNamedPredicates = Array.from(namedPredicates).sort();

// Generate output module
console.log('Generating output module...');

const timestamp = new Date().toISOString().split('T')[0];
const sourceFileList = sourceFiles.map(f => path.basename(f)).join(', ');

const moduleContent = `/**
 * CCO Classes and Predicates (Auto-Generated)
 *
 * This file is automatically generated by extract-cco-classes.js
 * DO NOT EDIT MANUALLY - regenerate with: node scripts/extract-cco-classes.js
 *
 * Sources: ${sourceFileList}
 * Generated: ${timestamp}
 * Total Classes: ${allClasses.size} (${namedClasses.size} named, ${numericIdClasses.size} numeric IDs)
 * Total Predicates: ${allPredicates.size} (${namedPredicates.size} named, ${numericIdPredicates.size} numeric IDs)
 */

/**
 * All CCO class names (human-readable identifiers)
 * Use this for vocabulary validation
 */
export const CCO_CLASS_NAMES = [
${sortedNamedClasses.map(c => `  '${c}',`).join('\n')}
];

/**
 * All CCO predicate names (human-readable identifiers)
 * Use this for vocabulary validation
 */
export const CCO_PREDICATE_NAMES = [
${sortedNamedPredicates.map(p => `  '${p}',`).join('\n')}
];

/**
 * Maps CCO numeric IDs to human-readable class names
 * Example: 'ont00001262' -> 'Person'
 */
export const CCO_ID_TO_CLASS_NAME = {
${Array.from(numericIdClasses.entries())
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([id, name]) => `  '${id}': '${name}',`)
  .join('\n')}
};

/**
 * Maps CCO numeric IDs to human-readable predicate names
 * Example: 'ont00000123' -> 'has_name'
 */
export const CCO_ID_TO_PREDICATE_NAME = {
${Array.from(numericIdPredicates.entries())
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([id, name]) => `  '${id}': '${name}',`)
  .join('\n')}
};

/**
 * Reverse mapping: class name to numeric ID
 */
export const CCO_CLASS_NAME_TO_ID = Object.fromEntries(
  Object.entries(CCO_ID_TO_CLASS_NAME).map(([id, name]) => [name, id])
);

/**
 * Reverse mapping: predicate name to numeric ID
 */
export const CCO_PREDICATE_NAME_TO_ID = Object.fromEntries(
  Object.entries(CCO_ID_TO_PREDICATE_NAME).map(([id, name]) => [name, id])
);

/**
 * Combined set of all valid CCO vocabulary terms (classes + predicates)
 * Includes both named terms and numeric IDs
 * Use this for quick vocabulary validation
 */
export const CCO_VOCABULARY = new Set([
  ...CCO_CLASS_NAMES,
  ...CCO_PREDICATE_NAMES,
  ...Object.keys(CCO_ID_TO_CLASS_NAME),
  ...Object.keys(CCO_ID_TO_PREDICATE_NAME),
]);

/**
 * Set of just CCO class names (for type checking)
 */
export const CCO_CLASS_SET = new Set([
  ...CCO_CLASS_NAMES,
  ...Object.keys(CCO_ID_TO_CLASS_NAME),
]);

/**
 * Set of just CCO predicate names (for type checking)
 */
export const CCO_PREDICATE_SET = new Set([
  ...CCO_PREDICATE_NAMES,
  ...Object.keys(CCO_ID_TO_PREDICATE_NAME),
]);

/**
 * Checks if a local name is a valid CCO vocabulary term
 * @param {string} localName - The local part of a CCO IRI
 * @returns {boolean} True if recognized
 */
export function isValidCCOTerm(localName) {
  return CCO_VOCABULARY.has(localName);
}

/**
 * Checks if a local name is a valid CCO class
 * @param {string} localName - The local part of a CCO IRI
 * @returns {boolean} True if it's a class
 */
export function isValidCCOClass(localName) {
  return CCO_CLASS_SET.has(localName);
}

/**
 * Checks if a local name is a valid CCO predicate
 * @param {string} localName - The local part of a CCO IRI
 * @returns {boolean} True if it's a predicate
 */
export function isValidCCOPredicate(localName) {
  return CCO_PREDICATE_SET.has(localName);
}

/**
 * Normalizes a CCO term (numeric ID to human-readable name)
 * @param {string} term - The term to normalize
 * @returns {string} Human-readable name or original if not found
 */
export function normalizeCCOTerm(term) {
  if (CCO_ID_TO_CLASS_NAME[term]) return CCO_ID_TO_CLASS_NAME[term];
  if (CCO_ID_TO_PREDICATE_NAME[term]) return CCO_ID_TO_PREDICATE_NAME[term];
  return term;
}

// Statistics
export const CCO_STATS = {
  totalClasses: ${allClasses.size},
  totalPredicates: ${allPredicates.size},
  namedClasses: ${namedClasses.size},
  numericIdClasses: ${numericIdClasses.size},
  namedPredicates: ${namedPredicates.size},
  numericIdPredicates: ${numericIdPredicates.size},
  sourceFiles: ${JSON.stringify(sourceFiles.map(f => path.basename(f)))},
  generatedDate: '${timestamp}',
};
`;

// Write output file
const outputPath = path.join(__dirname, '../src/ontologies/cco-classes.generated.js');
fs.writeFileSync(outputPath, moduleContent, 'utf-8');

console.log(`Wrote: ${outputPath}`);
console.log(`Size: ${(moduleContent.length / 1024).toFixed(1)}KB\n`);

// Summary
console.log('Extraction complete!');
console.log('====================');
console.log(`Classes:`);
console.log(`  - Named classes: ${namedClasses.size}`);
console.log(`  - Numeric ID classes: ${numericIdClasses.size}`);
console.log(`  - Total unique: ${allClasses.size}`);
console.log(`Predicates:`);
console.log(`  - Named predicates: ${namedPredicates.size}`);
console.log(`  - Numeric ID predicates: ${numericIdPredicates.size}`);
console.log(`  - Total unique: ${allPredicates.size}`);
console.log('');

// Print sample of classes for verification
console.log('Sample named classes (first 15):');
sortedNamedClasses.slice(0, 15).forEach(c => console.log(`  - ${c}`));
console.log('');

console.log('Sample numeric IDs (first 15):');
Array.from(numericIdClasses.entries()).slice(0, 15).forEach(([id, name]) => {
  console.log(`  - ${id} -> ${name}`);
});
console.log('');

// ============================================================================
// PART 2: Extract BFO Rooting (rdfs:subClassOf hierarchy)
// ============================================================================

console.log('\n--- BFO Rooting Extraction ---\n');

// Collect ALL subClassOf relationships from all files
const allSubClassOf = new Map(); // classIri -> Set of superclass IRIs

// Process each file again to extract subClassOf
for (const sourcePath of sourceFiles) {
  const fileName = path.basename(sourcePath);
  console.log(`  Extracting subClassOf from: ${fileName}`);

  const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
  const parser = new Parser();
  let quads;

  try {
    quads = parser.parse(sourceContent);
  } catch (error) {
    console.warn(`    Parse error: ${error.message}, skipping`);
    continue;
  }

  const store = new Store();
  store.addQuads(quads);

  // Extract all rdfs:subClassOf relationships
  const subClassQuads = store.getQuads(null, RDFS_SUBCLASS_OF, null, null);
  let subClassCount = 0;

  for (const quad of subClassQuads) {
    const subjectIri = quad.subject.value;
    const objectIri = quad.object.value;

    // Skip blank nodes
    if (subjectIri.startsWith('_:') || objectIri.startsWith('_:')) {
      continue;
    }

    // Only include CCO and BFO classes
    const isCCOSubject = isCCOIri(subjectIri);
    const isBFOSubject = subjectIri.startsWith('http://purl.obolibrary.org/obo/BFO_');
    const isCCOObject = isCCOIri(objectIri);
    const isBFOObject = objectIri.startsWith('http://purl.obolibrary.org/obo/BFO_');

    if ((isCCOSubject || isBFOSubject) && (isCCOObject || isBFOObject)) {
      if (!allSubClassOf.has(subjectIri)) {
        allSubClassOf.set(subjectIri, new Set());
      }
      allSubClassOf.get(subjectIri).add(objectIri);
      subClassCount++;
    }
  }

  console.log(`    Found ${subClassCount} subClassOf relationships`);
}

console.log(`\nTotal subClassOf relationships: ${allSubClassOf.size} classes\n`);

// Convert numeric IDs to human-readable names for the TTL output
function normalizeIriForTtl(iri) {
  // Extract local name from CCO IRI
  const localName = getLocalName(iri);
  if (localName) {
    // If it's a numeric ID, try to get the human-readable name
    if (/^ont\d+$/.test(localName) && authoritativeMapping.has(localName)) {
      return `cco:${authoritativeMapping.get(localName)}`;
    }
    return `cco:${localName}`;
  }

  // Handle BFO IRIs
  if (iri.startsWith('http://purl.obolibrary.org/obo/BFO_')) {
    const bfoId = iri.replace('http://purl.obolibrary.org/obo/', '');
    return `bfo:${bfoId}`;
  }

  // Return full IRI if we can't normalize
  return `<${iri}>`;
}

// Generate TTL content for BFO rooting
console.log('Generating BFO rooting TTL...');

let ttlLines = [];
ttlLines.push(`@prefix cco: <http://www.ontologyrepository.com/CommonCoreOntologies/>.`);
ttlLines.push(`@prefix bfo: <http://purl.obolibrary.org/obo/>.`);
ttlLines.push(`@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.`);
ttlLines.push(``);
ttlLines.push(`# Auto-generated CCO-to-BFO subClassOf hierarchy`);
ttlLines.push(`# Generated: ${timestamp}`);
ttlLines.push(`# Total classes with hierarchy: ${allSubClassOf.size}`);
ttlLines.push(``);

// Sort by class name for consistent output
const sortedEntries = Array.from(allSubClassOf.entries()).sort((a, b) => {
  const nameA = normalizeIriForTtl(a[0]);
  const nameB = normalizeIriForTtl(b[0]);
  return nameA.localeCompare(nameB);
});

for (const [subjectIri, superclasses] of sortedEntries) {
  const subjectTtl = normalizeIriForTtl(subjectIri);

  for (const superclassIri of superclasses) {
    const superclassTtl = normalizeIriForTtl(superclassIri);
    ttlLines.push(`${subjectTtl} rdfs:subClassOf ${superclassTtl}.`);
  }
}

const ttlContent = ttlLines.join('\n');

// Generate the JavaScript module for BFO mapping
const bfoMappingModule = `/**
 * CCO-to-BFO Mapping (Auto-Generated)
 *
 * This file is automatically generated by extract-cco-classes.js
 * DO NOT EDIT MANUALLY - regenerate with: node scripts/extract-cco-classes.js
 *
 * Contains rdfs:subClassOf relationships extracted from CCO ontology files.
 * Used by bfoValidator.js to verify that user-defined classes are rooted in BFO.
 *
 * Sources: ${sourceFileList}
 * Generated: ${timestamp}
 * Total classes with hierarchy: ${allSubClassOf.size}
 */

export const CCO_BFO_MAPPING = \`${ttlContent}\`;

/**
 * List of all CCO classes that have BFO rooting
 * (classes that have at least one rdfs:subClassOf relationship)
 */
export const CCO_CLASSES_WITH_BFO_ROOTING = [
${Array.from(allSubClassOf.keys())
  .map(iri => {
    const localName = getLocalName(iri);
    if (localName) {
      if (/^ont\d+$/.test(localName) && authoritativeMapping.has(localName)) {
        return `  '${authoritativeMapping.get(localName)}',`;
      }
      return `  '${localName}',`;
    }
    return null;
  })
  .filter(Boolean)
  .sort()
  .join('\n')}
];

/**
 * Helper to check if a class name has BFO rooting in the generated hierarchy
 */
export function hasBFORooting(className) {
  return CCO_CLASSES_WITH_BFO_ROOTING.includes(className);
}

// Statistics
export const BFO_MAPPING_STATS = {
  totalClassesWithHierarchy: ${allSubClassOf.size},
  sourceFiles: ${JSON.stringify(sourceFiles.map(f => path.basename(f)))},
  generatedDate: '${timestamp}',
};
`;

// Write BFO mapping output file
const bfoMappingOutputPath = path.join(__dirname, '../src/ontologies/cco-bfo-mapping.generated.js');
fs.writeFileSync(bfoMappingOutputPath, bfoMappingModule, 'utf-8');

console.log(`Wrote: ${bfoMappingOutputPath}`);
console.log(`Size: ${(bfoMappingModule.length / 1024).toFixed(1)}KB\n`);

// Summary
console.log('BFO Rooting Extraction complete!');
console.log('================================');
console.log(`Classes with BFO hierarchy: ${allSubClassOf.size}`);
console.log('');

// Print sample for verification
console.log('Sample subClassOf relationships (first 15):');
let sampleCount = 0;
for (const [subjectIri, superclasses] of sortedEntries) {
  if (sampleCount >= 15) break;
  const subjectTtl = normalizeIriForTtl(subjectIri);
  for (const superclassIri of superclasses) {
    if (sampleCount >= 15) break;
    const superclassTtl = normalizeIriForTtl(superclassIri);
    console.log(`  ${subjectTtl} rdfs:subClassOf ${superclassTtl}`);
    sampleCount++;
  }
}
console.log('');

console.log('Next steps:');
console.log('  1. Update cco-bfo-mapping.ttl.js to import from cco-bfo-mapping.generated.js');
console.log('  2. Run tests: npm test');
console.log('');
