# OntoGrade SHACL Shapes - Expert Review

**Date:** 2026-01-09
**Status:** ✅ APPROVED - Compliant with BFO/CCO Standards
**Reviewer:** CCO/BFO Realist Ontologist

---

## Final Expert Approval (2026-01-09)

> "The current configuration is ontologically sound and ready for implementation."
> — CCO/BFO Realist Ontologist

The SHACL shapes have been reviewed and **approved as compliant with BFO/CCO standards**.

### Expert Confirmation Summary

| Pattern Component | Status | Expert Rationale |
|-------------------|--------|------------------|
| **ICE Concretization** | ✅ Warning | ICEs are generically dependent; abstract existence is possible |
| **Role Bearer** | ✅ Violation | Specifically dependent entities cannot exist without a bearer |
| **Role Realization** | ✅ Warning | Dispositions/Roles can remain dormant/unrealized |
| **Designation Link** | ✅ Violation | A name must name something to be a Designative ICE |
| **Measurement (Full)** | ✅ Violation | Value, Unit, and Quality are mutually dependent for a valid measure |
| **Time Ordering** | ✅ Violation | Temporal backwardness is logically/ontologically impossible |

### Expert Notes

1. **ICE Concretization:** "As a Generically Dependent Continuant, an ICE does not require a specific bearer to exist at all times (it can exist abstractly in potentiality), but for a digital modeling project, a warning provides the necessary nudge for completeness."

2. **Role Pattern:** "Your logic is now perfectly aligned with BFO. Every Role must have a bearer (Violation if missing) because a role is a dependent continuant. However, a Role does not need to be realized to exist (e.g., a 'Reserve Pilot Role' exists even if the pilot never flies)."

3. **Socio-Primal Pattern:** "The addition fills a critical gap. In CCO, social reality is captured through the participation of Agents in Acts that occupy a specific Temporal Interval."

4. **Type Validation:** "Explicitly targeting bfo:IndependentContinuant for Role bearers and bfo:Process for Role realizers is excellent. This prevents 'category errors'."

### Next Steps (Expert Recommendation)

> "I recommend moving the Draft patterns (Artifact Function, Agent Capability, etc.) to Active status once you have gathered enough user data to determine if the sh:Warning level is distracting to Mermaid users."

---

## Review History

### Round 1: Initial Review (2026-01-09)
Expert provided feedback on severity levels and missing patterns.

### Round 2: Changes Implemented (2026-01-09)
All recommendations incorporated into SHACL shapes.

### Round 3: Final Approval (2026-01-09)
Shapes approved as compliant with BFO/CCO standards.

---

## Changes Made (Round 2)

| Pattern | Original Severity | New Severity | Rationale |
|---------|------------------|--------------|-----------|
| ICE → is_concretized_by | Violation | **Warning** | ICE can exist abstractly |
| Role → is_bearer_of | Violation | **Violation** | Role CANNOT exist without bearer |
| Role → realizes | Violation | **Warning** | Dispositions can remain dormant |
| Designation | Warning | **Violation** | Name that names nothing is invalid |
| Measurement (all rules) | Violation | **Violation** | All components required |

### New Pattern Added
- **Socio-Primal Pattern:** Agent participation in Acts with temporal grounding

### Type Validation Added
- Bearer must be IndependentContinuant (bfo:BFO_0000004)
- Realizer must be Process (bfo:BFO_0000015)

---

## Original Review Request

## Purpose

We are developing **OntoGrade**, a validation system for Mermaid-based ontology diagrams that checks adherence to Common Core Ontology (CCO) and Basic Formal Ontology (BFO) design patterns.

We request expert review of our SHACL shapes to ensure:
1. Accurate interpretation of CCO design patterns
2. Appropriate validation rules and severity levels
3. Alignment with official CCO guidance
4. Identification of missing patterns

## Files for Review

### Primary File: SHACL Shapes
**Location:** [src/ontologies/ontograde-shapes.ttl](../../src/ontologies/ontograde-shapes.ttl)

This Turtle file contains all SHACL shapes used for pattern validation.

### Supporting File: JavaScript Implementation
**Location:** [src/concepts/ontograde/shaclValidator.js](../../src/concepts/ontograde/shaclValidator.js)

This shows how the SHACL patterns are implemented in our JavaScript runtime.

---

## Currently Active Patterns (3)

### Pattern 1: Information Staircase

**Description:** Validates that Information Content Entities (ICE) are properly concretized in Information Bearing Entities (IBE) with text values.

**Structure:**
```
InformationContentEntity (ICE)
  └── is_concretized_by → InformationBearingEntity (IBE)
        └── has_text_value → xsd:string
```

**SHACL Shape:**
```turtle
ograde:InformationContentEntityShape
    a sh:NodeShape ;
    sh:targetClass cco:InformationContentEntity ;
    sh:property [
        sh:path cco:is_concretized_by ;
        sh:minCount 1 ;
        sh:class cco:InformationBearingEntity ;
        sh:severity sh:Violation ;
        sh:message "InformationContentEntity must have at least one is_concretized_by relationship..." ;
    ] .
```

**Questions for Reviewer:**
1. Is `minCount 1` appropriate for ICE → is_concretized_by → IBE?
2. Should we also validate the inverse relationship (IBE → concretizes → ICE)?
3. Is `has_text_value` the correct predicate, or should we use other CCO properties?
4. Should this be a Violation or Warning?

---

### Pattern 2: Role Pattern

**Description:** Validates that Roles have both bearers (entities that have the role) and realizations (processes that actualize the role).

**Structure:**
```
IndependentContinuant (Entity)
  └── is_bearer_of → Role
Process
  └── realizes → Role
```

**SHACL Shape:**
```turtle
ograde:RoleShape
    a sh:NodeShape ;
    sh:targetClass cco:Role ;
    sh:property [
        sh:path [ sh:inversePath cco:is_bearer_of ] ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "Role must be borne by at least one entity..." ;
    ] ;
    sh:property [
        sh:path [ sh:inversePath cco:realizes ] ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "Role must be realized by at least one Process..." ;
    ] .
```

**Questions for Reviewer:**
1. Is it correct that EVERY Role must have both a bearer AND a realization?
2. Are there cases where a Role might exist without realization (unrealized disposition)?
3. Should we validate that the bearer is specifically an IndependentContinuant subclass?
4. Should we validate that the realizer is specifically a Process subclass?
5. Current severity is Violation - should these be Warnings instead?

---

### Pattern 3: Designation Pattern

**Description:** Validates that Designative Information Content Entities (names, identifiers) are linked to the entities they designate.

**Structure:**
```
Entity → is_designated_by → DesignativeInformationContentEntity
OR
DesignativeInformationContentEntity → designates → Entity
```

**SHACL Shape:**
```turtle
ograde:DesignativeInformationContentEntityShape
    a sh:NodeShape ;
    sh:targetClass cco:DesignativeInformationContentEntity ;
    sh:or (
        [ sh:property [ sh:path cco:designates ; sh:minCount 1 ] ]
        [ sh:property [ sh:path [ sh:inversePath cco:is_designated_by ] ; sh:minCount 1 ] ]
    ) ;
    sh:severity sh:Warning ;
    sh:message "DesignativeInformationContentEntity must either designate an entity OR be linked via is_designated_by..." .
```

**Questions for Reviewer:**
1. Is it correct to allow EITHER direction (designates OR is_designated_by)?
2. Or should bi-directionality be required/encouraged?
3. Are there subclasses of DesignativeICE that have different patterns?
4. Should this be a Warning or Violation?

---

## Proposed Patterns (Draft - Deactivated)

The following patterns are drafted but deactivated pending expert review:

### Pattern 4: Temporal Interval Pattern
```
TemporalInterval
  └── has_start_time → TemporalInstant
  └── has_end_time → TemporalInstant
```
- Should both times be required or just recommended?
- Should we validate time ordering (start ≤ end)?

### Pattern 5: Measurement Pattern
```
QualityMeasurement
  └── is_measurement_of → Quality
  └── has_measurement_value → xsd:decimal
  └── uses_measurement_unit → MeasurementUnit
```
- Are all three components required?
- What are the correct CCO predicates?

### Pattern 6: Artifact Function Pattern
```
Artifact → has_function → ArtifactFunction
Function → is_realized_by → Process (optional)
```
- Must every Artifact have a function?

### Pattern 7: Agent Capability Pattern
```
Agent → has_capability → Capability
Capability → is_realized_in → Act (optional)
```

### Pattern 8: Act Participant Pattern
```
Act → has_agent → Agent
Act → has_participant → Entity
```
- Is `has_agent` required for all Acts?

### Pattern 9: Organization Membership Pattern
```
Organization → has_member → Agent
Agent → is_member_of → Organization
```
- Should bi-directionality be validated?

---

## General Questions

1. **Pattern Coverage:** Are there other fundamental CCO patterns we're missing?

2. **Type Validation:** Should we validate that relationship endpoints are correct BFO/CCO types? (e.g., Role bearers must be IndependentContinuant)

3. **Cardinality:** Are there patterns with specific cardinality constraints beyond "at least one"?

4. **Severity Levels:** Which patterns should be Violations vs Warnings vs Info?

5. **Official SHACL:** Does the CCO project have official SHACL shapes we should align with?

6. **Edge Cases:** Are there legitimate modeling scenarios where these patterns wouldn't apply?

---

## How to Review

### Option 1: Review the Turtle File
Open [src/ontologies/ontograde-shapes.ttl](../../src/ontologies/ontograde-shapes.ttl) and review the SHACL shapes directly.

### Option 2: Run Against SHACL Validator
You can validate our shapes using any SHACL processor:

```bash
# Using TopBraid SHACL
shaclvalidate -datafile your_ontology.ttl -shapesfile ontograde-shapes.ttl

# Using pySHACL
pyshacl -s ontograde-shapes.ttl -d your_ontology.ttl
```

### Option 3: Review JavaScript Implementation
The actual runtime validation is in [src/concepts/ontograde/shaclValidator.js](../../src/concepts/ontograde/shaclValidator.js)

---

## Feedback Format

Please provide feedback in any format, but ideally:

```markdown
## Pattern: [Pattern Name]

### Assessment
- [ ] Correct interpretation
- [ ] Needs modification
- [ ] Should be removed

### Issues Found
1. [Issue description]

### Recommended Changes
1. [Change description]

### CCO Reference
[Link to relevant CCO documentation or examples]
```

---

## Context: OntoGrade System

OntoGrade is part of the Mermaid Ontology IDE, which allows users to:
1. Create ontology diagrams using Mermaid syntax
2. Validate diagrams against BFO/CCO standards
3. Receive quality scores and feedback

The validation system has three components:
1. **BFO Validator** - Checks that all classes are rooted in BFO Entity
2. **SHACL Validator** - Checks CCO design patterns (this review)
3. **Logic Reasoner** - Checks for disjointness violations

---

## Thank You!

Your expert review will help ensure OntoGrade provides accurate, valuable feedback to ontology developers learning CCO patterns.

---

**Document Location:** docs/ontograde/SHACL-VALIDATION-REVIEW.md
**SHACL Shapes File:** src/ontologies/ontograde-shapes.ttl
**JavaScript Implementation:** src/concepts/ontograde/shaclValidator.js
