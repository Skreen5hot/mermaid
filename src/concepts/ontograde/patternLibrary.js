/**
 * @module patternLibrary
 * @description Pattern Library data module containing metadata for all CCO design patterns.
 * This module provides pattern definitions used by both the SHACL validator and the
 * Pattern Library UI browser.
 *
 * Expert Review Status: Approved 2026-01-09 by CCO/BFO Realist Ontologist
 * See: docs/ontograde/SHACL-VALIDATION-REVIEW.md
 */

// Pattern categories for filtering
export const PATTERN_CATEGORIES = {
  CORE: 'core',
  TEMPORAL: 'temporal',
  MEASUREMENT: 'measurement',
  AGENT: 'agent',
  ARTIFACT: 'artifact',
  EVENT: 'event',
};

// Pattern status (active = validated, draft = pending expert review)
export const PATTERN_STATUS = {
  ACTIVE: 'active',
  DRAFT: 'draft',
};

// Severity levels aligned with SHACL
export const SEVERITY = {
  VIOLATION: 'violation',
  WARNING: 'warning',
  INFO: 'info',
};

/**
 * Pattern Library - All CCO Design Patterns
 *
 * Each pattern contains:
 * - id: Unique identifier for the pattern
 * - name: Human-readable name
 * - category: Category for filtering (CORE, TEMPORAL, etc.)
 * - status: ACTIVE (validated) or DRAFT (pending review)
 * - description: Short description of the pattern
 * - fullDescription: Detailed explanation for the Pattern Library modal
 * - structure: ASCII/text diagram showing the pattern structure
 * - bfoRationale: Explanation of BFO/CCO principles behind the pattern
 * - rules: Array of validation rules with severity and explanations
 * - examples: Correct and incorrect implementation examples
 * - relatedPatterns: IDs of related patterns
 * - ccoReference: Link to CCO documentation (if available)
 */
export const PATTERNS = {
  'information-staircase': {
    id: 'information-staircase',
    name: 'Information Staircase',
    category: PATTERN_CATEGORIES.CORE,
    status: PATTERN_STATUS.ACTIVE,
    description: 'Information Content Entities must be concretized in Information Bearing Entities with text values.',
    fullDescription: `The Information Staircase pattern is fundamental to CCO's treatment of information.
It distinguishes between abstract information content (ICE) and its physical manifestations (IBE).

An Information Content Entity (ICE) represents the semantic content - the "meaning" or "information"
that can exist in multiple forms. An Information Bearing Entity (IBE) is a physical artifact that
bears or carries that information (like a document, sign, or digital file).

The key insight is that the same ICE can be concretized in multiple IBEs. For example, the text of
a contract (ICE) can exist on paper, on a computer screen, and in a database simultaneously.`,
    structure: `InformationContentEntity (ICE)
  └── is_concretized_by → InformationBearingEntity (IBE)
        └── has_text_value → xsd:string`,
    bfoRationale: `ICEs are Generically Dependent Continuants (GDC) in BFO. Unlike Specifically Dependent
Continuants, GDCs can exist without being concretized in a specific bearer at all times. This is why
the validation severity is WARNING rather than VIOLATION - an ICE can exist "abstractly" before being
concretized, but for practical modeling purposes, every ICE should eventually be concretized somewhere.`,
    rules: [
      {
        id: 'ice-concretization',
        name: 'ICE must have concretization',
        severity: SEVERITY.WARNING,
        what: 'Checks for ICE → is_concretized_by → IBE relationship',
        why: 'For practical modeling, information content should have at least one physical manifestation',
        impact: 'Without concretization, the information has no physical grounding in the model',
        fix: 'Add an is_concretized_by relationship from the ICE to an InformationBearingEntity',
      },
      {
        id: 'ibe-type-check',
        name: 'Concretization target must be IBE',
        severity: SEVERITY.WARNING,
        what: 'Validates that is_concretized_by target is typed as InformationBearingEntity',
        why: 'Only IBEs can bear information content per CCO',
        impact: 'Incorrect typing violates CCO semantics',
        fix: 'Ensure the target entity has rdf:type cco:InformationBearingEntity',
      },
    ],
    examples: {
      correct: {
        title: 'Contract with Document',
        mermaid: `graph TD
ICE_0["Contract<br>IRI: cco:InformationContentEntity"]
IBE_0["Contract Document<br>IRI: cco:InformationBearingEntity"]
ICE_0 -->|"is concretized by<br>IRI: cco:is_concretized_by"| IBE_0`,
        description: 'The contract (abstract content) is concretized in a physical document. Note: has_text_value literal edges are validated but not shown in Mermaid diagrams.',
      },
      violations: [
        {
          title: 'Missing Concretization',
          mermaid: `graph TD
ICE_0["Contract<br>IRI: cco:InformationContentEntity"]`,
          error: 'InformationContentEntity has no concretization',
          scoreImpact: -0.4,
        },
      ],
    },
    relatedPatterns: ['designation-pattern'],
    ccoReference: 'https://github.com/CommonCoreOntology/CommonCoreOntologies/wiki/InformationEntities',
    testCount: 6,
  },

  'role-pattern': {
    id: 'role-pattern',
    name: 'Role Pattern',
    category: PATTERN_CATEGORIES.CORE,
    status: PATTERN_STATUS.ACTIVE,
    description: 'Roles must have bearers (entities) and may be realized by processes.',
    fullDescription: `The Role Pattern captures how dispositional properties (roles) relate to their
bearers and realizations. A Role is something that an entity can have - like "Employee Role" or
"Student Role" - which may or may not be actively exercised at any given time.

Key distinction: A role MUST have a bearer (the entity that has the role), but does NOT need to
be realized (actively exercised) to exist. This reflects the BFO principle that dispositions
(including roles) can remain dormant.

For example, a "Reserve Pilot Role" exists even if the pilot never flies. The role is borne by
the person, even without any realization event.`,
    structure: `IndependentContinuant (Entity)
  └── is_bearer_of → Role
                       ↑ realizes (optional)
                     Process`,
    bfoRationale: `Roles are Specifically Dependent Continuants (SDC) in BFO. SDCs CANNOT exist without
their bearers - this is the principle of Specific Dependence. A role must inhere in something.

However, roles (as dispositions) follow the "Realization Fallacy" principle: just because a
disposition exists doesn't mean it must be realized. An unrealized role is still a valid role.

This is why bearer is VIOLATION (must exist) but realization is WARNING (should exist but not required).`,
    rules: [
      {
        id: 'role-bearer-required',
        name: 'Every Role must have a bearer',
        severity: SEVERITY.VIOLATION,
        what: 'Checks for Entity → is_bearer_of → Role relationship (inverse path)',
        why: 'Roles are specifically dependent continuants that CANNOT exist without bearers per BFO',
        impact: 'Without a bearer, the role has no ontological grounding - it cannot exist',
        fix: 'Add an is_bearer_of relationship from an IndependentContinuant to this Role',
      },
      {
        id: 'role-bearer-type',
        name: 'Bearer must be IndependentContinuant',
        severity: SEVERITY.WARNING,
        what: 'Validates that the bearer is a subclass of bfo:IndependentContinuant',
        why: 'Only independent continuants can bear roles per BFO category constraints',
        impact: 'Incorrect bearer type violates BFO category rules',
        fix: 'Ensure bearer entity has rdf:type that is a subclass of bfo:IndependentContinuant',
      },
      {
        id: 'role-realization',
        name: 'Role should have a realization',
        severity: SEVERITY.WARNING,
        what: 'Checks for Process → realizes → Role relationship (inverse path)',
        why: 'While roles can exist unrealized, complete models typically show role actualization',
        impact: 'Without realization, the role remains abstract (valid but incomplete)',
        fix: 'Add a realizes relationship from a Process to this Role',
      },
      {
        id: 'role-realizer-type',
        name: 'Realizer must be Process',
        severity: SEVERITY.WARNING,
        what: 'Validates that the realizer is a subclass of bfo:Process',
        why: 'Only processes can realize dispositions/roles per BFO',
        impact: 'Incorrect realizer type violates BFO category rules',
        fix: 'Ensure realizer has rdf:type that is a subclass of bfo:Process',
      },
    ],
    examples: {
      correct: {
        title: 'Employee with Work Process',
        mermaid: `graph TD
Person_0["Person<br>IRI: cco:Person"]
Role_0["EmployeeRole<br>IRI: cco:OccupationRole"]
Process_0["WorkProcess<br>IRI: cco:ActOfEmployment"]
Person_0 -->|"is bearer of<br>IRI: cco:is_bearer_of"| Role_0
Process_0 -->|"realizes<br>IRI: cco:realizes"| Role_0`,
        description: 'A Person bears an EmployeeRole which is realized by a WorkProcess.',
      },
      violations: [
        {
          title: 'Missing Bearer',
          mermaid: `graph TD
Role_0["EmployeeRole<br>IRI: cco:OccupationRole"]
Process_0["WorkProcess<br>IRI: cco:ActOfEmployment"]
Process_0 -->|"realizes<br>IRI: cco:realizes"| Role_0`,
          error: 'Role has no bearer - ontologically invalid',
          scoreImpact: -0.8,
        },
        {
          title: 'Missing Realization (Warning)',
          mermaid: `graph TD
Person_0["Person<br>IRI: cco:Person"]
Role_0["EmployeeRole<br>IRI: cco:OccupationRole"]
Person_0 -->|"is bearer of<br>IRI: cco:is_bearer_of"| Role_0`,
          error: 'Role not realized by any process (warning only)',
          scoreImpact: -0.4,
        },
      ],
    },
    relatedPatterns: ['agent-capability', 'artifact-function'],
    ccoReference: 'https://github.com/CommonCoreOntology/CommonCoreOntologies/wiki/Roles',
    testCount: 8,
  },

  'designation-pattern': {
    id: 'designation-pattern',
    name: 'Designation Pattern',
    category: PATTERN_CATEGORIES.CORE,
    status: PATTERN_STATUS.ACTIVE,
    description: 'Designative ICEs (names, identifiers) must designate something.',
    fullDescription: `The Designation Pattern ensures that naming/identification relationships are
properly modeled. A Designative Information Content Entity is a special kind of ICE that serves
to name or identify something - like a person's name, a product code, or a serial number.

The key principle: A name that names nothing is not truly a Designative ICE. If you have a
DesignativeInformationContentEntity, it MUST be connected to the entity it designates.`,
    structure: `Entity
  ↔ is_designated_by / designates ↔
    DesignativeInformationContentEntity`,
    bfoRationale: `A DesignativeICE is defined by its function of designating something. Without the
designation relationship, it's just generic information content, not designative content.

This is why the validation is VIOLATION severity - a DesignativeICE without a designation target
is semantically invalid in CCO.`,
    rules: [
      {
        id: 'designation-link-required',
        name: 'Designative ICE must designate something',
        severity: SEVERITY.VIOLATION,
        what: 'Checks for either designates → Entity OR Entity → is_designated_by → DesignativeICE',
        why: 'A name must name something to be a Designative Information Content Entity',
        impact: 'Without a designation target, the entity should not be typed as DesignativeICE',
        fix: 'Add a designates or is_designated_by relationship linking the name to what it names',
      },
    ],
    examples: {
      correct: {
        title: 'Person with Name',
        mermaid: `graph TD
Person_0["John Smith<br>IRI: cco:Person"]
Name_0["John Smith Name<br>IRI: cco:DesignativeInformationContentEntity"]
Name_0 -->|"designates<br>IRI: cco:designates"| Person_0`,
        description: 'The name ICE properly designates the Person it names.',
      },
      violations: [
        {
          title: 'Orphan Name',
          mermaid: `graph TD
Name_0["John Smith Name<br>IRI: cco:DesignativeInformationContentEntity"]`,
          error: 'DesignativeInformationContentEntity does not designate anything',
          scoreImpact: -0.8,
        },
      ],
    },
    relatedPatterns: ['information-staircase'],
    ccoReference: 'https://github.com/CommonCoreOntology/CommonCoreOntologies/wiki/DesignativeICE',
    testCount: 4,
  },

  'measurement-pattern': {
    id: 'measurement-pattern',
    name: 'Measurement Pattern',
    category: PATTERN_CATEGORIES.MEASUREMENT,
    status: PATTERN_STATUS.ACTIVE,
    description: 'Quality measurements require a value, unit, and measured quality.',
    fullDescription: `The Measurement Pattern captures how qualities are measured and recorded.
A complete measurement has three essential components:

1. **Measurement Value**: The numeric result of the measurement
2. **Measurement Unit**: The unit of measurement (meters, kilograms, etc.)
3. **Measured Quality**: The quality being measured (length, mass, temperature, etc.)

All three components are required for a semantically complete measurement. A value without a
unit is meaningless; a unit without a value is empty; and both are incomplete without knowing
what quality was measured.`,
    structure: `InformationContentEntity (Measurement ICE)
  ├── has_decimal_value → xsd:decimal
  ├── uses_measurement_unit → MeasurementUnit
  └── is_measurement_of → Quality`,
    bfoRationale: `In CCO, measurements are modeled as Information Content Entities that are
"about" qualities. The measurement itself is information content, while the quality being
measured is a dependent continuant that inheres in a material entity.

This three-part structure reflects the semantic requirements: you can't have a meaningful
measurement without knowing what was measured (Quality), what the result was (Value), and
how to interpret it (Unit).`,
    rules: [
      {
        id: 'measurement-value-required',
        name: 'Measurement must have a value',
        severity: SEVERITY.VIOLATION,
        what: 'Checks for has_decimal_value relationship to xsd:decimal',
        why: 'A measurement without a value is semantically incomplete',
        impact: 'Without a value, the measurement records nothing',
        fix: 'Add a has_decimal_value property with the numeric measurement result',
      },
      {
        id: 'measurement-unit-required',
        name: 'Measurement must have a unit',
        severity: SEVERITY.VIOLATION,
        what: 'Checks for uses_measurement_unit relationship to MeasurementUnit',
        why: 'A numeric value without units is meaningless (5 of what?)',
        impact: 'Without units, the measurement cannot be interpreted',
        fix: 'Add a uses_measurement_unit relationship to the appropriate MeasurementUnit',
      },
      {
        id: 'measurement-quality-required',
        name: 'Measurement must specify what was measured',
        severity: SEVERITY.VIOLATION,
        what: 'Checks for is_measurement_of relationship to a Quality',
        why: 'Every measurement measures some quality (length, mass, time, etc.)',
        impact: 'Without knowing what quality, the measurement lacks semantic context',
        fix: 'Add an is_measurement_of relationship to the Quality being measured',
      },
    ],
    examples: {
      correct: {
        title: 'Mass Measurement',
        mermaid: `graph TD
Measurement_0["Mass Reading<br>IRI: cco:MeasurementInformationContentEntity"]
Quality_0["Mass Quality<br>IRI: cco:Mass"]
Unit_0["Mass Unit<br>IRI: cco:MeasurementUnitOfMass"]
Measurement_0 -->|"uses measurement unit<br>IRI: cco:uses_measurement_unit"| Unit_0
Measurement_0 -->|"is a measurement of<br>IRI: cco:is_a_measurement_of"| Quality_0`,
        description: 'A complete measurement with unit and quality. Note: has_measurement_value literal is validated but not shown in Mermaid diagrams.',
      },
      violations: [
        {
          title: 'Missing Unit',
          mermaid: `graph TD
Measurement_0["Mass Reading<br>IRI: cco:MeasurementInformationContentEntity"]
Quality_0["Mass Quality<br>IRI: cco:Mass"]
Measurement_0 -->|"is a measurement of<br>IRI: cco:is_a_measurement_of"| Quality_0`,
          error: 'Measurement has no unit - value is uninterpretable',
          scoreImpact: -0.8,
        },
      ],
    },
    relatedPatterns: ['temporal-interval'],
    ccoReference: 'https://github.com/CommonCoreOntology/CommonCoreOntologies/wiki/Measurements',
    testCount: 6,
  },

  'temporal-interval': {
    id: 'temporal-interval',
    name: 'Temporal Interval Pattern',
    category: PATTERN_CATEGORIES.TEMPORAL,
    status: PATTERN_STATUS.ACTIVE,
    description: 'Temporal intervals must have valid start/end times with proper ordering.',
    fullDescription: `The Temporal Interval Pattern validates temporal structures in the ontology.
Time intervals are fundamental to modeling processes, events, and states that occur over time.

A well-formed temporal interval should have:
1. A start instant (when the interval begins)
2. An end instant (when the interval ends)
3. Proper ordering (start must not be after end)

The time ordering constraint is a VIOLATION because it represents a logical impossibility -
an interval cannot start after it ends.`,
    structure: `TemporalInterval
  ├── has_starting_instant → TemporalInstant (time value)
  └── has_ending_instant → TemporalInstant (time value)

Constraint: start_time ≤ end_time`,
    bfoRationale: `In BFO, temporal regions are a fundamental category. Temporal intervals (a type
of temporal region) have boundaries - instants that mark their beginning and end.

The ordering constraint reflects a logical necessity: an interval with reversed times would
describe a situation that cannot exist in reality. This is why it's a VIOLATION severity.`,
    rules: [
      {
        id: 'temporal-start-time',
        name: 'Temporal interval should have start time',
        severity: SEVERITY.WARNING,
        what: 'Checks for has_starting_instant relationship',
        why: 'Complete temporal modeling requires knowing when intervals begin',
        impact: 'Without start time, the interval has incomplete temporal grounding',
        fix: 'Add has_starting_instant relationship with a time value',
      },
      {
        id: 'temporal-end-time',
        name: 'Temporal interval should have end time',
        severity: SEVERITY.WARNING,
        what: 'Checks for has_ending_instant relationship',
        why: 'Complete temporal modeling requires knowing when intervals end',
        impact: 'Without end time, the interval may represent an ongoing or incomplete event',
        fix: 'Add has_ending_instant relationship with a time value',
      },
      {
        id: 'temporal-ordering',
        name: 'Start time must not be after end time',
        severity: SEVERITY.VIOLATION,
        what: 'Validates that start_time ≤ end_time when both are present',
        why: 'Temporal backwardness is logically and ontologically impossible',
        impact: 'Reversed times represent an impossible state of affairs',
        fix: 'Correct the time values so that start precedes or equals end',
      },
    ],
    examples: {
      correct: {
        title: 'Meeting Duration',
        mermaid: `graph TD
TI_0["Team Meeting<br>IRI: cco:TemporalInterval"]
Start_0["9:00 AM<br>IRI: cco:TemporalInstant"]
End_0["10:00 AM<br>IRI: cco:TemporalInstant"]
TI_0 -->|"has starting instant<br>IRI: cco:has_starting_instant"| Start_0
TI_0 -->|"has ending instant<br>IRI: cco:has_ending_instant"| End_0`,
        description: 'A temporal interval with properly ordered start and end instants.',
      },
      violations: [
        {
          title: 'Backwards Time',
          mermaid: `graph TD
TI_0["Team Meeting<br>IRI: cco:TemporalInterval"]
Start_0["10:00 AM<br>IRI: cco:TemporalInstant"]
End_0["9:00 AM<br>IRI: cco:TemporalInstant"]
TI_0 -->|"has starting instant<br>IRI: cco:has_starting_instant"| Start_0
TI_0 -->|"has ending instant<br>IRI: cco:has_ending_instant"| End_0`,
          error: 'Start time is after end time - logically impossible',
          scoreImpact: -0.8,
        },
      ],
    },
    relatedPatterns: ['socio-primal'],
    ccoReference: 'https://github.com/CommonCoreOntology/CommonCoreOntologies/wiki/TemporalEntities',
    testCount: 5,
  },

  'socio-primal': {
    id: 'socio-primal',
    name: 'Socio-Primal Pattern',
    category: PATTERN_CATEGORIES.AGENT,
    status: PATTERN_STATUS.ACTIVE,
    description: 'Acts should have participating agents and temporal grounding.',
    fullDescription: `The Socio-Primal Pattern captures the fundamental structure of social reality
in CCO: Agents participate in Acts that occupy specific Temporal Intervals.

This pattern is the foundation for modeling any social or organizational activity. Acts
(processes involving intentional agents) don't happen in a vacuum - they have participants
and they occur at specific times.

While not strictly required (hence WARNING severity), complete modeling of social reality
should always include:
1. Who participated (has_agent/has_participant)
2. When it happened (occupies_temporal_interval)`,
    structure: `Act (bfo:Process)
  ├── has_agent → Agent
  ├── has_participant → Entity (optional additional participants)
  └── occupies_temporal_interval → TemporalInterval`,
    bfoRationale: `In CCO, Acts are a subclass of BFO Process that specifically involve intentional
agents. The Socio-Primal pattern captures the expert recommendation that "social reality is
captured through the participation of Agents in Acts that occupy a specific Temporal Interval."

This is WARNING severity because:
- Acts can be modeled incompletely during early development
- Some abstract Act types might not have specific participants yet
- Temporal grounding might be unknown or irrelevant for some use cases`,
    rules: [
      {
        id: 'act-agent-participation',
        name: 'Act should have agent participation',
        severity: SEVERITY.WARNING,
        what: 'Checks for has_agent or has_participant relationship',
        why: 'Acts typically involve agents who perform or participate in them',
        impact: 'Without participants, the act is abstractly defined but not grounded',
        fix: 'Add has_agent relationship from the Act to participating Agents',
      },
      {
        id: 'act-temporal-grounding',
        name: 'Act should have temporal grounding',
        severity: SEVERITY.WARNING,
        what: 'Checks for occupies_temporal_interval relationship',
        why: 'Processes occur in time; temporal context is often important',
        impact: 'Without temporal grounding, the act lacks situational context',
        fix: 'Add occupies_temporal_interval relationship to a TemporalInterval',
      },
    ],
    examples: {
      correct: {
        title: 'Business Meeting',
        mermaid: `graph TD
Meeting_0["Planning Meeting<br>IRI: cco:ActOfCommunication"]
Person_0["Manager<br>IRI: cco:Person"]
Group_0["Team Members<br>IRI: cco:GroupOfAgents"]
TI_0["Meeting Time<br>IRI: cco:TemporalInterval"]
Meeting_0 -->|"has agent<br>IRI: cco:has_agent"| Person_0
Meeting_0 -->|"has participant<br>IRI: bfo:BFO_0000057"| Group_0
Meeting_0 -->|"occupies temporal region<br>IRI: bfo:BFO_0000199"| TI_0`,
        description: 'An Act with agent participation and temporal grounding.',
      },
      violations: [
        {
          title: 'Orphan Act',
          mermaid: `graph TD
Meeting_0["Planning Meeting<br>IRI: cco:ActOfCommunication"]`,
          error: 'Act has no agent participation or temporal grounding (warnings)',
          scoreImpact: -0.4,
        },
      ],
    },
    relatedPatterns: ['role-pattern', 'temporal-interval'],
    ccoReference: 'https://github.com/CommonCoreOntology/CommonCoreOntologies/wiki/Acts',
    testCount: 4,
  },
};

// ============================================================================
// DRAFT PATTERNS - Pending Expert Review
// ============================================================================
// These patterns are defined but not yet validated by the CCO expert.
// They are NOT included in the PATTERNS export but can be activated later.
// ============================================================================

export const DRAFT_PATTERNS = {
  'artifact-function': {
    id: 'artifact-function',
    name: 'Artifact Function Pattern',
    category: PATTERN_CATEGORIES.ARTIFACT,
    status: PATTERN_STATUS.DRAFT,
    description: 'Artifacts have designed functions that may be realized by processes.',
    fullDescription: `Artifacts are material entities created by intentional agents for specific
purposes. The Artifact Function pattern captures the relationship between an artifact and
its designed function.

Note: Expert review needed to determine if every Artifact must have a function, or if this
should be a warning for completeness.`,
    structure: `Artifact
  └── has_function → ArtifactFunction
                       ↑ is_realized_by (optional)
                     Process`,
    bfoRationale: 'Pending expert review.',
    rules: [
      {
        id: 'artifact-function-link',
        name: 'Artifact should have a function',
        severity: SEVERITY.WARNING,
        what: 'Checks for has_function relationship',
        why: 'Artifacts are defined by their intended purpose/function',
        impact: 'Without a function, the artifact lacks its defining characteristic',
        fix: 'Add has_function relationship to an ArtifactFunction',
      },
    ],
    examples: {
      correct: {
        title: 'Hammer Tool',
        mermaid: `graph TD
Artifact_0["Hammer<br>IRI: cco:Artifact"]
Function_0["Striking Function<br>IRI: cco:ArtifactFunction"]
Artifact_0 -->|"has function<br>IRI: cco:has_function"| Function_0`,
        description: 'An artifact with its designed function.',
      },
      violations: [],
    },
    relatedPatterns: ['role-pattern'],
    ccoReference: null,
    testCount: 0,
  },

  'agent-capability': {
    id: 'agent-capability',
    name: 'Agent Capability Pattern',
    category: PATTERN_CATEGORIES.AGENT,
    status: PATTERN_STATUS.DRAFT,
    description: 'Agents have capabilities that may be realized in acts.',
    fullDescription: `Agents have capabilities - dispositional properties that enable them to
perform certain acts. This pattern captures the relationship between agents and their
inherent abilities.`,
    structure: `Agent
  └── has_capability → Capability
                         ↑ is_realized_in (optional)
                       Act`,
    bfoRationale: 'Pending expert review.',
    rules: [],
    examples: {
      correct: {
        title: 'Person with Skill',
        mermaid: `graph TD
Person_0["Carpenter<br>IRI: cco:Person"]
Capability_0["Woodworking Skill<br>IRI: cco:AgentCapability"]
Person_0 -->|"has capability<br>IRI: cco:has_capability"| Capability_0`,
        description: 'An agent with a capability.',
      },
      violations: [],
    },
    relatedPatterns: ['role-pattern', 'socio-primal'],
    ccoReference: null,
    testCount: 0,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all active patterns
 * @returns {Object[]} Array of active pattern objects
 */
export function getActivePatterns() {
  return Object.values(PATTERNS).filter(p => p.status === PATTERN_STATUS.ACTIVE);
}

/**
 * Get all draft patterns
 * @returns {Object[]} Array of draft pattern objects
 */
export function getDraftPatterns() {
  return Object.values(DRAFT_PATTERNS);
}

/**
 * Get all patterns (active and draft)
 * @returns {Object[]} Array of all pattern objects
 */
export function getAllPatterns() {
  return [...Object.values(PATTERNS), ...Object.values(DRAFT_PATTERNS)];
}

/**
 * Get a pattern by ID
 * @param {string} patternId - The pattern ID
 * @returns {Object|null} The pattern object or null if not found
 */
export function getPatternById(patternId) {
  return PATTERNS[patternId] || DRAFT_PATTERNS[patternId] || null;
}

/**
 * Get patterns by category
 * @param {string} category - The category to filter by
 * @returns {Object[]} Array of matching pattern objects
 */
export function getPatternsByCategory(category) {
  return getAllPatterns().filter(p => p.category === category);
}

/**
 * Get pattern counts by category
 * @returns {Object} Map of category to count
 */
export function getPatternCountsByCategory() {
  const counts = {};
  for (const cat of Object.values(PATTERN_CATEGORIES)) {
    counts[cat] = getPatternsByCategory(cat).length;
  }
  return counts;
}

/**
 * Search patterns by name or description
 * @param {string} query - Search query
 * @returns {Object[]} Array of matching pattern objects
 */
export function searchPatterns(query) {
  const lowerQuery = query.toLowerCase();
  return getAllPatterns().filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    p.description.toLowerCase().includes(lowerQuery)
  );
}

// Default export for convenience
export default {
  PATTERNS,
  DRAFT_PATTERNS,
  PATTERN_CATEGORIES,
  PATTERN_STATUS,
  SEVERITY,
  getActivePatterns,
  getDraftPatterns,
  getAllPatterns,
  getPatternById,
  getPatternsByCategory,
  getPatternCountsByCategory,
  searchPatterns,
};
