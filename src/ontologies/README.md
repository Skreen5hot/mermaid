# OntoGrade Reference Ontologies

**Purpose:** Store reference ontologies for client-side validation in OntoGrade

---

## Directory Contents

### Source Ontologies (Full)
These are the complete reference ontologies downloaded from official sources:

#### BFO (Basic Formal Ontology)
- **`bfo-core.ttl`** - BFO 2020 Core (107KB)
  - Source: http://purl.obolibrary.org/obo/bfo.owl
  - Format: Turtle (TTL)
  - License: CC-BY 4.0
  - Used for: BFO rooting validation (Iteration 2)

#### CCO Version 1.5 (Legacy)
- **`MergedAllCoreOntology-v1.5-2024-02-14.ttl`** - CCO 1.5 Complete (1.4MB)
  - Source: https://github.com/CommonCoreOntology/CommonCoreOntologies
  - Date: 2024-02-14
  - Format: Turtle (TTL)
  - License: BSD-3-Clause
  - Used for: Legacy CCO pattern validation

#### CCO Version 2.0 (Current) - Modular Files
- **`AgentOntology.ttl`** (138KB) - Agent-related entities and roles
- **`ArtifactOntology.ttl`** (341KB) - Artifacts and manufactured objects
- **`EventOntology.ttl`** (205KB) - Events, processes, and occurrents
- **`InformationEntityOntology.ttl`** (172KB) - ICEs and information content
- **`FacilityOntology.ttl`** (52KB) - Facilities and sites
- **`GeospatialOntology.ttl`** (47KB) - Geospatial entities
- **`QualityOntology.ttl`** (60KB) - Qualities and attributes
- **`TimeOntology.ttl`** (44KB) - Temporal entities and relations
- **`UnitsOfMeasureOntology.ttl`** (73KB) - Measurement units
- **`CurrencyUnitOntology.ttl`** (42KB) - Currency-related entities
- **`ExtendedRelationOntology.ttl`** (35KB) - Additional relations

**Total CCO 2.0 Size:** ~1.2MB
**Source:** https://github.com/CommonCoreOntology/CommonCoreOntologies
**License:** BSD-3-Clause
**Used for:** Current CCO pattern validation (Iteration 3)

#### Version Mapping
- **`iri-mapping-v2.0.csv`** - CCO 1.5 → 2.0 IRI Mapping (242KB)
  - Format: CSV
  - Provides mappings between CCO 1.5 and CCO 2.0 IRIs
  - Used for: Supporting both CCO versions, migration assistance
  - Columns: Old IRI, New IRI, Change Type, Notes

### Extracted Subsets (ES6 Modules)
These are minimal extracts optimized for browser loading:

- **`bfo-core.ttl.js`** - BFO hierarchy subset (~50KB)
  - Contains: Entity → Continuant → IndependentContinuant, etc.
  - Used by: `bfoValidator.js`
  - Created in: Iteration 2

- **`cco-subset.ttl.js`** - CCO properties subset (~200KB)
  - Contains: is_bearer_of, realizes, is_designated_by, etc.
  - Used by: `ccoValidator.js`
  - Created in: Iteration 3

---

## Adding Ontologies

### Step 1: Download BFO 2020
```bash
# Download from OBO
curl -o src/ontologies/bfo-2020.ttl http://purl.obolibrary.org/obo/bfo.owl

# Or download manually and save as bfo-2020.ttl
```

### Step 2: Download CCO
```bash
# Clone CCO repository
git clone https://github.com/CommonCoreOntology/CommonCoreOntologies.git temp-cco

# Merge all CCO modules into single file (or use specific modules)
# Then move to src/ontologies/cco.ttl
```

### Step 3: Extract Minimal Subsets
We'll create extraction scripts in Iteration 2 to generate the `.ttl.js` files:

```bash
# Future: Extract BFO core
node scripts/extract-bfo-core.js

# Future: Extract CCO subset
node scripts/extract-cco-subset.js
```

---

## File Formats

### Source Files (.ttl)
Standard Turtle format:
```turtle
@prefix bfo: <http://purl.obolibrary.org/obo/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

bfo:BFO_0000001 a owl:Class ;
    rdfs:label "entity" .
```

### ES6 Modules (.ttl.js)
Turtle wrapped in JavaScript export:
```javascript
/**
 * BFO Core Ontology (Minimal Subset for OntoGrade)
 *
 * Source: bfo-2020.ttl
 * Extracted: 2026-01-08
 * Version: 2020-01-01
 */
export const BFO_CORE = `
@prefix bfo: <http://purl.obolibrary.org/obo/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

bfo:BFO_0000001 a owl:Class ;
    rdfs:label "entity" .

# ... minimal hierarchy
`;
```

---

## Version Control

### .gitignore Strategy
```gitignore
# Include extracted subsets (small, hand-curated)
!src/ontologies/bfo-core.ttl.js
!src/ontologies/cco-subset.ttl.js

# Optionally exclude full source files (large, can re-download)
# src/ontologies/bfo-2020.ttl
# src/ontologies/cco.ttl
```

**Recommendation:** Include full source files in git for reproducibility, but note they're large.

---

## Build Integration

The extracted `.ttl.js` files are imported like normal ES6 modules:

```javascript
// src/concepts/ontograde/bfoValidator.js
import { BFO_CORE } from '../../ontologies/bfo-core.ttl.js';
import { Parser, Store } from 'n3';

const parser = new Parser();
const quads = parser.parse(BFO_CORE);
const store = new Store(quads);
// Ready for validation!
```

No special build steps needed - they're just JavaScript files.

---

## Update Process

When BFO or CCO releases a new version:

1. Download new source files to this directory
2. Re-run extraction scripts (Iteration 2+)
3. Review changes in extracted subsets
4. Run test suite to ensure compatibility
5. Commit updated files
6. Update version numbers in documentation

---

## Licenses

### BFO 2020
- **License:** CC-BY 4.0
- **Attribution:** Barry Smith, et al.
- **URL:** https://creativecommons.org/licenses/by/4.0/

### CCO
- **License:** BSD-3-Clause
- **Repository:** https://github.com/CommonCoreOntology/CommonCoreOntologies
- **Copyright:** CUBRC, Inc.

Both licenses permit:
- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use

---

## Size Estimates

| File | Format | Size (Uncompressed) | Size (Gzipped) |
|------|--------|---------------------|----------------|
| **Source Ontologies** |
| bfo-core.ttl | Turtle | 107KB | ~30KB |
| MergedAllCoreOntology-v1.5.ttl | Turtle | 1.4MB | ~250KB |
| CCO 2.0 (all modules) | Turtle | 1.2MB | ~220KB |
| iri-mapping-v2.0.csv | CSV | 242KB | ~50KB |
| **Total Source** | | **~3MB** | **~550KB** |
| **Extracted Subsets** |
| bfo-core.ttl.js | ES6 Module | ~50KB | ~15KB |
| cco-subset.ttl.js | ES6 Module | ~200KB | ~60KB |
| **Total Extracted** | | **~250KB** | **~75KB** |

**Deployed Bundle Impact:** +250KB uncompressed, +75KB gzipped (extracted subsets only)
**Source files NOT deployed** - only used during development for extraction

---

## Next Steps

### Iteration 2: BFO Rooting Validation
1. ✅ Download bfo-2020.ttl (you're doing this now)
2. Create extraction script to generate bfo-core.ttl.js
3. Import in bfoValidator.js
4. Implement rooting checks

### Iteration 3: CCO Pattern Validation
1. ✅ Download cco.ttl (you're doing this now)
2. Create extraction script to generate cco-subset.ttl.js
3. Import in ccoValidator.js
4. Implement SHACL validation

---

## Testing

Verify ontologies load correctly:
```javascript
// unit-tests/ontologies/bfo-core.test.js
import { BFO_CORE } from '../../src/ontologies/bfo-core.ttl.js';
import { Parser } from 'n3';

test('BFO_CORE loads and parses', () => {
  const parser = new Parser();
  const quads = parser.parse(BFO_CORE);
  expect(quads.length).toBeGreaterThan(0);
});

test('BFO_CORE contains Entity', () => {
  const parser = new Parser();
  const quads = parser.parse(BFO_CORE);
  const entityQuads = quads.filter(q =>
    q.subject.value.includes('BFO_0000001') // Entity
  );
  expect(entityQuads.length).toBeGreaterThan(0);
});
```

---

**Status:** Directory created, ready for ontology files
**Next:** Place bfo-2020.ttl and cco.ttl here, then we'll extract subsets in Iteration 2
