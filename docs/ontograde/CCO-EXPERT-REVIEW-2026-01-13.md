# CCO Expert Review: OntoGrade Validation Rules

**Date:** 2026-01-13
**Reviewer:** [CCO/BFO Realist Ontologist]
**Status:** Awaiting Review
**Previous Review:** 2026-01-09 (Pattern Validation - APPROVED)

---

## Executive Summary

OntoGrade is a Mermaid-centric ontology quality grading tool that validates user diagrams against CCO/BFO best practices. Since the last expert review (2026-01-09), we have added:

1. **Vocabulary Validation** - Validates entity and predicate names against known CCO/BFO vocabulary
2. **Domain/Range Checking** - Validates that CCO predicates connect appropriate entity types

This document requests expert review of these new validation rules.

---

## 1. Context: What Mermaid Can Express

Mermaid class diagrams have **limited expressiveness** compared to full OWL ontologies:

| Feature | Mermaid | OWL |
|---------|---------|-----|
| Classes/Instances | Nodes with labels | Full class definitions |
| Relationships | Directed edges with labels | Object/Data properties |
| Cardinality | **Cannot express** | Full cardinality constraints |
| Property types | **Cannot distinguish** | Object vs Data properties |
| Inverse relations | **Cannot express** | owl:inverseOf |
| Restrictions | **Cannot express** | someValuesFrom, allValuesFrom |

**Implication:** OntoGrade validation is intentionally limited to what users can reasonably model and fix in Mermaid.

---

## 2. Validation Rules Overview

### 2.1 Currently Implemented (Previously Approved)

| Validator | Rule | Severity | Expert Approval |
|-----------|------|----------|-----------------|
| BFO Rooting | All classes must root in BFO hierarchy | VIOLATION | Approved 2026-01-09 |
| Information Staircase | ICE should have is_concretized_by | WARNING | Approved 2026-01-09 |
| Information Staircase | IBE should have has_text_value | WARNING | Approved 2026-01-09 |
| Role Pattern | Role MUST have bearer | VIOLATION | Approved 2026-01-09 |
| Role Pattern | Role SHOULD have realization | WARNING | Approved 2026-01-09 |
| Designation Pattern | DesignativeICE MUST designate something | VIOLATION | Approved 2026-01-09 |
| Logic Consistency | No type collisions (Process AND Object) | VIOLATION | Approved 2026-01-09 |

### 2.2 NEW: Vocabulary Validation (Needs Review)

| Rule | Severity | Description |
|------|----------|-------------|
| Namespace Check | INFO | Entity IRI must use CCO, BFO, or standard namespace |
| Class Name Check | INFO | Class name must exist in CCO/BFO vocabulary |
| Predicate Check | INFO | Predicate must be a known CCO/BFO/RDF property |

**Rationale:** Users often make typos or use incorrect namespaces. This helps catch:
- `Persosn` instead of `Person`
- `https://www.commoncoreontolog.org/` (typo in namespace)
- `foo:is_bearer_of` instead of `cco:is_bearer_of`

**Questions for Expert:**
1. Is INFO the appropriate severity for vocabulary issues?
2. Should unknown vocabulary block scoring entirely, or just warn?

### 2.3 NEW: Domain/Range Validation (Needs Review)

| Predicate | Domain | Range | Severity |
|-----------|--------|-------|----------|
| `is_concretized_by` | InformationContentEntity | InformationBearingEntity | WARNING |
| `concretizes` | InformationBearingEntity | InformationContentEntity | WARNING |
| `has_text_value` | InformationBearingEntity | Literal | WARNING |
| `is_bearer_of` | IndependentContinuant (Person, Agent, Organization, Artifact) | Role | WARNING |
| `realizes` | Process, Act | Role | WARNING |
| `designates` | DesignativeICE, Name, Identifier | (any) | WARNING |
| `is_designated_by` | (any) | DesignativeICE, Name, Identifier | WARNING |
| `participates_in` | Agent, Person, Organization | Act, Process | WARNING |
| `occurs_during` | Act, Process | TemporalInterval | WARNING |
| `has_start_time` | TemporalInterval | Literal | WARNING |
| `has_end_time` | TemporalInterval | Literal | WARNING |
| `has_measurement_value` | QualityMeasurement | Literal | WARNING |
| `uses_measurement_unit` | QualityMeasurement | MeasurementUnit | WARNING |
| `is_measured_by` | Quality | QualityMeasurement | WARNING |

**Questions for Expert:**

1. **Are the domain/range constraints correct?**
   - `is_bearer_of`: Should domain include only bfo:IndependentContinuant, or also CCO subtypes like Person, Agent?
   - `realizes`: Should domain include only bfo:Process, or also cco:Act?
   - `participates_in`: Should domain include bfo:MaterialEntity or specific CCO classes?

2. **Is WARNING the correct severity?**
   - We chose WARNING (not VIOLATION) because type inference is limited in Mermaid
   - Should incorrect domain/range be a VIOLATION instead?

3. **Should we validate more predicates?**
   - We only validate CCO object properties listed above
   - Are there other critical predicates we should add?

4. **Are there predicates we should NOT validate?**
   - Some predicates have very broad domain/range (e.g., rdfs:label)
   - Are any of our constraints too strict?

---

## 3. Detailed Implementation

### 3.1 Vocabulary Validation Logic

```javascript
// Entity is "known" if:
// 1. Uses example.org namespace (test instances), OR
// 2. Uses CCO namespace AND class name exists in KNOWN_CCO_CLASSES, OR
// 3. Uses BFO namespace AND class ID exists in KNOWN_BFO_CLASSES, OR
// 4. Uses RDF/RDFS/OWL/XSD namespace (always valid)

function isKnownEntity(iri) {
  // Allow example.org for testing (instance IRIs)
  if (iri.startsWith('http://example.org/')) return true;

  const { namespace, localPart } = parseIri(iri);

  // Check CCO namespaces
  if (isCCONamespace(namespace)) {
    return KNOWN_CCO_CLASSES.has(localPart);
  }

  // Check BFO namespace
  if (namespace === BFO_NAMESPACE) {
    return KNOWN_BFO_CLASSES.has(localPart);
  }

  // Check standard namespaces
  if (isStandardNamespace(namespace)) return true;

  return false; // Unknown namespace
}
```

**Known CCO Classes (28 classes):**
```
Person, Agent, Organization, Role, ResidentRole, StudentRole, EmployeeRole,
InformationContentEntity, DesignativeInformationContentEntity, Name, PersonName,
Identifier, PostalAddress, InformationBearingEntity, InformationBearingArtifact,
Document, Record, PersonNameRecord, PostalAddressRecord, Artifact, Act,
IntentionalAct, ActOfOccupancy, Quality, Site, Facility, House, Building,
Function, Disposition, TemporalInterval, QualityMeasurement, MeasurementUnit
```

**Known BFO Classes (35 classes):**
```
BFO_0000001 (entity), BFO_0000002 (continuant), BFO_0000003 (occurrent),
BFO_0000004 (independent continuant), BFO_0000015 (process),
BFO_0000016 (disposition), BFO_0000017 (realizable entity),
BFO_0000019 (quality), BFO_0000020 (specifically dependent continuant),
BFO_0000023 (role), BFO_0000029 (site), BFO_0000030 (object),
BFO_0000031 (generically dependent continuant), BFO_0000034 (function),
BFO_0000038 (1D temporal region), BFO_0000040 (material entity), ...
```

### 3.2 Domain/Range Validation Logic

```javascript
function checkDomainRange(rdfGraph) {
  for (const quad of allQuads) {
    const constraint = PREDICATE_CONSTRAINTS[quad.predicate];
    if (!constraint) continue; // No constraint for this predicate

    const subjectTypes = getEntityTypes(quad.subject);
    const objectTypes = getEntityTypes(quad.object);

    // Check domain
    if (constraint.domain.length > 0 && subjectTypes.length > 0) {
      if (!isTypeCompatible(subjectTypes, constraint.domain)) {
        issues.push({
          severity: 'warning',
          message: `"${predicateName}" expects subject of type ${expectedDomain}, but found ${actualType}`,
        });
      }
    }

    // Check range
    if (constraint.range.length > 0 && objectTypes.length > 0) {
      if (!isTypeCompatible(objectTypes, constraint.range)) {
        issues.push({
          severity: 'warning',
          message: `"${predicateName}" expects object of type ${expectedRange}, but found ${actualType}`,
        });
      }
    }
  }
}

// Type compatibility includes subclass checking
function isTypeCompatible(entityTypes, constraintTypes) {
  for (const entityType of entityTypes) {
    if (constraintTypes.includes(entityType)) return true;
    if (isSubclassOf(entityType, constraintTypes)) return true;
  }
  return false;
}
```

---

## 4. Test Cases for Review

### 4.1 Vocabulary Validation Test Cases

| Test | Input | Expected | Rationale |
|------|-------|----------|-----------|
| Valid CCO class | `cco:Person` | PASS | Standard CCO class |
| Valid BFO class | `bfo:BFO_0000040` | PASS | Standard BFO class |
| Typo in CCO class | `cco:Persosn` | INFO: Unknown CCO Class | Catch spelling errors |
| Typo in namespace | `https://commoncoreontolog.org/Person` | INFO: Unrecognized Namespace | Catch URL typos |
| Unknown predicate | `foo:is_bearer_of` | INFO: Unknown Predicate | Wrong namespace |

### 4.2 Domain/Range Validation Test Cases

| Test | Triple | Expected | Rationale |
|------|--------|----------|-----------|
| Valid bearer | `Person is_bearer_of StudentRole` | PASS | Person can bear roles |
| Invalid bearer | `Act is_bearer_of StudentRole` | WARNING | Acts cannot bear roles |
| Valid realization | `StudyingAct realizes StudentRole` | PASS | Processes realize roles |
| Invalid realization | `Person realizes StudentRole` | WARNING | Persons don't realize roles |
| Valid concretization | `PersonName is_concretized_by NameRecord` | PASS | ICE → IBE |
| Invalid concretization | `PersonName is_concretized_by Person` | WARNING | Person is not IBE |
| Valid participation | `Person participates_in StudyingAct` | PASS | Agents participate in acts |
| Invalid participation | `Person participates_in Person` | WARNING | Person is not an act |

---

## 5. Validation Rules NOT Implemented (and Why)

| Rule | Reason Not Implemented |
|------|------------------------|
| Cardinality constraints | Mermaid cannot express cardinality |
| Property type validation | Mermaid edges don't distinguish object/data properties |
| Inverse property consistency | Mermaid cannot express inverse relationships |
| Transitive property reasoning | Would require full OWL reasoner |
| OWL restrictions | Mermaid cannot express someValuesFrom, etc. |

**Question for Expert:** Are there any rules in this list that we SHOULD implement despite Mermaid's limitations?

---

## 6. Current Score Behavior

When vocabulary is unrecognized:
- Final score displays as **"UNKNOWN"** (not a numeric value)
- Orange visual indicator in UI
- Message: "X% unrecognized vocabulary"
- Recommendations focus on vocabulary fixes

When vocabulary is recognized:
- Normal 0-5.0 scoring applies
- Domain/range violations reduce Pattern Adherence score
- All three validators (BFO, Patterns, Logic) contribute to final score

---

## 7. Questions Summary for Expert

1. **Vocabulary Validation:**
   - Is INFO severity appropriate for vocabulary issues?
   - Should unknown vocabulary completely block scoring?

2. **Domain/Range Constraints:**
   - Are the domain/range definitions correct? (See table in Section 2.3)
   - Is WARNING the correct severity, or should it be VIOLATION?
   - Are there additional predicates we should validate?
   - Are any constraints too strict?

3. **Missing Validation:**
   - Are there validation rules we should add despite Mermaid's limitations?

4. **Class Lists:**
   - Are the 28 CCO classes we recognize sufficient?
   - Should we add more CCO classes to the known list?

---

## 8. Appendix: Source Files

| File | Purpose |
|------|---------|
| `src/concepts/ontograde/shaclValidator.js` | Pattern and vocabulary validation |
| `src/concepts/ontograde/bfoValidator.js` | BFO rooting validation |
| `src/concepts/ontograde/logicReasoner.js` | Logic consistency validation |
| `src/concepts/ontograde/gradingEngine.js` | Score calculation |
| `src/ontologies/cco-bfo-mapping.ttl.js` | CCO class list |
| `src/ontologies/bfo-core.ttl.js` | BFO class list |
| `unit-tests/concepts/ontograde/shaclValidator.test.js` | Test cases |

---

## 9. Sign-off

**Expert Reviewer:** ______________________

**Date:** ______________________

**Approval Status:**
- [ ] APPROVED - No changes needed
- [ ] APPROVED WITH COMMENTS - See notes below
- [ ] CHANGES REQUESTED - See notes below

**Notes:**

---

*Document generated by OntoGrade development team*
