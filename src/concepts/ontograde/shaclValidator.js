/**
 * @module shaclValidator
 * @description Validates CCO patterns aligned with expert-approved SHACL shapes
 *
 * Expert Review Status: ✅ APPROVED (2026-01-09)
 * Patterns are compliant with BFO/CCO standards per CCO/BFO Realist Ontologist review.
 *
 * Key BFO Principles Applied:
 * 1. The Realization Fallacy: Dispositions exist even if never realized
 * 2. Bearer Necessity: Roles cannot exist without bearers
 * 3. Open World vs Design: ICE can exist abstractly but concretization expected
 *
 * @see docs/ontograde/SHACL-VALIDATION-REVIEW.md
 * @see src/ontologies/ontograde-shapes.ttl
 */

import { isCCOClass } from '../../ontologies/cco-bfo-mapping.ttl.js';

// CCO/BFO IRIs
const CCO = 'http://www.ontologyrepository.com/CommonCoreOntologies/';
const BFO = 'http://purl.obolibrary.org/obo/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

// CCO Classes
const CCO_CLASSES = {
  InformationContentEntity: `${CCO}InformationContentEntity`,
  InformationBearingEntity: `${CCO}InformationBearingEntity`,
  DesignativeInformationContentEntity: `${CCO}DesignativeInformationContentEntity`,
  Role: `${CCO}Role`,
  Act: `${CCO}Act`,
  Agent: `${CCO}Agent`,
  TemporalInterval: `${CCO}TemporalInterval`,
  QualityMeasurement: `${CCO}QualityMeasurement`,
  MeasurementUnit: `${CCO}MeasurementUnit`,
};

// BFO Classes (for type validation)
const BFO_CLASSES = {
  IndependentContinuant: `${BFO}BFO_0000004`,
  Process: `${BFO}BFO_0000015`,
  Quality: `${BFO}BFO_0000019`,
};

// CCO Properties
const CCO_PROPS = {
  is_concretized_by: `${CCO}is_concretized_by`,
  concretizes: `${CCO}concretizes`,
  has_text_value: `${CCO}has_text_value`,
  is_bearer_of: `${CCO}is_bearer_of`,
  realizes: `${CCO}realizes`,
  designates: `${CCO}designates`,
  is_designated_by: `${CCO}is_designated_by`,
  participates_in: `${CCO}participates_in`,
  occurs_during: `${CCO}occurs_during`,
  has_start_time: `${CCO}has_start_time`,
  has_end_time: `${CCO}has_end_time`,
  has_measurement_value: `${CCO}has_measurement_value`,
  uses_measurement_unit: `${CCO}uses_measurement_unit`,
  is_measured_by: `${CCO}is_measured_by`,
};

// Severity levels aligned with SHACL
const SEVERITY = {
  VIOLATION: 'violation', // Must be fixed - ontologically impossible otherwise
  WARNING: 'warning',     // Should be addressed - incomplete but valid
  INFO: 'info',           // Suggestion - nice to have
};

const subscribers = new Set();

/**
 * Notifies all subscribed listeners of an event.
 * @param {string} event - The name of the event.
 * @param {*} payload - The data associated with the event.
 */
function notify(event, payload) {
  for (const subscriber of subscribers) {
    subscriber(event, payload);
  }
}

export const shaclValidator = {
  state: {
    violations: [], // Array of pattern violations
    complianceScore: 0, // 0-100 percentage
    validationResults: new Map(), // diagramId -> result
  },

  actions: {
    /**
     * Validates CCO patterns in the RDF graph
     * @param {Object} params
     * @param {string} params.diagramId - Diagram identifier
     * @param {Store} params.rdfGraph - N3 Store with user's RDF triples
     */
    validatePatterns({ diagramId, rdfGraph }) {
      try {
        console.log(`[shaclValidator] Validating CCO patterns for diagram ${diagramId}...`);

        const result = shaclValidator.helpers.checkPatterns(rdfGraph);

        shaclValidator.state.violations = result.violations;
        shaclValidator.state.complianceScore = result.complianceScore;
        shaclValidator.state.validationResults.set(diagramId, result);

        console.log(`[shaclValidator] Pattern validation complete:`);
        console.log(`  - Total patterns checked: ${result.totalChecks}`);
        console.log(`  - Violations: ${result.violations.length}`);
        console.log(`  - Compliance score: ${result.complianceScore}%`);

        notify('patternsValidated', { diagramId, result });
      } catch (error) {
        console.error(`[shaclValidator] Validation failed:`, error);

        const errorResult = {
          pass: false,
          error: error.message,
          userMessage: shaclValidator.helpers.getUserFriendlyMessage(error),
        };

        shaclValidator.state.validationResults.set(diagramId, errorResult);
        notify('patternsValidationFailed', { diagramId, error: errorResult });
      }
    },
  },

  helpers: {
    /**
     * Checks all CCO patterns in the RDF graph
     * Patterns aligned with expert-approved SHACL shapes (2026-01-09)
     *
     * @param {Store} rdfGraph - N3 Store with user's RDF triples
     * @returns {Object} Validation result
     */
    checkPatterns(rdfGraph) {
      const issues = []; // violations and warnings
      const patternsChecked = [];

      // Pattern 1: Information Staircase (ICE/IBE)
      const staircaseResult = shaclValidator.helpers.checkInformationStaircase(rdfGraph);
      issues.push(...staircaseResult.issues);
      if (staircaseResult.entitiesChecked > 0) {
        patternsChecked.push('Information Staircase');
      }

      // Pattern 2: Role Pattern
      const roleResult = shaclValidator.helpers.checkRolePattern(rdfGraph);
      issues.push(...roleResult.issues);
      if (roleResult.entitiesChecked > 0) {
        patternsChecked.push('Role Pattern');
      }

      // Pattern 3: Designation Pattern
      const designationResult = shaclValidator.helpers.checkDesignationPattern(rdfGraph);
      issues.push(...designationResult.issues);
      if (designationResult.entitiesChecked > 0) {
        patternsChecked.push('Designation Pattern');
      }

      // Pattern 4: Temporal Interval Pattern
      const temporalResult = shaclValidator.helpers.checkTemporalIntervalPattern(rdfGraph);
      issues.push(...temporalResult.issues);
      if (temporalResult.entitiesChecked > 0) {
        patternsChecked.push('Temporal Interval Pattern');
      }

      // Pattern 5: Measurement Pattern
      const measurementResult = shaclValidator.helpers.checkMeasurementPattern(rdfGraph);
      issues.push(...measurementResult.issues);
      if (measurementResult.entitiesChecked > 0) {
        patternsChecked.push('Measurement Pattern');
      }

      // Pattern 10: Socio-Primal Pattern (Agent/Act)
      const socioPrimalResult = shaclValidator.helpers.checkSocioPrimalPattern(rdfGraph);
      issues.push(...socioPrimalResult.issues);
      if (socioPrimalResult.entitiesChecked > 0) {
        patternsChecked.push('Socio-Primal Pattern');
      }

      // Separate violations from warnings
      const violations = issues.filter(i => i.severity === SEVERITY.VIOLATION);
      const warnings = issues.filter(i => i.severity === SEVERITY.WARNING);
      const infos = issues.filter(i => i.severity === SEVERITY.INFO);

      // Pass/fail based on violations only (warnings don't fail validation)
      const pass = violations.length === 0;

      // Calculate compliance score
      // Violations: -1.0 each, Warnings: -0.3 each, Info: -0.1 each
      const maxScore = 100;
      const violationPenalty = violations.length * 10;
      const warningPenalty = warnings.length * 3;
      const infoPenalty = infos.length * 1;
      const complianceScore = Math.max(0, Math.round(maxScore - violationPenalty - warningPenalty - infoPenalty));

      return {
        pass,
        violations: issues, // All issues for backwards compatibility
        violationCount: violations.length,
        warningCount: warnings.length,
        infoCount: infos.length,
        totalChecks: patternsChecked.length,
        patternsChecked,
        complianceScore,
        message: violations.length === 0 && warnings.length === 0
          ? 'All CCO patterns are valid'
          : violations.length > 0
            ? `Found ${violations.length} violation(s) and ${warnings.length} warning(s)`
            : `Found ${warnings.length} warning(s) - validation passed`,
      };
    },

    /**
     * Validates the Information Staircase pattern:
     * ICE → is_concretized_by → IBE → has_text_value → Literal
     *
     * EXPERT REVIEW (2026-01-09):
     * - ICE → is_concretized_by: WARNING (ICE can exist abstractly like a Law)
     * - IBE → concretizes: WARNING (blank slate IBE is rarely intended)
     * - IBE → has_text_value: WARNING (completes the staircase)
     *
     * @param {Store} rdfGraph - N3 Store
     * @returns {Object} { issues: Array, entitiesChecked: number }
     */
    checkInformationStaircase(rdfGraph) {
      const issues = [];

      // Find all ICE entities (InformationContentEntity)
      const iceEntities = shaclValidator.helpers.findEntitiesOfType(
        rdfGraph,
        CCO_CLASSES.InformationContentEntity
      );

      // Find all IBE entities (InformationBearingEntity)
      const ibeEntities = shaclValidator.helpers.findEntitiesOfType(
        rdfGraph,
        CCO_CLASSES.InformationBearingEntity
      );

      // Check ICE entities
      for (const iceEntity of iceEntities) {
        const concretizationQuads = rdfGraph.getQuads(iceEntity, CCO_PROPS.is_concretized_by, null, null);

        if (concretizationQuads.length === 0) {
          // EXPERT: WARNING - ICE can exist abstractly (like a Law or Recipe)
          issues.push({
            pattern: 'Information Staircase',
            rule: 'ICE Concretization',
            severity: SEVERITY.WARNING,
            subject: iceEntity,
            message: `ICE ${shaclValidator.helpers.getShortIri(iceEntity)} should have an is_concretized_by relationship to an IBE`,
            explanation: 'While an ICE can exist abstractly (like a Law or Recipe), for practical modeling it should be concretized in a physical bearer.',
            fix: `Add: ${shaclValidator.helpers.getShortIri(iceEntity)} → is_concretized_by → [IBE]`,
          });
          continue;
        }

        // Check if target IBE has has_text_value
        for (const quad of concretizationQuads) {
          const ibeEntity = quad.object.value;
          const textValueQuads = rdfGraph.getQuads(ibeEntity, CCO_PROPS.has_text_value, null, null);

          if (textValueQuads.length === 0) {
            issues.push({
              pattern: 'Information Staircase',
              rule: 'IBE Text Value',
              severity: SEVERITY.WARNING,
              subject: ibeEntity,
              message: `IBE ${shaclValidator.helpers.getShortIri(ibeEntity)} should have a has_text_value relationship`,
              explanation: 'This completes the Information Staircase pattern from abstract information to concrete text.',
              fix: `Add: ${shaclValidator.helpers.getShortIri(ibeEntity)} → has_text_value → "value"`,
            });
          }
        }
      }

      // Check IBE entities for concretizes relationship (inverse check)
      for (const ibeEntity of ibeEntities) {
        const concretizesQuads = rdfGraph.getQuads(ibeEntity, CCO_PROPS.concretizes, null, null);
        const inverseConcretizesQuads = rdfGraph.getQuads(null, CCO_PROPS.is_concretized_by, ibeEntity, null);

        if (concretizesQuads.length === 0 && inverseConcretizesQuads.length === 0) {
          // EXPERT: WARNING - blank slate IBE is rarely intended
          issues.push({
            pattern: 'Information Staircase',
            rule: 'IBE Concretization',
            severity: SEVERITY.WARNING,
            subject: ibeEntity,
            message: `IBE ${shaclValidator.helpers.getShortIri(ibeEntity)} should concretize at least one ICE`,
            explanation: 'An IBE without information is a "blank slate" which is rarely the modeling intent.',
            fix: `Add: ${shaclValidator.helpers.getShortIri(ibeEntity)} → concretizes → [ICE]`,
          });
        }
      }

      return {
        issues,
        entitiesChecked: iceEntities.length + ibeEntities.length,
      };
    },

    /**
     * Validates the Role Pattern:
     * IndependentContinuant → is_bearer_of → Role (REQUIRED)
     * Process → realizes → Role (OPTIONAL)
     *
     * EXPERT REVIEW (2026-01-09):
     * - Bearer: VIOLATION - Role CANNOT exist without bearer (BFO principle)
     * - Realization: WARNING - Dispositions can remain dormant (BFO principle)
     * - Type validation: Bearer must be IndependentContinuant, Realizer must be Process
     *
     * BFO Principle: "A Disposition exists even if never realized. For example,
     * a 'Fire Extinguisher Role' exists even if the extinguisher never puts out
     * a fire. However, a Role CANNOT exist without a bearer."
     *
     * @param {Store} rdfGraph - N3 Store
     * @returns {Object} { issues: Array, entitiesChecked: number }
     */
    checkRolePattern(rdfGraph) {
      const issues = [];

      // Find all Role entities
      const roleEntities = shaclValidator.helpers.findEntitiesOfType(
        rdfGraph,
        CCO_CLASSES.Role
      );

      for (const roleEntity of roleEntities) {
        // Rule 1: Role MUST be borne by at least one entity (VIOLATION)
        const bearerQuads = rdfGraph.getQuads(null, CCO_PROPS.is_bearer_of, roleEntity, null);

        if (bearerQuads.length === 0) {
          // EXPERT: VIOLATION - Role cannot exist without bearer
          issues.push({
            pattern: 'Role Pattern',
            rule: 'Role Bearer',
            severity: SEVERITY.VIOLATION,
            subject: roleEntity,
            message: `Role ${shaclValidator.helpers.getShortIri(roleEntity)} must be borne by at least one entity`,
            explanation: 'In BFO, a Role (Disposition) cannot exist without a bearer - this is ontologically impossible.',
            fix: `Add: [Entity] → is_bearer_of → ${shaclValidator.helpers.getShortIri(roleEntity)}`,
          });
        } else {
          // Type validation: Bearer should be IndependentContinuant
          for (const quad of bearerQuads) {
            const bearerEntity = quad.subject.value;
            if (!shaclValidator.helpers.isInstanceOfBFOClass(rdfGraph, bearerEntity, BFO_CLASSES.IndependentContinuant)) {
              issues.push({
                pattern: 'Role Pattern',
                rule: 'Bearer Type',
                severity: SEVERITY.WARNING,
                subject: bearerEntity,
                message: `Bearer ${shaclValidator.helpers.getShortIri(bearerEntity)} should be an IndependentContinuant`,
                explanation: 'Only independent continuants (Person, Organization, Artifact, etc.) can bear roles per BFO.',
                fix: `Ensure ${shaclValidator.helpers.getShortIri(bearerEntity)} is typed as a subclass of bfo:IndependentContinuant`,
              });
            }
          }
        }

        // Rule 2: Role SHOULD be realized by at least one process (WARNING)
        const realizationQuads = rdfGraph.getQuads(null, CCO_PROPS.realizes, roleEntity, null);

        if (realizationQuads.length === 0) {
          // EXPERT: WARNING - Dispositions can remain dormant
          issues.push({
            pattern: 'Role Pattern',
            rule: 'Role Realization',
            severity: SEVERITY.WARNING,
            subject: roleEntity,
            message: `Role ${shaclValidator.helpers.getShortIri(roleEntity)} is not realized by any Process`,
            explanation: 'While dispositions can remain dormant (per BFO), consider adding a realizes relationship if this role has been actualized.',
            fix: `Add: [Process] → realizes → ${shaclValidator.helpers.getShortIri(roleEntity)}`,
          });
        } else {
          // Type validation: Realizer should be Process
          for (const quad of realizationQuads) {
            const realizerEntity = quad.subject.value;
            if (!shaclValidator.helpers.isInstanceOfBFOClass(rdfGraph, realizerEntity, BFO_CLASSES.Process)) {
              issues.push({
                pattern: 'Role Pattern',
                rule: 'Realizer Type',
                severity: SEVERITY.WARNING,
                subject: realizerEntity,
                message: `Realizer ${shaclValidator.helpers.getShortIri(realizerEntity)} should be a Process`,
                explanation: 'Only processes can realize roles per BFO.',
                fix: `Ensure ${shaclValidator.helpers.getShortIri(realizerEntity)} is typed as a subclass of bfo:Process`,
              });
            }
          }
        }
      }

      return {
        issues,
        entitiesChecked: roleEntities.length,
      };
    },

    /**
     * Validates the Designation Pattern:
     * DesignativeICE → designates → Entity (preferred)
     * OR Entity → is_designated_by → DesignativeICE
     *
     * EXPERT REVIEW (2026-01-09):
     * - VIOLATION: A "Name" that names nothing is not a Designative ICE
     *   in a realist sense; it's just an ICE (Information Content Entity)
     * - Either direction is acceptable for user flexibility
     * - `designates` is the preferred/encouraged direction
     *
     * @param {Store} rdfGraph - N3 Store
     * @returns {Object} { issues: Array, entitiesChecked: number }
     */
    checkDesignationPattern(rdfGraph) {
      const issues = [];

      // Find all DesignativeInformationContentEntity instances
      const designativeEntities = shaclValidator.helpers.findEntitiesOfType(
        rdfGraph,
        CCO_CLASSES.DesignativeInformationContentEntity
      );

      for (const designativeEntity of designativeEntities) {
        // Check if it designates something (preferred) OR something is designated by it
        const designatesQuads = rdfGraph.getQuads(designativeEntity, CCO_PROPS.designates, null, null);
        const designatedByQuads = rdfGraph.getQuads(null, CCO_PROPS.is_designated_by, designativeEntity, null);

        if (designatesQuads.length === 0 && designatedByQuads.length === 0) {
          // EXPERT: VIOLATION - Name that names nothing is not a name
          issues.push({
            pattern: 'Designation Pattern',
            rule: 'Designation Link',
            severity: SEVERITY.VIOLATION,
            subject: designativeEntity,
            message: `DesignativeICE ${shaclValidator.helpers.getShortIri(designativeEntity)} must designate an entity`,
            explanation: 'A "Name" that names nothing is not a Designative ICE in a realist sense - it\'s just an InformationContentEntity.',
            fix: `Add: ${shaclValidator.helpers.getShortIri(designativeEntity)} → designates → [Entity] (preferred) or [Entity] → is_designated_by → ${shaclValidator.helpers.getShortIri(designativeEntity)}`,
          });
        }
      }

      return {
        issues,
        entitiesChecked: designativeEntities.length,
      };
    },

    /**
     * Validates the Temporal Interval Pattern:
     * TemporalInterval → has_start_time → TemporalInstant (WARNING)
     * TemporalInterval → has_end_time → TemporalInstant (WARNING)
     * start_time <= end_time (VIOLATION if backwards)
     *
     * EXPERT REVIEW (2026-01-09):
     * - Start/End times: WARNING (ongoing processes may lack end time)
     * - Time ordering: VIOLATION (backwards time is impossible)
     *
     * @param {Store} rdfGraph - N3 Store
     * @returns {Object} { issues: Array, entitiesChecked: number }
     */
    checkTemporalIntervalPattern(rdfGraph) {
      const issues = [];

      // Find all TemporalInterval entities
      const intervalEntities = shaclValidator.helpers.findEntitiesOfType(
        rdfGraph,
        CCO_CLASSES.TemporalInterval
      );

      for (const intervalEntity of intervalEntities) {
        const startTimeQuads = rdfGraph.getQuads(intervalEntity, CCO_PROPS.has_start_time, null, null);
        const endTimeQuads = rdfGraph.getQuads(intervalEntity, CCO_PROPS.has_end_time, null, null);

        const hasStartTime = startTimeQuads.length > 0;
        const hasEndTime = endTimeQuads.length > 0;

        // Rule 1: Should have start time (WARNING)
        if (!hasStartTime) {
          issues.push({
            pattern: 'Temporal Interval Pattern',
            rule: 'Interval Start Time',
            severity: SEVERITY.WARNING,
            subject: intervalEntity,
            message: `TemporalInterval ${shaclValidator.helpers.getShortIri(intervalEntity)} should have a has_start_time relationship`,
            explanation: 'If the start time is unknown, consider using an approximation or leaving undetermined.',
            fix: `Add: ${shaclValidator.helpers.getShortIri(intervalEntity)} → has_start_time → [TemporalInstant]`,
          });
        }

        // Rule 2: Should have end time (WARNING)
        if (!hasEndTime) {
          issues.push({
            pattern: 'Temporal Interval Pattern',
            rule: 'Interval End Time',
            severity: SEVERITY.WARNING,
            subject: intervalEntity,
            message: `TemporalInterval ${shaclValidator.helpers.getShortIri(intervalEntity)} should have a has_end_time relationship`,
            explanation: 'For ongoing processes, the end time may be left undefined.',
            fix: `Add: ${shaclValidator.helpers.getShortIri(intervalEntity)} → has_end_time → [TemporalInstant]`,
          });
        }

        // Rule 3: Start time must be <= end time (VIOLATION if backwards)
        if (hasStartTime && hasEndTime) {
          const startValue = shaclValidator.helpers.extractTimeValue(startTimeQuads[0].object);
          const endValue = shaclValidator.helpers.extractTimeValue(endTimeQuads[0].object);

          if (startValue && endValue && startValue > endValue) {
            issues.push({
              pattern: 'Temporal Interval Pattern',
              rule: 'Time Ordering',
              severity: SEVERITY.VIOLATION,
              subject: intervalEntity,
              message: `TemporalInterval ${shaclValidator.helpers.getShortIri(intervalEntity)} has end time before start time`,
              explanation: 'Backwards time intervals are logically/ontologically impossible.',
              fix: 'Swap the start and end time values or correct the timestamps',
            });
          }
        }
      }

      return {
        issues,
        entitiesChecked: intervalEntities.length,
      };
    },

    /**
     * Validates the Measurement Pattern:
     * Quality → is_measured_by → QualityMeasurement (VIOLATION)
     * QualityMeasurement → has_measurement_value → xsd:decimal (VIOLATION)
     * QualityMeasurement → uses_measurement_unit → MeasurementUnit (VIOLATION)
     *
     * EXPERT REVIEW (2026-01-09):
     * - All three components (Value, Unit, Quality) are REQUIRED
     * - Severity: VIOLATION for all rules
     *
     * @param {Store} rdfGraph - N3 Store
     * @returns {Object} { issues: Array, entitiesChecked: number }
     */
    checkMeasurementPattern(rdfGraph) {
      const issues = [];

      // Find all QualityMeasurement entities
      const measurementEntities = shaclValidator.helpers.findEntitiesOfType(
        rdfGraph,
        CCO_CLASSES.QualityMeasurement
      );

      for (const measurementEntity of measurementEntities) {
        // Rule 1: Must be linked to a Quality (via inverse is_measured_by)
        const qualityQuads = rdfGraph.getQuads(null, CCO_PROPS.is_measured_by, measurementEntity, null);

        if (qualityQuads.length === 0) {
          issues.push({
            pattern: 'Measurement Pattern',
            rule: 'Measurement Target',
            severity: SEVERITY.VIOLATION,
            subject: measurementEntity,
            message: `QualityMeasurement ${shaclValidator.helpers.getShortIri(measurementEntity)} must be linked to a Quality`,
            explanation: 'A measurement without a target quality is meaningless.',
            fix: `Add: [Quality] → is_measured_by → ${shaclValidator.helpers.getShortIri(measurementEntity)}`,
          });
        }

        // Rule 2: Must have a numeric value
        const valueQuads = rdfGraph.getQuads(measurementEntity, CCO_PROPS.has_measurement_value, null, null);

        if (valueQuads.length === 0) {
          issues.push({
            pattern: 'Measurement Pattern',
            rule: 'Measurement Value',
            severity: SEVERITY.VIOLATION,
            subject: measurementEntity,
            message: `QualityMeasurement ${shaclValidator.helpers.getShortIri(measurementEntity)} must have a measurement value`,
            explanation: 'A measurement without a value is incomplete.',
            fix: `Add: ${shaclValidator.helpers.getShortIri(measurementEntity)} → has_measurement_value → [numeric literal]`,
          });
        }

        // Rule 3: Must have a unit
        const unitQuads = rdfGraph.getQuads(measurementEntity, CCO_PROPS.uses_measurement_unit, null, null);

        if (unitQuads.length === 0) {
          issues.push({
            pattern: 'Measurement Pattern',
            rule: 'Measurement Unit',
            severity: SEVERITY.VIOLATION,
            subject: measurementEntity,
            message: `QualityMeasurement ${shaclValidator.helpers.getShortIri(measurementEntity)} must specify a measurement unit`,
            explanation: 'A numeric value without a unit is ambiguous (is "5" meters, kilograms, or something else?).',
            fix: `Add: ${shaclValidator.helpers.getShortIri(measurementEntity)} → uses_measurement_unit → [MeasurementUnit]`,
          });
        }
      }

      return {
        issues,
        entitiesChecked: measurementEntities.length,
      };
    },

    /**
     * Validates the Socio-Primal Pattern:
     * Agent → participates_in → Act (INFO)
     * Act → occurs_during → TemporalInterval (WARNING)
     * Act should have at least one participant Agent (WARNING)
     *
     * EXPERT REVIEW (2026-01-09):
     * - This pattern was identified as MISSING from original set
     * - Critical for modeling agent participation in temporal activities
     * - "In CCO, social reality is captured through the participation of
     *    Agents in Acts that occupy a specific Temporal Interval."
     *
     * @param {Store} rdfGraph - N3 Store
     * @returns {Object} { issues: Array, entitiesChecked: number }
     */
    checkSocioPrimalPattern(rdfGraph) {
      const issues = [];

      // Find all Act entities
      const actEntities = shaclValidator.helpers.findEntitiesOfType(
        rdfGraph,
        CCO_CLASSES.Act
      );

      for (const actEntity of actEntities) {
        // Rule 1: Act should occur during a TemporalInterval (WARNING)
        const temporalQuads = rdfGraph.getQuads(actEntity, CCO_PROPS.occurs_during, null, null);

        if (temporalQuads.length === 0) {
          issues.push({
            pattern: 'Socio-Primal Pattern',
            rule: 'Act Temporal Grounding',
            severity: SEVERITY.WARNING,
            subject: actEntity,
            message: `Act ${shaclValidator.helpers.getShortIri(actEntity)} should have an occurs_during relationship`,
            explanation: 'Temporal grounding helps establish when the act took place.',
            fix: `Add: ${shaclValidator.helpers.getShortIri(actEntity)} → occurs_during → [TemporalInterval]`,
          });
        }

        // Rule 2: Act should have at least one participant (WARNING)
        const participantQuads = rdfGraph.getQuads(null, CCO_PROPS.participates_in, actEntity, null);

        if (participantQuads.length === 0) {
          issues.push({
            pattern: 'Socio-Primal Pattern',
            rule: 'Act Participant',
            severity: SEVERITY.WARNING,
            subject: actEntity,
            message: `Act ${shaclValidator.helpers.getShortIri(actEntity)} should have at least one Agent participant`,
            explanation: 'Acts without participants are abstract descriptions.',
            fix: `Add: [Agent] → participates_in → ${shaclValidator.helpers.getShortIri(actEntity)}`,
          });
        }
      }

      return {
        issues,
        entitiesChecked: actEntities.length,
      };
    },

    /**
     * Extracts a time value from an RDF object for comparison
     * @param {Object} rdfObject - N3 term (NamedNode or Literal)
     * @returns {Date|null} Parsed date or null if not a date
     */
    extractTimeValue(rdfObject) {
      if (!rdfObject) return null;

      // If it's a literal with date/time value
      if (rdfObject.termType === 'Literal') {
        const value = rdfObject.value;
        // Try parsing as ISO date
        const dateMatch = value.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          return new Date(dateMatch[0]);
        }
        // Try parsing as timestamp
        const parsed = Date.parse(value);
        if (!isNaN(parsed)) {
          return new Date(parsed);
        }
      }

      return null;
    },

    /**
     * Checks if an entity is an instance of a BFO class (or subclass)
     * This is a simplified check - full reasoning would require OWL reasoner
     *
     * @param {Store} rdfGraph - N3 Store
     * @param {string} entityIri - Entity IRI to check
     * @param {string} bfoClassIri - BFO class IRI
     * @returns {boolean} True if entity is typed as the BFO class
     */
    isInstanceOfBFOClass(rdfGraph, entityIri, bfoClassIri) {
      // Check direct type
      const typeQuads = rdfGraph.getQuads(entityIri, RDF_TYPE, bfoClassIri, null);
      if (typeQuads.length > 0) return true;

      // Check if entity's type is a subclass of the BFO class
      const entityTypes = rdfGraph.getQuads(entityIri, RDF_TYPE, null, null);
      for (const typeQuad of entityTypes) {
        const entityType = typeQuad.object.value;
        const subclassQuads = rdfGraph.getQuads(entityType, SUBCLASS_OF, bfoClassIri, null);
        if (subclassQuads.length > 0) return true;
      }

      // For simplicity, we don't fail type checks if we can't determine type
      // This allows users to model without full BFO typing
      // Return true to avoid false positives when type info is missing
      const hasAnyType = rdfGraph.getQuads(entityIri, RDF_TYPE, null, null).length > 0;
      if (!hasAnyType) return true; // No type info - don't penalize

      return false;
    },

    /**
     * Finds all entities of a given type (including subclasses)
     * @param {Store} rdfGraph - N3 Store
     * @param {string} typeIri - Class IRI to search for
     * @returns {Array<string>} Array of entity IRIs
     */
    findEntitiesOfType(rdfGraph, typeIri) {
      const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
      const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
      const entities = new Set();

      // Direct instances
      const directInstances = rdfGraph.getQuads(null, RDF_TYPE, typeIri, null);
      for (const quad of directInstances) {
        entities.add(quad.subject.value);
      }

      // Instances of subclasses
      const subclassQuads = rdfGraph.getQuads(null, SUBCLASS_OF, typeIri, null);
      for (const subclassQuad of subclassQuads) {
        const subclass = subclassQuad.subject.value;
        const subclassInstances = rdfGraph.getQuads(null, RDF_TYPE, subclass, null);
        for (const quad of subclassInstances) {
          entities.add(quad.subject.value);
        }
      }

      return Array.from(entities);
    },

    /**
     * Gets a short form of an IRI for display
     * @param {string} iri - Full IRI
     * @returns {string} Short form (e.g., "cco:Person")
     */
    getShortIri(iri) {
      if (iri.includes('CommonCoreOntologies/')) {
        const parts = iri.split('/');
        return `cco:${parts[parts.length - 1]}`;
      }
      if (iri.includes('purl.obolibrary.org/obo/')) {
        const parts = iri.split('/');
        return `bfo:${parts[parts.length - 1]}`;
      }
      if (iri.includes('example.org/')) {
        const parts = iri.split('/');
        return `ex:${parts[parts.length - 1]}`;
      }
      return iri;
    },

    /**
     * Returns user-friendly error messages
     * @param {Error} error - Error object
     * @returns {string} User-friendly message
     */
    getUserFriendlyMessage(error) {
      if (error.message.includes('not initialized')) {
        return 'Pattern validator is not ready. Please try again.';
      }

      return 'An error occurred during pattern validation. Please check your diagram syntax.';
    },
  },

  subscribe(fn) {
    subscribers.add(fn);
  },

  unsubscribe(fn) {
    subscribers.delete(fn);
  },

  notify, // Expose for testing
};
