# OntoGrade Predicate Constraints Reference

This document provides the exact domain/range constraints implemented in OntoGrade for CCO expert review.

## Namespace Prefixes

| Prefix | IRI |
|--------|-----|
| `cco:` | `http://www.ontologyrepository.com/CommonCoreOntologies/` |
| `bfo:` | `http://purl.obolibrary.org/obo/` |
| `rdf:` | `http://www.w3.org/1999/02/22-rdf-syntax-ns#` |
| `rdfs:` | `http://www.w3.org/2000/01/rdf-schema#` |

---

## Predicate Constraints

### 1. `cco:is_concretized_by`

**Description:** Relates an Information Content Entity to its physical bearer.

| Property | Value |
|----------|-------|
| Domain | `cco:InformationContentEntity` |
| Range | `cco:InformationBearingEntity` |
| Severity | WARNING |

**Valid Example:**
```turtle
:myName_ICE a cco:PersonName ;
    cco:is_concretized_by :myName_IBE .
:myName_IBE a cco:PersonNameRecord .
```

**Invalid Example (triggers warning):**
```turtle
:myName_ICE a cco:PersonName ;
    cco:is_concretized_by :john .  # Person is not an IBE
:john a cco:Person .
```

---

### 2. `cco:concretizes`

**Description:** Inverse of is_concretized_by.

| Property | Value |
|----------|-------|
| Domain | `cco:InformationBearingEntity` |
| Range | `cco:InformationContentEntity` |
| Severity | WARNING |

---

### 3. `cco:has_text_value`

**Description:** Relates an IBE to its textual content.

| Property | Value |
|----------|-------|
| Domain | `cco:InformationBearingEntity` |
| Range | Literal (xsd:string) |
| Severity | WARNING |

**Valid Example:**
```turtle
:myName_IBE a cco:PersonNameRecord ;
    cco:has_text_value "John Doe" .
```

---

### 4. `cco:is_bearer_of`

**Description:** Relates an independent continuant to a role it bears.

| Property | Value |
|----------|-------|
| Domain | `bfo:BFO_0000004` (IndependentContinuant), `cco:Person`, `cco:Agent`, `cco:Organization`, `cco:Artifact` |
| Range | `cco:Role`, `cco:StudentRole`, `cco:ResidentRole`, `cco:EmployeeRole`, `bfo:BFO_0000023` |
| Severity | WARNING |

**BFO Principle:** Only independent continuants can bear roles. Processes, qualities, and other dependent continuants cannot bear roles.

**Valid Examples:**
```turtle
:john a cco:Person ;
    cco:is_bearer_of :johnStudentRole .
:johnStudentRole a cco:StudentRole .

:acmeCorp a cco:Organization ;
    cco:is_bearer_of :employerRole .
```

**Invalid Example (triggers warning):**
```turtle
:studyingAct a cco:Act ;
    cco:is_bearer_of :studentRole .  # Acts cannot bear roles
```

---

### 5. `cco:realizes`

**Description:** Relates a process to the role it realizes.

| Property | Value |
|----------|-------|
| Domain | `bfo:BFO_0000015` (Process), `cco:Act` |
| Range | `cco:Role`, `bfo:BFO_0000023` |
| Severity | WARNING |

**BFO Principle:** Only processes/occurrents can realize roles. "A Disposition exists even if never realized."

**Valid Example:**
```turtle
:studyingAct a cco:Act ;
    cco:realizes :studentRole .
:studentRole a cco:StudentRole .
```

**Invalid Example (triggers warning):**
```turtle
:john a cco:Person ;
    cco:realizes :studentRole .  # Persons don't realize roles
```

---

### 6. `cco:designates`

**Description:** Relates a designative ICE to the entity it designates.

| Property | Value |
|----------|-------|
| Domain | `cco:DesignativeInformationContentEntity`, `cco:Name`, `cco:Identifier` |
| Range | (any entity) |
| Severity | WARNING |

**Note:** Range is unrestricted because any entity can be designated by a name/identifier.

**Valid Example:**
```turtle
:johnName a cco:PersonName ;
    cco:designates :john .
:john a cco:Person .
```

---

### 7. `cco:is_designated_by`

**Description:** Inverse of designates.

| Property | Value |
|----------|-------|
| Domain | (any entity) |
| Range | `cco:DesignativeInformationContentEntity`, `cco:Name`, `cco:Identifier` |
| Severity | WARNING |

---

### 8. `cco:participates_in`

**Description:** Relates an agent/material entity to an act it participates in.

| Property | Value |
|----------|-------|
| Domain | `cco:Agent`, `cco:Person`, `cco:Organization`, `bfo:BFO_0000040` (MaterialEntity) |
| Range | `cco:Act`, `bfo:BFO_0000015` (Process) |
| Severity | WARNING |

**Valid Example:**
```turtle
:john a cco:Person ;
    cco:participates_in :meetingAct .
:meetingAct a cco:Act .
```

**Invalid Example (triggers warning):**
```turtle
:john a cco:Person ;
    cco:participates_in :mary .  # Mary is not an Act
:mary a cco:Person .
```

---

### 9. `cco:occurs_during`

**Description:** Relates a process/act to its temporal extent.

| Property | Value |
|----------|-------|
| Domain | `cco:Act`, `bfo:BFO_0000015` (Process) |
| Range | `cco:TemporalInterval`, `bfo:BFO_0000038` (1D Temporal Region) |
| Severity | WARNING |

---

### 10. `cco:has_start_time`

**Description:** Relates a temporal interval to its start instant.

| Property | Value |
|----------|-------|
| Domain | `cco:TemporalInterval`, `bfo:BFO_0000038` |
| Range | Literal (xsd:dateTime) |
| Severity | WARNING |

---

### 11. `cco:has_end_time`

**Description:** Relates a temporal interval to its end instant.

| Property | Value |
|----------|-------|
| Domain | `cco:TemporalInterval`, `bfo:BFO_0000038` |
| Range | Literal (xsd:dateTime) |
| Severity | WARNING |

---

### 12. `cco:has_measurement_value`

**Description:** Relates a quality measurement to its numeric value.

| Property | Value |
|----------|-------|
| Domain | `cco:QualityMeasurement` |
| Range | Literal (xsd:decimal) |
| Severity | WARNING |

---

### 13. `cco:uses_measurement_unit`

**Description:** Relates a quality measurement to its unit.

| Property | Value |
|----------|-------|
| Domain | `cco:QualityMeasurement` |
| Range | `cco:MeasurementUnit` |
| Severity | WARNING |

---

### 14. `cco:is_measured_by`

**Description:** Relates a quality to its measurement.

| Property | Value |
|----------|-------|
| Domain | `bfo:BFO_0000019` (Quality), `cco:Quality` |
| Range | `cco:QualityMeasurement` |
| Severity | WARNING |

---

## Recognized CCO Classes

The following CCO classes are recognized by OntoGrade vocabulary validation:

### Agents and Persons
- `cco:Person`
- `cco:Agent`
- `cco:Organization`

### Roles
- `cco:Role`
- `cco:ResidentRole`
- `cco:StudentRole`
- `cco:EmployeeRole`

### Information Content Entities
- `cco:InformationContentEntity`
- `cco:DesignativeInformationContentEntity`
- `cco:Name`
- `cco:PersonName`
- `cco:Identifier`
- `cco:PostalAddress`

### Information Bearing Entities
- `cco:InformationBearingEntity`
- `cco:InformationBearingArtifact`
- `cco:Document`
- `cco:Record`
- `cco:PersonNameRecord`
- `cco:PostalAddressRecord`

### Artifacts and Facilities
- `cco:Artifact`
- `cco:Site`
- `cco:Facility`
- `cco:House`
- `cco:Building`

### Processes and Acts
- `cco:Act`
- `cco:IntentionalAct`
- `cco:ActOfOccupancy`

### Qualities and Measurements
- `cco:Quality`
- `cco:QualityMeasurement`
- `cco:MeasurementUnit`

### Dispositions and Functions
- `cco:Function`
- `cco:Disposition`

### Temporal
- `cco:TemporalInterval`

---

## Expert Review Questions

1. **Domain Constraints:** Are the domain classes for each predicate correct and complete?

2. **Range Constraints:** Are the range classes for each predicate correct and complete?

3. **Missing Predicates:** Should we add constraints for any other CCO predicates?

4. **Too Strict:** Are any constraints too restrictive for practical use?

5. **Class List:** Should we add more CCO classes to the recognized list?

---

*Reference document for CCO Expert Review - 2026-01-13*
