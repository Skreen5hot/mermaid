/**
 * @module shaclValidator
 * @description Validates CCO patterns (Information Staircase, Role Pattern, Designation Pattern)
 */

import { isCCOClass } from '../../ontologies/cco-bfo-mapping.ttl.js';

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
     * @param {Store} rdfGraph - N3 Store with user's RDF triples
     * @returns {Object} Validation result
     */
    checkPatterns(rdfGraph) {
      const violations = [];
      let totalChecks = 0;

      // 1. Check Information Staircase Pattern
      const staircaseViolations = shaclValidator.helpers.checkInformationStaircase(rdfGraph);
      violations.push(...staircaseViolations);
      totalChecks += staircaseViolations.length > 0 ? 1 : 0;

      // 2. Check Role Pattern
      const roleViolations = shaclValidator.helpers.checkRolePattern(rdfGraph);
      violations.push(...roleViolations);
      totalChecks += roleViolations.length > 0 ? 1 : 0;

      // 3. Check Designation Pattern
      const designationViolations = shaclValidator.helpers.checkDesignationPattern(rdfGraph);
      violations.push(...designationViolations);
      totalChecks += designationViolations.length > 0 ? 1 : 0;

      // Calculate compliance score (percentage of patterns passed)
      const patternsChecked = 3;
      const patternsFailed = new Set(violations.map(v => v.pattern)).size;
      const complianceScore = Math.round(((patternsChecked - patternsFailed) / patternsChecked) * 100);

      return {
        pass: violations.length === 0,
        violations,
        totalChecks: patternsChecked,
        complianceScore,
        message: violations.length === 0
          ? 'All CCO patterns are valid'
          : `Found ${violations.length} pattern violation(s)`,
      };
    },

    /**
     * Validates the Information Staircase pattern:
     * ICE → is_concretized_by → IBE → has_text_value → Literal
     * @param {Store} rdfGraph - N3 Store
     * @returns {Array<Object>} Array of violations
     */
    checkInformationStaircase(rdfGraph) {
      const violations = [];
      const IS_CONCRETIZED_BY = 'http://www.ontologyrepository.com/CommonCoreOntologies/is_concretized_by';
      const HAS_TEXT_VALUE = 'http://www.ontologyrepository.com/CommonCoreOntologies/has_text_value';
      const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

      // Find all ICE entities (InformationContentEntity)
      const iceEntities = shaclValidator.helpers.findEntitiesOfType(
        rdfGraph,
        'http://www.ontologyrepository.com/CommonCoreOntologies/InformationContentEntity'
      );

      for (const iceEntity of iceEntities) {
        // Check if ICE has is_concretized_by relationship
        const concretizationQuads = rdfGraph.getQuads(iceEntity, IS_CONCRETIZED_BY, null, null);

        if (concretizationQuads.length === 0) {
          violations.push({
            pattern: 'Information Staircase',
            severity: 'error',
            subject: iceEntity,
            message: `ICE entity ${shaclValidator.helpers.getShortIri(iceEntity)} missing is_concretized_by relationship`,
          });
          continue;
        }

        // Check if IBE has has_text_value relationship
        for (const quad of concretizationQuads) {
          const ibeEntity = quad.object.value;
          const textValueQuads = rdfGraph.getQuads(ibeEntity, HAS_TEXT_VALUE, null, null);

          if (textValueQuads.length === 0) {
            violations.push({
              pattern: 'Information Staircase',
              severity: 'error',
              subject: ibeEntity,
              message: `IBE entity ${shaclValidator.helpers.getShortIri(ibeEntity)} missing has_text_value relationship`,
            });
          }
        }
      }

      return violations;
    },

    /**
     * Validates the Role Pattern:
     * IndependentContinuant → is_bearer_of → Role
     * Process → realizes → Role
     * @param {Store} rdfGraph - N3 Store
     * @returns {Array<Object>} Array of violations
     */
    checkRolePattern(rdfGraph) {
      const violations = [];
      const IS_BEARER_OF = 'http://www.ontologyrepository.com/CommonCoreOntologies/is_bearer_of';
      const REALIZES = 'http://www.ontologyrepository.com/CommonCoreOntologies/realizes';

      // Find all Role entities
      const roleEntities = shaclValidator.helpers.findEntitiesOfType(
        rdfGraph,
        'http://www.ontologyrepository.com/CommonCoreOntologies/Role'
      );

      for (const roleEntity of roleEntities) {
        // Check if there's an entity bearing this role
        const bearerQuads = rdfGraph.getQuads(null, IS_BEARER_OF, roleEntity, null);

        if (bearerQuads.length === 0) {
          violations.push({
            pattern: 'Role Pattern',
            severity: 'warning',
            subject: roleEntity,
            message: `Role ${shaclValidator.helpers.getShortIri(roleEntity)} not borne by any entity (missing is_bearer_of)`,
          });
        }

        // Check if there's a process realizing this role
        const realizationQuads = rdfGraph.getQuads(null, REALIZES, roleEntity, null);

        if (realizationQuads.length === 0) {
          violations.push({
            pattern: 'Role Pattern',
            severity: 'warning',
            subject: roleEntity,
            message: `Role ${shaclValidator.helpers.getShortIri(roleEntity)} not realized by any process (missing realizes)`,
          });
        }
      }

      return violations;
    },

    /**
     * Validates the Designation Pattern:
     * Entity → is_designated_by → DesignativeICE
     * @param {Store} rdfGraph - N3 Store
     * @returns {Array<Object>} Array of violations
     */
    checkDesignationPattern(rdfGraph) {
      const violations = [];
      const IS_DESIGNATED_BY = 'http://www.ontologyrepository.com/CommonCoreOntologies/is_designated_by';
      const DESIGNATES = 'http://www.ontologyrepository.com/CommonCoreOntologies/designates';

      // Find all DesignativeInformationContentEntity instances
      const designativeEntities = shaclValidator.helpers.findEntitiesOfType(
        rdfGraph,
        'http://www.ontologyrepository.com/CommonCoreOntologies/DesignativeInformationContentEntity'
      );

      for (const designativeEntity of designativeEntities) {
        // Check if it designates something OR something is designated by it
        const designatesQuads = rdfGraph.getQuads(designativeEntity, DESIGNATES, null, null);
        const designatedByQuads = rdfGraph.getQuads(null, IS_DESIGNATED_BY, designativeEntity, null);

        if (designatesQuads.length === 0 && designatedByQuads.length === 0) {
          violations.push({
            pattern: 'Designation Pattern',
            severity: 'warning',
            subject: designativeEntity,
            message: `Designative entity ${shaclValidator.helpers.getShortIri(designativeEntity)} not linked via is_designated_by or designates`,
          });
        }
      }

      return violations;
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
