# OntoGrade Ontology Inventory

**Date:** January 8, 2026
**Status:** ✅ Complete - All source ontologies in place

---

## Summary

**Total Files:** 14 source ontologies + 1 mapping file = **15 files**
**Total Size:** ~3MB uncompressed, ~550KB gzipped
**Location:** `src/ontologies/`

---

## File Inventory

### BFO (Basic Formal Ontology)

| File | Size | Description |
|------|------|-------------|
| `bfo-core.ttl` | 107KB | BFO 2020 core hierarchy |

**Purpose:** Upper ontology for rooting validation (Iteration 2)

---

### CCO Version 1.5 (Legacy)

| File | Size | Description |
|------|------|-------------|
| `MergedAllCoreOntology-v1.5-2024-02-14.ttl` | 1.4MB | Complete CCO 1.5 merged file |

**Purpose:** Support for legacy CCO 1.5 models
**Date:** February 14, 2024

---

### CCO Version 2.0 (Current - Modular)

| File | Size | Description |
|------|------|-------------|
| `AgentOntology.ttl` | 138KB | Agents, persons, organizations, roles |
| `ArtifactOntology.ttl` | 341KB | Artifacts, manufactured objects, systems |
| `EventOntology.ttl` | 205KB | Events, processes, acts, occurrents |
| `InformationEntityOntology.ttl` | 172KB | ICEs, IBEs, information bearers |
| `FacilityOntology.ttl` | 52KB | Facilities, buildings, sites |
| `GeospatialOntology.ttl` | 47KB | Geospatial regions, coordinates |
| `QualityOntology.ttl` | 60KB | Qualities, attributes, characteristics |
| `TimeOntology.ttl` | 44KB | Temporal entities, intervals, instants |
| `UnitsOfMeasureOntology.ttl` | 73KB | Measurement units, dimensions |
| `CurrencyUnitOntology.ttl` | 42KB | Currency units, monetary values |
| `ExtendedRelationOntology.ttl` | 35KB | Additional object/data properties |

**Total CCO 2.0:** ~1.2MB
**Purpose:** Current CCO pattern validation (Iteration 3)

---

### Version Mapping

| File | Size | Description |
|------|------|-------------|
| `iri-mapping-v2.0.csv` | 242KB | CCO 1.5 → 2.0 IRI mappings |

**Purpose:** Support both CCO versions, migration assistance
**Format:** CSV with columns: Old IRI, New IRI, Change Type, Notes

---

## Usage Strategy

### Iteration 2: BFO Rooting Validation

**Use:** `bfo-core.ttl`

**Extract to:** `bfo-core.ttl.js` (~50KB)

**Extract contents:**
```turtle
# Essential BFO hierarchy for path validation
bfo:BFO_0000001  # Entity
bfo:BFO_0000002  # Continuant
bfo:BFO_0000004  # IndependentContinuant
bfo:BFO_0000020  # SpecificallyDependentContinuant
bfo:BFO_0000023  # Role
bfo:BFO_0000003  # Occurrent
bfo:BFO_0000015  # Process

# Plus subClassOf relations for path traversal
```

---

### Iteration 3: CCO Pattern Validation

**Use:** CCO 2.0 modular files (focus on key modules)

**Extract to:** `cco-subset.ttl.js` (~200KB)

**Key modules to extract from:**
1. **ExtendedRelationOntology.ttl** - Core relations
   - `is_bearer_of`
   - `realizes`
   - `is_designated_by`
   - `is_concretized_by`
   - `has_text_value`
   - `designates`

2. **InformationEntityOntology.ttl** - ICE/IBE patterns
   - `InformationContentEntity`
   - `InformationBearingEntity`
   - Information Staircase validation

3. **AgentOntology.ttl** - Role Pattern
   - `Role`
   - `Disposition`
   - `RealizableEntity`

4. **ArtifactOntology.ttl** - Common artifacts
   - Domain/range constraints for validation

**Extract contents:**
```turtle
# Core CCO relations with domain/range constraints
cco:is_bearer_of a owl:ObjectProperty ;
    rdfs:domain bfo:IndependentContinuant ;
    rdfs:range bfo:Role .

cco:is_designated_by a owl:ObjectProperty ;
    rdfs:domain owl:Thing ;
    rdfs:range cco:InformationContentEntity .

# Plus essential classes for pattern validation
```

---

### Version Support Strategy

**Default:** CCO 2.0 (current)

**Legacy Support:** Use `iri-mapping-v2.0.csv` to translate

**Implementation:**
```javascript
// Load CCO 2.0 subset
import { CCO_SUBSET } from '../../ontologies/cco-subset.ttl.js';

// Load IRI mapping for CCO 1.5 support
import { CCO_IRI_MAPPING } from '../../ontologies/cco-iri-mapping.js';

// Validator can translate CCO 1.5 IRIs → 2.0 on the fly
if (iri.includes('v1.5') || isCCO15Format(iri)) {
  iri = CCO_IRI_MAPPING.translate(iri);
}
```

---

## Extraction Scripts (To Be Created)

### Iteration 2: BFO Extraction

```javascript
// scripts/extract-bfo-core.js
import { Parser, Store } from 'n3';
import fs from 'fs';

const bfoSource = fs.readFileSync('src/ontologies/bfo-core.ttl', 'utf-8');
const parser = new Parser();
const quads = parser.parse(bfoSource);

// Filter to essential hierarchy
const essentialTerms = [
  'BFO_0000001', // Entity
  'BFO_0000002', // Continuant
  'BFO_0000004', // IndependentContinuant
  'BFO_0000020', // SpecificallyDependentContinuant
  'BFO_0000023', // Role
  'BFO_0000003', // Occurrent
  'BFO_0000015', // Process
];

const filtered = quads.filter(q =>
  essentialTerms.some(term => q.subject.value.includes(term))
);

// Write as ES6 module
const output = `export const BFO_CORE = \`${serialize(filtered)}\`;`;
fs.writeFileSync('src/ontologies/bfo-core.ttl.js', output);
```

### Iteration 3: CCO Extraction

```javascript
// scripts/extract-cco-subset.js
import { Parser, Store } from 'n3';
import fs from 'fs';

const ccoModules = [
  'ExtendedRelationOntology.ttl',
  'InformationEntityOntology.ttl',
  'AgentOntology.ttl'
];

const store = new Store();

// Load relevant modules
for (const module of ccoModules) {
  const source = fs.readFileSync(`src/ontologies/${module}`, 'utf-8');
  const parser = new Parser();
  const quads = parser.parse(source);
  store.addQuads(quads);
}

// Filter to essential properties and classes
const essentialProperties = [
  'is_bearer_of',
  'realizes',
  'is_designated_by',
  'is_concretized_by',
  'has_text_value',
  'designates'
];

// ... filter and write
```

---

## .gitignore Strategy

**Include in Git:**
- ✅ All source ontologies (bfo-core.ttl, CCO files, mapping)
- ✅ Extracted subsets (bfo-core.ttl.js, cco-subset.ttl.js)

**Rationale:**
- Reproducibility: Exact versions we validated against
- Offline development: No need to re-download
- Small enough: ~3MB total is acceptable

**See:** `.gitignore` in this directory for configuration

---

## License Compliance

### BFO
- **License:** CC-BY 4.0
- **Attribution:** Barry Smith, et al.
- **URL:** https://creativecommons.org/licenses/by/4.0/
- **Required:** Attribution in documentation

### CCO
- **License:** BSD-3-Clause
- **Copyright:** CUBRC, Inc.
- **Repository:** https://github.com/CommonCoreOntology/CommonCoreOntologies
- **Required:** Include license text in distribution

**Our Compliance:**
- ✅ Attribution in README.md
- ✅ License text in this document
- ✅ Source URLs documented
- ✅ No modifications to source (extracts only)

---

## Validation Checklist

Before using in Iteration 2:

- [x] BFO 2020 source present (bfo-core.ttl)
- [x] CCO 1.5 source present (MergedAllCoreOntology-v1.5.ttl)
- [x] CCO 2.0 modules present (11 files)
- [x] IRI mapping present (iri-mapping-v2.0.csv)
- [x] Files in correct location (src/ontologies/)
- [ ] Extraction script created (Iteration 2)
- [ ] bfo-core.ttl.js generated (Iteration 2)
- [ ] Unit tests for ontology loading (Iteration 2)

---

## File Checksums (for Integrity)

```bash
# Generate checksums for verification
cd src/ontologies
sha256sum bfo-core.ttl > checksums.txt
sha256sum MergedAllCoreOntology-v1.5-2024-02-14.ttl >> checksums.txt
sha256sum *.ttl >> checksums.txt
sha256sum iri-mapping-v2.0.csv >> checksums.txt
```

**Purpose:** Verify files haven't been corrupted or tampered with

---

## References

- **BFO Official:** http://basic-formal-ontology.org/
- **BFO OBO:** http://purl.obolibrary.org/obo/bfo.owl
- **CCO GitHub:** https://github.com/CommonCoreOntology/CommonCoreOntologies
- **CCO Documentation:** https://www.commoncoreontologies.org/

---

**Status:** ✅ All source ontologies ready for extraction
**Next Step:** Create extraction scripts in Iteration 2
**Last Updated:** January 8, 2026
