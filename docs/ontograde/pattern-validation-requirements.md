# OntoGrade Pattern Validation Requirements

**Project:** OntoGrade Pattern Validator Hardening
**Phase:** Requirements & Planning
**Date:** 2026-01-09
**Status:** Draft

## Executive Summary

This document outlines requirements for hardening OntoGrade's SHACL validator to provide comprehensive coverage of CCO (Common Core Ontologies) design patterns. The goal is to give users confidence that their ontology diagrams follow established best practices and design patterns used by the CCO community.

## Current State Analysis

### Existing Pattern Coverage (3 patterns)

**1. Information Staircase Pattern** ✅ Implemented
```
ICE → is_concretized_by → IBE → has_text_value → Literal
```
- **What it validates:** Information Content Entities must be concretized by Information Bearing Entities
- **Current checks:**
  - ICE has `is_concretized_by` relationship
  - IBE has `has_text_value` relationship
- **Limitations:**
  - Only checks 2-step staircase
  - Doesn't validate literal data types
  - Doesn't check reverse relationships

**2. Role Pattern** ⚠️ Partial
```
IndependentContinuant → is_bearer_of → Role
Process → realizes → Role
```
- **What it validates:** Roles must have both bearers and realizations
- **Current checks:**
  - Role has at least one bearer (`is_bearer_of` from entity)
  - Role has at least one realization (`realizes` from process)
- **Limitations:**
  - Warnings only, not errors
  - Doesn't validate that bearer is correct type (IndependentContinuant)
  - Doesn't validate that realizer is correct type (Process)
  - Doesn't check for role hierarchy

**3. Designation Pattern** ⚠️ Partial
```
Entity ↔ is_designated_by/designates ↔ DesignativeICE
```
- **What it validates:** Designative ICEs must link to entities
- **Current checks:**
  - DesignativeICE has either `designates` or `is_designated_by` relationship
- **Limitations:**
  - Warnings only, not errors
  - Doesn't validate bi-directionality
  - Doesn't check for proper ICE typing

### Gap Analysis

**Missing Critical Patterns:**
1. Temporal patterns (timespan, temporal instant)
2. Geospatial patterns (geospatial location, coordinates)
3. Measurement patterns (measurement, unit of measure)
4. Artifact patterns (artifact, function)
5. Agent patterns (agent, capability)
6. Organization patterns (organization, facility)
7. Act patterns (act, objective)
8. Event patterns (event, participant)

**Validation Depth Issues:**
- No type checking on relationship participants
- No cardinality constraints (min/max occurrences)
- No data type validation on literals
- No inverse relationship checking

**User Confidence Issues:**
- No visibility into which patterns are being checked
- No documentation of pattern requirements
- No examples of correct vs incorrect patterns
- No pattern coverage metrics

---

## Requirements

### Functional Requirements

#### FR1: Comprehensive Pattern Coverage

**FR1.1: Core CCO Patterns**
- **Priority:** High
- **Description:** Implement validation for all documented CCO design patterns
- **Acceptance Criteria:**
  - All patterns from CCO documentation are validated
  - Each pattern has test coverage
  - Pattern violations produce clear, actionable messages

**Patterns to implement:**

**Temporal Patterns:**
1. **Temporal Interval Pattern**
   ```
   TemporalRegion → has_start_time → TemporalInstant
   TemporalRegion → has_end_time → TemporalInstant
   ```
   - Validate: Start time exists if end time exists
   - Validate: Start time before or equal to end time (if timestamps provided)

2. **Event Occurrence Pattern**
   ```
   Event → occurs_at → TemporalInstant
   Event → occurs_during → TemporalInterval
   ```
   - Validate: Event has at least one temporal anchoring
   - Validate: occurs_at is mutually exclusive with occurs_during

**Geospatial Patterns:**
3. **Geospatial Location Pattern**
   ```
   Entity → has_spatial_location → GeospatialRegion
   GeospatialRegion → has_latitude → Literal
   GeospatialRegion → has_longitude → Literal
   ```
   - Validate: Latitude in range [-90, 90]
   - Validate: Longitude in range [-180, 180]
   - Validate: Both lat/long present if either specified

4. **Facility Location Pattern**
   ```
   Facility → located_in → GeospatialRegion
   Facility → has_part → Artifact
   ```
   - Validate: Facility has location
   - Validate: Location is proper type

**Measurement Patterns:**
5. **Measurement Pattern**
   ```
   QualityMeasurement → is_measurement_of → Quality
   QualityMeasurement → has_measurement_value → Literal
   QualityMeasurement → uses_measurement_unit → MeasurementUnit
   ```
   - Validate: All three components present
   - Validate: Measurement value is numeric
   - Validate: Unit matches quality type (e.g., temperature → Celsius/Fahrenheit)

6. **Ratio Measurement Pattern**
   ```
   RatioMeasurement → has_numerator → Measurement
   RatioMeasurement → has_denominator → Measurement
   ```
   - Validate: Both numerator and denominator present
   - Validate: Denominator is not zero (if value provided)

**Artifact Patterns:**
7. **Artifact Function Pattern**
   ```
   Artifact → has_function → Function
   Function → is_realized_by → Process
   ```
   - Validate: Artifact has at least one function
   - Validate: Functions are realizable

8. **Artifact Component Pattern**
   ```
   Artifact → has_part → Artifact
   Artifact → is_part_of → Artifact
   ```
   - Validate: Bi-directionality (if has_part, then inverse is_part_of exists)
   - Validate: No circular parthood

**Agent Patterns:**
9. **Agent Capability Pattern**
   ```
   Agent → has_capability → Capability
   Capability → is_realized_in → Act
   ```
   - Validate: Agent capabilities are realizable
   - Validate: Acts realize capabilities

10. **Organization Membership Pattern**
    ```
    Person → is_member_of → Organization
    Organization → has_member → Person
    ```
    - Validate: Bi-directional membership
    - Validate: Member is Agent

**Act Patterns:**
11. **Act Objective Pattern**
    ```
    IntentionalAct → has_objective → Objective
    Objective → is_objective_of → IntentionalAct
    ```
    - Validate: Intentional acts have objectives
    - Validate: Bi-directionality

12. **Act Participant Pattern**
    ```
    Act → has_agent → Agent
    Act → has_participant → Entity
    ```
    - Validate: Acts have at least one participant
    - Validate: Agents are proper type

**Event Patterns:**
13. **Event Causation Pattern**
    ```
    Event → is_cause_of → Event
    Event → is_effect_of → Event
    ```
    - Validate: Bi-directional causation
    - Validate: No circular causation

**FR1.2: Enhanced Existing Patterns**
- **Priority:** High
- **Description:** Add depth to existing pattern validation
- **Information Staircase Enhancements:**
  - Validate literal data types (string, integer, etc.)
  - Check for proper IBE typing (InformationBearingEntity)
  - Validate multi-level staircases
  - Check inverse relationships (`concretizes`)
- **Role Pattern Enhancements:**
  - Upgrade to errors (not warnings) when missing bearer/realization
  - Validate bearer is IndependentContinuant subclass
  - Validate realizer is Process subclass
  - Check role hierarchy (e.g., EmployeeRole subClassOf Role)
- **Designation Pattern Enhancements:**
  - Upgrade to errors for unlinked designatives
  - Validate bi-directionality
  - Check ICE type inheritance

#### FR2: Deep Validation Rules

**FR2.1: Type Checking**
- **Priority:** High
- **Description:** Validate that relationship participants are correct types
- **Acceptance Criteria:**
  - All predicates check subject and object types
  - Type mismatches produce clear error messages
  - Subclass relationships are respected (Agent includes Person, Organization)

**FR2.2: Cardinality Constraints**
- **Priority:** Medium
- **Description:** Validate min/max occurrences of relationships
- **Acceptance Criteria:**
  - Exactly one constraints enforced (e.g., Person has exactly one birthdate)
  - At least one constraints enforced (e.g., Act has at least one participant)
  - At most one constraints enforced (e.g., Person has at most one mother)

**FR2.3: Data Type Validation**
- **Priority:** Medium
- **Description:** Validate literal data types and ranges
- **Acceptance Criteria:**
  - Numeric literals validated (integer, float, decimal)
  - Date/time literals validated (ISO 8601 format)
  - String literals validated (max length, patterns)
  - Enumerated values validated (e.g., Gender: Male|Female|Other)

**FR2.4: Inverse Relationship Checking**
- **Priority:** Medium
- **Description:** Validate bi-directional relationships
- **Acceptance Criteria:**
  - `has_part` implies `is_part_of`
  - `is_member_of` implies `has_member`
  - Asymmetric relationships don't have inverses (e.g., `causes`)

#### FR3: Pattern Discovery & Reporting

**FR3.1: Pattern Detection**
- **Priority:** High
- **Description:** Automatically detect which patterns are present in diagram
- **Acceptance Criteria:**
  - System identifies all patterns in use
  - Report shows "Patterns Found: 5/13"
  - Users see which patterns are validated

**FR3.2: Pattern Coverage Metrics**
- **Priority:** Medium
- **Description:** Show pattern coverage statistics
- **Acceptance Criteria:**
  - Display: "Pattern Coverage: 38% (5 of 13 patterns validated)"
  - Per-pattern pass/fail status
  - Trend analysis (optional): "Coverage improved from 30% to 38%"

**FR3.3: Pattern Documentation Links**
- **Priority:** Low
- **Description:** Link violations to pattern documentation
- **Acceptance Criteria:**
  - Each violation includes link to pattern definition
  - Pattern documentation explains correct usage
  - Examples of correct vs incorrect patterns

#### FR4: User Confidence Features

**FR4.1: Validation Transparency**
- **Priority:** High
- **Description:** Show users exactly what is being validated
- **Acceptance Criteria:**
  - Pre-validation report: "Will check: Role pattern, Info Staircase, Designation"
  - Post-validation report: "Checked 3 patterns, found 2 violations"
  - Detailed breakdown of each check performed

**FR4.2: Pattern Examples**
- **Priority:** High
- **Description:** Provide example diagrams for each pattern
- **Acceptance Criteria:**
  - Example diagrams in `/examples/diagrams/patterns/`
  - Each pattern has:
    - ✅ Correct implementation example
    - ❌ Incorrect implementation example (with expected violations)
  - Examples are tested automatically

**FR4.3: Confidence Scoring**
- **Priority:** Medium
- **Description:** Show confidence level in validation results
- **Acceptance Criteria:**
  - Display: "Validation Confidence: 95%"
  - Factors affecting confidence:
    - Pattern coverage (more patterns checked = higher confidence)
    - Type inference certainty
    - Ontology completeness
  - Low confidence triggers warnings

**FR4.4: Explanation System**
- **Priority:** Medium
- **Description:** Explain WHY violations are problems
- **Acceptance Criteria:**
  - Each violation includes:
    - What: "Role not realized by process"
    - Why: "CCO requires roles to be realized by processes representing activities"
    - Impact: "Ontology may not properly represent behavior"
    - Fix: "Add realizes relationship from a Process to this Role"

### Non-Functional Requirements

#### NFR1: Performance
- **Requirement:** Validation completes in < 500ms for diagrams with < 100 entities
- **Requirement:** Validation completes in < 2s for diagrams with < 1000 entities
- **Rationale:** Real-time feedback for users

#### NFR2: Maintainability
- **Requirement:** Each pattern is a separate, testable function
- **Requirement:** Patterns can be enabled/disabled via configuration
- **Requirement:** New patterns can be added without modifying existing code
- **Rationale:** Easy to extend and maintain

#### NFR3: Testability
- **Requirement:** 100% unit test coverage for pattern validators
- **Requirement:** Each pattern has positive and negative test cases
- **Requirement:** Test diagrams exist for all patterns
- **Rationale:** Confidence in validation accuracy

#### NFR4: Usability
- **Requirement:** Violation messages are clear and actionable
- **Requirement:** Users can filter violations by pattern type
- **Requirement:** Users can see pattern definitions in-app
- **Rationale:** Users can quickly understand and fix issues

---

## Validation Strategy

### How We Validate the Validator

**1. Test-Driven Development**
```javascript
// For each pattern:
describe('Temporal Interval Pattern', () => {
  it('should PASS when interval has start and end times', () => {
    // Create valid RDF graph
    // Run validator
    // Assert no violations
  });

  it('should FAIL when interval missing start time', () => {
    // Create invalid RDF graph
    // Run validator
    // Assert violation with message: "Temporal interval missing has_start_time"
  });

  it('should FAIL when end time before start time', () => {
    // Create invalid RDF graph with backwards times
    // Run validator
    // Assert violation with message: "End time must be after start time"
  });
});
```

**2. Reference Diagrams**
- Create "gold standard" diagrams from CCO documentation
- Validate that gold standards get perfect scores
- Create "anti-pattern" diagrams that should fail
- Validate that anti-patterns get appropriate violations

**3. CCO Community Review**
- Share validator logic with CCO maintainers
- Get feedback on pattern interpretations
- Align with official CCO SHACL shapes (if available)

**4. Cross-Validation**
- Compare OntoGrade results with other validators:
  - TopBraid Composer (if available)
  - Protégé SHACL plugin
  - Command-line SHACL validators
- Ensure consistency in violation detection

**5. Incremental Validation**
```javascript
// Pattern registry system
const patternRegistry = {
  'role-pattern': { enabled: true, version: '1.0', lastTested: '2026-01-09' },
  'info-staircase': { enabled: true, version: '1.0', lastTested: '2026-01-09' },
  'temporal-interval': { enabled: false, version: '0.1', lastTested: '2026-01-09' },
  // ... more patterns
};
```
- Patterns marked as `beta` until fully tested
- Users can opt-in to beta patterns
- Gradual rollout as patterns are validated

### User Confidence Features

**1. Validation Report Enhancements**

**Current Report:**
```
Final Score: 4.2/5.0
BFO Rooting: 100%
Pattern Adherence: 67%
Logic Consistency: 100%
```

**Enhanced Report:**
```
Final Score: 4.2/5.0
Validation Confidence: 92%

BFO Rooting: 100% ✅
  - All 5 classes rooted in bfo:Entity
  - Confidence: 100%

Pattern Adherence: 67% ⚠️
  - Patterns detected in diagram: 3
  - Patterns validated: 3/3 (Role, Info Staircase, Designation)
  - Patterns passed: 1/3
  - Available patterns not in diagram: 10
  - Confidence: 85% (limited pattern coverage)

Logic Consistency: 100% ✅
  - No contradictory types
  - No disjointness violations
  - Confidence: 100%

Overall: Your diagram uses 3 of 13 known CCO patterns.
Consider adding temporal or geospatial patterns for richer ontology.
```

**2. Pattern Coverage Dashboard**
```
╔══════════════════════════════════════════════════════╗
║ Pattern Coverage Summary                             ║
╠══════════════════════════════════════════════════════╣
║ Validated Patterns:          3/13 (23%)              ║
║ Patterns in Your Diagram:    3                       ║
║ Patterns Available:          13                      ║
║                                                       ║
║ ✅ Role Pattern              PASS (100%)             ║
║ ❌ Information Staircase     FAIL (2 violations)     ║
║ ✅ Designation Pattern       PASS (100%)             ║
║                                                       ║
║ Patterns Not in Diagram:                             ║
║ ⚪ Temporal Interval                                  ║
║ ⚪ Geospatial Location                                ║
║ ⚪ Measurement                                        ║
║ ... (7 more)                                         ║
╚══════════════════════════════════════════════════════╝
```

**3. In-App Pattern Documentation**
```javascript
// User clicks "What is Role Pattern?"
{
  name: "Role Pattern",
  category: "Core",
  description: "Roles represent dispositional properties that entities bear and processes realize",
  requiredRelationships: [
    "Entity → is_bearer_of → Role",
    "Process → realizes → Role"
  ],
  example: "examples/diagrams/patterns/role-pattern-correct.mmd",
  antiExample: "examples/diagrams/patterns/role-pattern-violations.mmd",
  ccoReference: "https://github.com/CommonCoreOntology/CommonCoreOntologies#role-pattern",
  validationRules: [
    "Every Role must have at least one bearer",
    "Every Role must be realized by at least one Process",
    "Bearers must be subclasses of IndependentContinuant",
    "Realizers must be subclasses of Process"
  ]
}
```

**4. Confidence Indicators**
- 🟢 **High Confidence (95-100%)**: Comprehensive validation, all patterns checked
- 🟡 **Medium Confidence (70-94%)**: Good validation, some patterns not applicable
- 🟠 **Low Confidence (50-69%)**: Limited validation, consider adding patterns
- 🔴 **Very Low Confidence (<50%)**: Minimal validation, diagram may have issues

**5. Test Evidence**
```
Pattern Validator Test Status:
✅ Unit Tests: 156/156 passing (100%)
✅ Integration Tests: 24/24 passing (100%)
✅ Pattern Tests: 39/39 passing (100%)
✅ Gold Standard Tests: 13/13 passing (100%)

Last tested: 2026-01-09 15:30:42
Test coverage: 97.3%
```

---

## Implementation Strategy

### Phase 1: Foundation (Weeks 1-2)
1. **Refactor current validators** into pattern registry system
2. **Create pattern base class** with common validation logic
3. **Build test framework** for pattern testing
4. **Document existing patterns** with examples

### Phase 2: Core Patterns (Weeks 3-6)
1. Implement **Temporal patterns** (Interval, Event Occurrence)
2. Implement **Geospatial patterns** (Location, Facility)
3. Implement **Measurement patterns** (Measurement, Ratio)
4. Add **type checking** infrastructure
5. Create **example diagrams** for all patterns

### Phase 3: Extended Patterns (Weeks 7-10)
1. Implement **Artifact patterns** (Function, Component)
2. Implement **Agent patterns** (Capability, Membership)
3. Implement **Act patterns** (Objective, Participant)
4. Implement **Event patterns** (Causation)
5. Add **cardinality constraints**

### Phase 4: Validation & Confidence (Weeks 11-12)
1. Add **pattern coverage metrics**
2. Implement **confidence scoring**
3. Build **pattern documentation UI**
4. Create **explanation system**
5. Add **validation transparency** features

### Phase 5: Testing & Refinement (Weeks 13-14)
1. **Cross-validation** with other tools
2. **CCO community review**
3. **Performance optimization**
4. **Documentation completion**
5. **Release preparation**

---

## Success Metrics

### Quantitative Metrics
- ✅ **Pattern Coverage:** 13+ patterns validated (from 3 currently)
- ✅ **Test Coverage:** 100% unit test coverage for all validators
- ✅ **Performance:** < 500ms validation for typical diagrams
- ✅ **Accuracy:** 95%+ agreement with reference validators

### Qualitative Metrics
- ✅ **User Confidence:** Users report high confidence in validation results (survey)
- ✅ **Clarity:** 90%+ of users understand violation messages without help
- ✅ **Completeness:** CCO maintainers confirm pattern coverage is comprehensive
- ✅ **Usability:** Users can fix violations without external documentation

### Adoption Metrics
- ✅ **Usage:** 80%+ of users run OntoGrade validation before finalizing diagrams
- ✅ **Improvement:** Average ontology score improves from 3.5 to 4.2 after using OntoGrade
- ✅ **Satisfaction:** 85%+ user satisfaction with validation system

---

## Risks & Mitigation

### Risk 1: Pattern Interpretation Ambiguity
- **Risk:** CCO patterns may have multiple valid interpretations
- **Impact:** High - Could lead to false positives/negatives
- **Mitigation:**
  - Engage CCO community early
  - Document interpretation decisions
  - Allow pattern customization

### Risk 2: Performance Degradation
- **Risk:** 13+ patterns may slow validation significantly
- **Impact:** Medium - Poor user experience
- **Mitigation:**
  - Parallel pattern checking
  - Caching of intermediate results
  - Progressive validation (validate as user types)

### Risk 3: Maintenance Burden
- **Risk:** 13+ patterns require ongoing maintenance
- **Impact:** Medium - Technical debt
- **Mitigation:**
  - Pattern registry system for easy enable/disable
  - Comprehensive test suite
  - Clear documentation

### Risk 4: False Sense of Security
- **Risk:** Users may trust validator without understanding patterns
- **Impact:** Medium - Improper ontology design
- **Mitigation:**
  - Confidence scoring
  - Educational explanations
  - Emphasis on validator as guide, not authority

---

## Decision Log

### Resolved Questions

1. ✅ **Pattern Priority:** Implement all patterns without prioritization - go through the list sequentially
   - Decision: No priority ordering, implement in document order
   - Rationale: Comprehensive coverage is more important than phased rollout

2. ✅ **Extensibility:** Custom user-defined patterns NOT supported at this stage
   - Decision: Focus on CCO/BFO patterns only
   - Rationale: Build solid foundation before adding extensibility complexity

3. ✅ **Pattern Library Browser:** YES - Create new page in UI for pattern documentation
   - Decision: Build dedicated pattern library browser
   - Rationale: Transparency and user education are critical for confidence

4. ✅ **Validation Profiles:** Use BFO-principled severity levels (per expert review)
   - Decision: Severity based on ontological necessity, not user preference
   - See "CCO Expert Review Decisions" below for pattern-specific severities

5. ✅ **CCO Alignment:** OntoGrade fills a gap - no official CCO SHACL exists
   - Decision: Our shapes become the reference implementation
   - Expert confirmed: "Your OntoGrade shapes are actually filling a vital gap for the community"

6. ✅ **Type Validation:** YES - Validate relationship endpoint types
   - Decision: Enforce domain/range constraints
   - Example: `realizes` requires Process (subject) and RealizableEntity (object)
   - Rationale: Prevents "diagonal errors" where users link incorrect types

### CCO Expert Review Decisions (2026-01-09)

**Pattern Severity Summary (Expert Recommendations):**

| Pattern | Rule | Severity | Rationale |
|---------|------|----------|-----------|
| **Information Staircase** | ICE → is_concretized_by | **Warning** | ICE can exist abstractly (like a Law) |
| **Information Staircase** | IBE → concretizes | **Warning** | Blank slate IBE is rarely intended |
| **Role Pattern** | Entity → is_bearer_of → Role | **Violation** | Role CANNOT exist without bearer (BFO) |
| **Role Pattern** | Process → realizes → Role | **Warning** | Dispositions can remain dormant (BFO) |
| **Designation Pattern** | DesignativeICE → designates | **Violation** | Name that names nothing is not a name |
| **Measurement Pattern** | All 3 components (Value/Unit/Quality) | **Violation** | Incomplete measurement is meaningless |
| **Temporal Interval** | Start/End times | **Warning** | Ongoing processes may lack end time |
| **Temporal Interval** | Start ≤ End | **Violation** | Backwards time is impossible |

**New Pattern Added (Expert Recommendation):**
- **Socio-Primal Pattern:** Agent participation in Acts with temporal grounding
  - Critical for modeling organizational/social structures
  - Was MISSING from our original pattern set

**Key BFO Principles Applied:**
1. **The Realization Fallacy:** A Disposition exists even if never realized (fire extinguisher role exists even if no fire occurs)
2. **Bearer Necessity:** A Role CANNOT exist without a bearer - ontologically impossible
3. **Open World vs Design:** ICE can exist abstractly, but for practical modeling, concretization is expected

### Open Questions

1. **Pattern Versioning:** How do we handle pattern evolution over time?
2. **Multi-Ontology Support:** Should we support other ontologies beyond CCO/BFO in future?

---

## Next Steps

1. **Review this document** with stakeholders
2. **Prioritize patterns** based on user research or CCO frequency analysis
3. **Create detailed design document** for Phase 1
4. **Set up pattern registry** infrastructure
5. **Begin implementation** of Phase 1

---

## References

- Common Core Ontologies GitHub: https://github.com/CommonCoreOntology/CommonCoreOntologies
- BFO 2020 Specification: http://basic-formal-ontology.org/
- SHACL Specification: https://www.w3.org/TR/shacl/
- Current implementation: [src/concepts/ontograde/shaclValidator.js](../../src/concepts/ontograde/shaclValidator.js)

---

**Document Status:** Draft - Awaiting Review
**Next Review Date:** TBD
**Owner:** OntoGrade Team
