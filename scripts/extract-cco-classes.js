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
 * Input:
 *   - src/ontologies/MergedAllCoreOntology-v1.5-2024-02-14.ttl (legacy, named classes)
 *   - src/ontologies/AgentOntology.ttl, EventOntology.ttl, etc. (CCO 2.0, numeric IDs)
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

console.log('CCO Class Extraction Script');
console.log('===========================\n');

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
    // This is a numeric ID - use the label as the human-readable name
    const cleanedLabel = cleanLabel(info.label, true);
    numericIdClasses.set(localName, cleanedLabel);
    // Also add the cleaned label to named classes for completeness
    namedClasses.add(cleanedLabel);
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

console.log('Next steps:');
console.log('  1. Update cco-iri-normalizer.js to import from cco-classes.generated.js');
console.log('  2. Update shaclValidator.js to use isValidCCOClass/isValidCCOPredicate');
console.log('  3. Run tests: npm test');
console.log('');
