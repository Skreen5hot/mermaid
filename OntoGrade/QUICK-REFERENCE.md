# OntoGrade Quick Reference

**Last Updated:** January 8, 2026

---

## Project Status

| Iteration | Status | Description |
|-----------|--------|-------------|
| **Iteration 1** | ✅ **COMPLETE** | Ingestion & Lifting (Mermaid → RDF) |
| **Iteration 2** | ⏳ Ready to Start | BFO Rooting Validation |
| Iteration 3 | 📋 Planned | CCO Pattern Validation (SHACL) |
| Iteration 4 | 📋 Planned | Logical Integrity (Reasoning) |
| Iteration 5 | 📋 Planned | Scoring & UI Integration |

---

## Key Files

### Working Code
- `src/concepts/ontograde/mermaidLifter.js` - Parses Mermaid → RDF ✅
- `src/synchronizations.js` - Lines 994-1063 (OntoGrade sync rules) ✅
- `src/concepts/uiConcept.js` - Line 475-478 (OntoGrade button) ✅
- `unit-tests/concepts/ontograde/mermaidLifter.test.js` - 24 tests passing ✅

### Ontologies
- `src/ontologies/bfo-core.ttl` - BFO 2020 (107KB) ✅
- `src/ontologies/MergedAllCoreOntology-v1.5-2024-02-14.ttl` - CCO 1.5 (1.4MB) ✅
- `src/ontologies/*.ttl` - CCO 2.0 modules (11 files, 1.2MB total) ✅
- `src/ontologies/iri-mapping-v2.0.csv` - Version mapping (242KB) ✅

### Test Fixtures
- `unit-tests/fixtures/ontograde/person_pass.mmd` - Perfect model (34 triples) ✅
- `unit-tests/fixtures/ontograde/person_fail.mmd` - 7 deliberate errors ✅
- `unit-tests/fixtures/ontograde/valid-simple.mmd` - Basic test ✅
- `unit-tests/fixtures/ontograde/valid-complex.mmd` - Multi-pattern test ✅
- `unit-tests/fixtures/ontograde/invalid-*.mmd` - Error cases ✅

### Documentation
- `OntoGrade/functionalRequirements.md` - FRD v2.1
- `OntoGrade/OntoGradeProjectPlan.md` - 5 iteration plan
- `OntoGrade/developmentGuide.md` - Implementation guide
- `OntoGrade/FINAL-STATUS.md` - Iteration 1 completion report
- `OntoGrade/ONTOLOGY-STORAGE-ANALYSIS.md` - Storage strategy decision
- `OntoGrade/ONTOLOGIES-READY.md` - Ontology setup status
- `src/ontologies/README.md` - Ontology directory docs
- `src/ontologies/INVENTORY.md` - Complete file listing

---

## Quick Commands

### Run Tests
```bash
npm test
# All 24 OntoGrade tests should pass
```

### Build for Deployment
```bash
npm run build
# Outputs to dist/ (~315KB)
```

### Test Locally
```bash
npx serve
# Open http://localhost:3000
# Load person_pass.mmd
# Click "🎓 OntoGrade" button
```

### Test Deployed Version
```
https://skreen5hot.github.io/mermaid/dev/
# Should work identically to local
```

---

## Expected Console Output

When clicking "🎓 OntoGrade" with person_pass.mmd loaded:

```
[UI] OntoGrade button clicked
[Sync] OntoGrade evaluation requested
[mermaidLifter] Lifting diagram 5...
[Sync] Diagram lifted successfully: 5
[Sync] RDF Graph size: 34 triples
```

**Notification:** "OntoGrade: Diagram parsed successfully. Found 34 RDF triples."

---

## Architecture Principles

### Concepts + Synchronizations
```javascript
// Concepts: Independent modules with state and actions
export const mermaidLifter = {
  state: { rdfGraphs: new Map() },
  actions: { liftDiagram() { /*...*/ } }
};

// Synchronizations: Declarative event wiring
{
  when: 'diagramLifted',
  from: mermaidLifter,
  do: ({ rdfGraph }) => { /* validate */ }
}
```

### Pure Functions for Testing
```javascript
// Pure helper (easy to test)
liftToRDF(mermaidText) {
  // Input → Output, no side effects
  return store;
}

// Action (events via notify)
liftDiagram({ diagramId, mermaidText }) {
  const result = liftToRDF(mermaidText); // Pure
  notify('diagramLifted', { result });   // Side effect
}
```

---

## Development Workflow

### Adding a New Validator (Iteration 2 Example)

1. **Create concept file**
   ```bash
   touch src/concepts/ontograde/bfoValidator.js
   ```

2. **Implement state/actions/helpers**
   ```javascript
   export const bfoValidator = {
     state: { validationResults: new Map() },
     actions: { validateRooting() { /*...*/ } },
     helpers: { findPath() { /*...*/ } }
   };
   ```

3. **Create test file**
   ```bash
   touch unit-tests/concepts/ontograde/bfoValidator.test.js
   ```

4. **Write tests first (TDD)**
   ```javascript
   test('finds path from Person to Entity', () => {
     const path = bfoValidator.helpers.findPath('cco:Person', 'bfo:Entity');
     expect(path).toBeDefined();
   });
   ```

5. **Wire synchronization**
   ```javascript
   // src/synchronizations.js
   {
     when: 'diagramLifted',
     from: mermaidLifter,
     do: ({ rdfGraph }) => {
       bfoValidator.actions.validateRooting({ rdfGraph });
     }
   }
   ```

6. **Run tests**
   ```bash
   npm test
   ```

---

## Performance Targets

| Operation | Target | Actual (Iteration 1) |
|-----------|--------|----------------------|
| Parse diagram | <30ms | ~5ms ✅ |
| Lift to RDF | <50ms | <10ms ✅ |
| Load ontology | <50ms | N/A (Iteration 2) |
| Validate rooting | <100ms | N/A (Iteration 2) |
| Total evaluation | <200ms | ~15ms (partial) ✅ |

---

## Common Patterns

### OntoGrade Convention: Nodes
```mermaid
Person_0["Person<br>IRI: cco:Person"]
```

**Parse to:**
```turtle
ex:Person_0 rdf:type cco:Person ;
            rdfs:label "Person" .
```

### OntoGrade Convention: Edges
```mermaid
Person_0 -->|is_bearer_of| Role_0
```

**Parse to:**
```turtle
ex:Person_0 cco:is_bearer_of ex:Role_0 .
```

### IRI Expansion
```javascript
expandIRI('cco:Person') // → http://www.ontologyrepository.com/CommonCoreOntologies/Person
expandIRI('bfo:Entity') // → http://purl.obolibrary.org/obo/BFO_0000001
```

---

## Troubleshooting

### Issue: OntoGrade button doesn't appear
**Fix:** Check `index.html` has the button definition
```html
<button id="ontograde-btn">🎓 OntoGrade</button>
```

### Issue: "Failed to resolve module specifier 'n3'"
**Fix:** Check `index.html` has import map
```html
<script type="importmap">
{ "imports": { "n3": "https://esm.sh/n3@1.17.2" } }
</script>
```

### Issue: Console logs missing
**Fix:** Check DevTools filter settings, enable "Preserve log"

### Issue: Tests failing
**Fix:** Run `npm ci` to ensure dependencies match

---

## Next Steps for Iteration 2

1. Create `scripts/extract-bfo-core.js` extraction script
2. Generate `src/ontologies/bfo-core.ttl.js` (~50KB)
3. Create `src/concepts/ontograde/bfoValidator.js`
4. Implement path-finding from user classes to bfo:Entity
5. Create unit tests (15+ test cases)
6. Wire to synchronizations
7. Test with person_pass.mmd and person_fail.mmd

**Estimated Time:** 2-3 hours of focused development

---

## Key Decisions Made

✅ **Local Storage** for ontologies (not remote)
- Performance: <50ms vs 500-2000ms
- Security: No external attack surface
- PWA: 100% offline support

✅ **CDN for n3 library** (esm.sh)
- No bundler complexity
- Fast builds (~3s)
- Small deployment (~250KB)

✅ **Include both CCO 1.5 and 2.0**
- Support legacy models
- IRI mapping for translation
- Future-proof validation

✅ **Minimal ontology extraction**
- Only ~50KB for BFO hierarchy
- Only ~200KB for CCO patterns
- Not the full 7MB ontologies

---

## Resources

- **Live Demo:** https://skreen5hot.github.io/mermaid/dev/
- **BFO Official:** http://basic-formal-ontology.org/
- **CCO GitHub:** https://github.com/CommonCoreOntology/CommonCoreOntologies
- **N3.js Documentation:** https://github.com/rdfjs/N3.js

---

**Ready to proceed with Iteration 2!** 🚀
