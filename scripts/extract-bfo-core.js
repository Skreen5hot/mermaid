#!/usr/bin/env node

/**
 * BFO Core Extraction Script
 *
 * Extracts essential BFO hierarchy from full bfo-core.ttl
 * for use in OntoGrade rooting validation.
 *
 * Input: src/ontologies/bfo-core.ttl (107KB)
 * Output: src/ontologies/bfo-core.ttl.js (~50KB ES6 module)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Parser, Writer, Store } from 'n3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Essential BFO classes for rooting validation
const ESSENTIAL_CLASSES = [
  'BFO_0000001', // entity
  'BFO_0000002', // continuant
  'BFO_0000003', // occurrent
  'BFO_0000004', // independent continuant
  'BFO_0000006', // spatial region
  'BFO_0000015', // process
  'BFO_0000016', // disposition
  'BFO_0000017', // realizable entity
  'BFO_0000019', // quality
  'BFO_0000020', // specifically dependent continuant
  'BFO_0000023', // role
  'BFO_0000024', // fiat object part
  'BFO_0000027', // object aggregate
  'BFO_0000028', // three-dimensional spatial region
  'BFO_0000029', // site
  'BFO_0000030', // object
  'BFO_0000031', // generically dependent continuant
  'BFO_0000034', // function
  'BFO_0000040', // material entity
  'BFO_0000141', // immaterial entity
];

const BFO_PREFIX = 'http://purl.obolibrary.org/obo/';

console.log('🔍 BFO Core Extraction Script');
console.log('============================\n');

// Read source ontology
const sourcePath = path.join(__dirname, '../src/ontologies/bfo-core.ttl');
console.log(`📖 Reading: ${sourcePath}`);

if (!fs.existsSync(sourcePath)) {
  console.error(`❌ Error: Source file not found at ${sourcePath}`);
  process.exit(1);
}

const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
console.log(`✓ Read ${(sourceContent.length / 1024).toFixed(1)}KB\n`);

// Parse RDF
console.log('⚙️  Parsing RDF...');
const parser = new Parser();
let allQuads;

try {
  allQuads = parser.parse(sourceContent);
  console.log(`✓ Parsed ${allQuads.length} triples\n`);
} catch (error) {
  console.error(`❌ Parse error: ${error.message}`);
  process.exit(1);
}

// Filter to essential classes and their properties
console.log('🔎 Filtering to essential classes...');
const filteredStore = new Store();

// Helper to check if a term is essential
function isEssentialTerm(iri) {
  if (!iri) return false;
  const termId = iri.replace(BFO_PREFIX, '');
  return ESSENTIAL_CLASSES.includes(termId);
}

// Helper to check if we should include this quad
function shouldInclude(quad) {
  const subject = quad.subject.value;
  const predicate = quad.predicate.value;
  const object = quad.object.value;

  // Include if subject is an essential class
  if (isEssentialTerm(subject)) {
    // Always include type, label, subClassOf, and definition
    if (
      predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' ||
      predicate === 'http://www.w3.org/2000/01/rdf-schema#label' ||
      predicate === 'http://www.w3.org/2000/01/rdf-schema#subClassOf' ||
      predicate === 'http://www.w3.org/2004/02/skos/core#definition' ||
      predicate === 'http://purl.org/dc/elements/1.1/identifier'
    ) {
      return true;
    }
  }

  // Include ontology metadata
  if (subject.includes('bfo.owl')) {
    if (
      predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' ||
      predicate === 'http://www.w3.org/2002/07/owl#versionIRI' ||
      predicate === 'http://purl.org/dc/terms/description' ||
      predicate === 'http://purl.org/dc/terms/license' ||
      predicate === 'http://purl.org/dc/terms/title' ||
      predicate === 'http://www.w3.org/2000/01/rdf-schema#comment'
    ) {
      return true;
    }
  }

  return false;
}

// Filter quads
let includedCount = 0;
for (const quad of allQuads) {
  if (shouldInclude(quad)) {
    filteredStore.addQuad(quad);
    includedCount++;
  }
}

console.log(`✓ Included ${includedCount} triples (${((includedCount / allQuads.length) * 100).toFixed(1)}%)\n`);

// Check we got all essential classes
console.log('✓ Essential classes included:');
for (const classId of ESSENTIAL_CLASSES) {
  const classIri = BFO_PREFIX + classId;
  const quads = filteredStore.getQuads(classIri, null, null, null);
  if (quads.length > 0) {
    const label = filteredStore.getQuads(
      classIri,
      'http://www.w3.org/2000/01/rdf-schema#label',
      null,
      null
    )[0]?.object.value || classId;
    console.log(`  • ${classId}: ${label}`);
  } else {
    console.warn(`  ⚠️  ${classId}: NOT FOUND`);
  }
}
console.log('');

// Serialize to Turtle
console.log('📝 Serializing to Turtle...');
const writer = new Writer({ prefixes: {
  '': 'http://purl.obolibrary.org/obo/bfo#',
  'bfo': 'http://purl.obolibrary.org/obo/',
  'dc': 'http://purl.org/dc/terms/',
  'dc11': 'http://purl.org/dc/elements/1.1/',
  'owl': 'http://www.w3.org/2002/07/owl#',
  'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
  'skos': 'http://www.w3.org/2004/02/skos/core#',
}});

writer.addQuads(filteredStore.getQuads(null, null, null, null));
let turtleContent;

writer.end((error, result) => {
  if (error) {
    console.error(`❌ Serialization error: ${error.message}`);
    process.exit(1);
  }
  turtleContent = result;
});

console.log(`✓ Serialized ${(turtleContent.length / 1024).toFixed(1)}KB\n`);

// Wrap in ES6 module
console.log('📦 Creating ES6 module...');
const moduleContent = `/**
 * BFO Core Ontology (Minimal Subset for OntoGrade)
 *
 * This is an automatically extracted subset of BFO 2020 containing only
 * the essential class hierarchy needed for rooting validation.
 *
 * Source: src/ontologies/bfo-core.ttl
 * Extracted: ${new Date().toISOString().split('T')[0]}
 * Version: BFO 2020
 * License: CC-BY 4.0
 *
 * Essential classes included:
${ESSENTIAL_CLASSES.map(id => ` *   - ${id}`).join('\n')}
 *
 * DO NOT EDIT THIS FILE MANUALLY
 * Regenerate with: node scripts/extract-bfo-core.js
 */

export const BFO_CORE = \`${turtleContent.replace(/`/g, '\\`')}\`;

// Class labels for user-friendly messages
export const BFO_LABELS = {
  'BFO_0000001': 'entity',
  'BFO_0000002': 'continuant',
  'BFO_0000003': 'occurrent',
  'BFO_0000004': 'independent continuant',
  'BFO_0000006': 'spatial region',
  'BFO_0000015': 'process',
  'BFO_0000016': 'disposition',
  'BFO_0000017': 'realizable entity',
  'BFO_0000019': 'quality',
  'BFO_0000020': 'specifically dependent continuant',
  'BFO_0000023': 'role',
  'BFO_0000024': 'fiat object part',
  'BFO_0000027': 'object aggregate',
  'BFO_0000028': 'three-dimensional spatial region',
  'BFO_0000029': 'site',
  'BFO_0000030': 'object',
  'BFO_0000031': 'generically dependent continuant',
  'BFO_0000034': 'function',
  'BFO_0000040': 'material entity',
  'BFO_0000141': 'immaterial entity',
};

// Helper to get full IRI
export function getBFOIri(classId) {
  return 'http://purl.obolibrary.org/obo/' + classId;
}
`;

// Write output file
const outputPath = path.join(__dirname, '../src/ontologies/bfo-core.ttl.js');
fs.writeFileSync(outputPath, moduleContent, 'utf-8');

console.log(`✓ Wrote: ${outputPath}`);
console.log(`✓ Size: ${(moduleContent.length / 1024).toFixed(1)}KB\n`);

// Summary
console.log('✅ Extraction complete!');
console.log('========================');
console.log(`Original: ${(sourceContent.length / 1024).toFixed(1)}KB (${allQuads.length} triples)`);
console.log(`Extracted: ${(moduleContent.length / 1024).toFixed(1)}KB (${includedCount} triples)`);
console.log(`Reduction: ${((1 - moduleContent.length / sourceContent.length) * 100).toFixed(1)}%\n`);

console.log('📋 Next steps:');
console.log('  1. Import in bfoValidator.js:');
console.log('     import { BFO_CORE } from "../../ontologies/bfo-core.ttl.js";');
console.log('  2. Parse and load into N3 Store');
console.log('  3. Implement path-finding to bfo:Entity');
console.log('');
