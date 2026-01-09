/**
 * @module logicReasoner
 * @description Checks logical consistency and detects disjointness violations
 */

import { BFO_LABELS } from '../../ontologies/bfo-core.ttl.js';

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

// BFO Disjoint classes (top-level categories that cannot overlap)
const DISJOINT_SETS = [
  // Continuants vs Occurrents
  {
    name: 'Continuant vs Occurrent',
    classes: [
      ['http://purl.obolibrary.org/obo/BFO_0000002', 'http://purl.obolibrary.org/obo/BFO_0000003'], // continuant vs occurrent
    ],
  },
  // Independent Continuant subtypes
  {
    name: 'Material vs Immaterial',
    classes: [
      ['http://purl.obolibrary.org/obo/BFO_0000040', 'http://purl.obolibrary.org/obo/BFO_0000141'], // material entity vs immaterial entity
    ],
  },
  // Dependent Continuant subtypes
  {
    name: 'Specifically Dependent vs Generically Dependent',
    classes: [
      ['http://purl.obolibrary.org/obo/BFO_0000020', 'http://purl.obolibrary.org/obo/BFO_0000031'], // specifically dependent vs generically dependent
    ],
  },
];

export const logicReasoner = {
  state: {
    inconsistencies: [], // Array of logical inconsistencies
    integrityScore: 0, // 0-100 percentage
    validationResults: new Map(), // diagramId -> result
  },

  actions: {
    /**
     * Checks logical consistency of the RDF graph
     * @param {Object} params
     * @param {string} params.diagramId - Diagram identifier
     * @param {Store} params.rdfGraph - N3 Store with user's RDF triples
     */
    checkConsistency({ diagramId, rdfGraph }) {
      try {
        console.log(`[logicReasoner] Checking logical consistency for diagram ${diagramId}...`);

        const result = logicReasoner.helpers.performReasoning(rdfGraph);

        logicReasoner.state.inconsistencies = result.inconsistencies;
        logicReasoner.state.integrityScore = result.integrityScore;
        logicReasoner.state.validationResults.set(diagramId, result);

        console.log(`[logicReasoner] Consistency check complete:`);
        console.log(`  - Total checks: ${result.totalChecks}`);
        console.log(`  - Inconsistencies: ${result.inconsistencies.length}`);
        console.log(`  - Integrity score: ${result.integrityScore}%`);

        notify('consistencyChecked', { diagramId, result });
      } catch (error) {
        console.error(`[logicReasoner] Consistency check failed:`, error);

        const errorResult = {
          pass: false,
          error: error.message,
          userMessage: logicReasoner.helpers.getUserFriendlyMessage(error),
        };

        logicReasoner.state.validationResults.set(diagramId, errorResult);
        notify('consistencyCheckFailed', { diagramId, error: errorResult });
      }
    },
  },

  helpers: {
    /**
     * Performs reasoning to detect logical inconsistencies
     * @param {Store} rdfGraph - N3 Store
     * @returns {Object} Reasoning result
     */
    performReasoning(rdfGraph) {
      const inconsistencies = [];

      // 1. Check for disjointness violations
      const disjointnessInconsistencies = logicReasoner.helpers.checkDisjointness(rdfGraph);
      inconsistencies.push(...disjointnessInconsistencies);

      // 2. Check for type collisions (entity with contradictory types)
      const typeCollisions = logicReasoner.helpers.checkTypeCollisions(rdfGraph);
      inconsistencies.push(...typeCollisions);

      // Calculate integrity score
      const totalChecks = disjointnessInconsistencies.length + typeCollisions.length;
      const integrityScore = totalChecks === 0 ? 100 : Math.max(0, Math.round((1 - inconsistencies.length / Math.max(totalChecks, 1)) * 100));

      return {
        pass: inconsistencies.length === 0,
        inconsistencies,
        totalChecks,
        integrityScore,
        message: inconsistencies.length === 0
          ? 'Model is logically consistent'
          : `Found ${inconsistencies.length} logical inconsistency(ies)`,
      };
    },

    /**
     * Checks for disjointness violations
     * Detects entities that are asserted as instances of disjoint classes
     * @param {Store} rdfGraph - N3 Store
     * @returns {Array<Object>} Array of inconsistencies
     */
    checkDisjointness(rdfGraph) {
      const inconsistencies = [];
      const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
      const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

      // Get all entities with their types
      const entityTypes = new Map();
      const typeQuads = rdfGraph.getQuads(null, RDF_TYPE, null, null);

      for (const quad of typeQuads) {
        const entity = quad.subject.value;
        const type = quad.object.value;

        if (!entityTypes.has(entity)) {
          entityTypes.set(entity, new Set());
        }
        entityTypes.get(entity).add(type);

        // Also infer types from subclass hierarchy
        const inferred = logicReasoner.helpers.inferSuperclasses(type, rdfGraph);
        for (const inferredType of inferred) {
          entityTypes.get(entity).add(inferredType);
        }
      }

      // Check each entity against disjoint sets
      for (const [entity, types] of entityTypes.entries()) {
        for (const disjointSet of DISJOINT_SETS) {
          for (const [classA, classB] of disjointSet.classes) {
            if (types.has(classA) && types.has(classB)) {
              inconsistencies.push({
                type: 'disjointness_violation',
                severity: 'error',
                subject: entity,
                classes: [classA, classB],
                message: `Entity ${logicReasoner.helpers.getShortIri(entity)} violates disjointness: inferred as both ${logicReasoner.helpers.getBFOLabel(classA)} and ${logicReasoner.helpers.getBFOLabel(classB)}`,
              });
            }
          }
        }
      }

      return inconsistencies;
    },

    /**
     * Checks for type collisions
     * Detects cases where an entity has contradictory explicit types
     * @param {Store} rdfGraph - N3 Store
     * @returns {Array<Object>} Array of inconsistencies
     */
    checkTypeCollisions(rdfGraph) {
      const inconsistencies = [];
      const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

      // Specific known collisions
      const PROCESS_IRI = 'http://purl.obolibrary.org/obo/BFO_0000015';
      const OBJECT_IRI = 'http://purl.obolibrary.org/obo/BFO_0000030';
      const CONTINUANT_IRI = 'http://purl.obolibrary.org/obo/BFO_0000002';
      const OCCURRENT_IRI = 'http://purl.obolibrary.org/obo/BFO_0000003';

      // Get all entities with their types
      const entityTypes = new Map();
      const typeQuads = rdfGraph.getQuads(null, RDF_TYPE, null, null);

      for (const quad of typeQuads) {
        const entity = quad.subject.value;
        const type = quad.object.value;

        if (!entityTypes.has(entity)) {
          entityTypes.set(entity, new Set());
        }
        entityTypes.get(entity).add(type);

        // Infer supertypes
        const inferred = logicReasoner.helpers.inferSuperclasses(type, rdfGraph);
        for (const inferredType of inferred) {
          entityTypes.get(entity).add(inferredType);
        }
      }

      // Check for specific collision: Process AND Object
      for (const [entity, types] of entityTypes.entries()) {
        if (types.has(PROCESS_IRI) && types.has(OBJECT_IRI)) {
          inconsistencies.push({
            type: 'type_collision',
            severity: 'error',
            subject: entity,
            classes: [PROCESS_IRI, OBJECT_IRI],
            message: `Entity ${logicReasoner.helpers.getShortIri(entity)} has contradictory types: Process and Object`,
          });
        }

        if (types.has(CONTINUANT_IRI) && types.has(OCCURRENT_IRI)) {
          inconsistencies.push({
            type: 'type_collision',
            severity: 'error',
            subject: entity,
            classes: [CONTINUANT_IRI, OCCURRENT_IRI],
            message: `Entity ${logicReasoner.helpers.getShortIri(entity)} has contradictory types: Continuant and Occurrent`,
          });
        }
      }

      return inconsistencies;
    },

    /**
     * Infers all superclasses of a given class using subClassOf transitivity
     * @param {string} classIri - Class IRI
     * @param {Store} rdfGraph - N3 Store
     * @returns {Set<string>} Set of superclass IRIs
     */
    inferSuperclasses(classIri, rdfGraph) {
      const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
      const superclasses = new Set();
      const queue = [classIri];
      const visited = new Set();

      while (queue.length > 0) {
        const current = queue.shift();

        if (visited.has(current)) continue;
        visited.add(current);

        const superclassQuads = rdfGraph.getQuads(current, SUBCLASS_OF, null, null);

        for (const quad of superclassQuads) {
          const superclass = quad.object.value;

          // Skip blank nodes
          if (superclass.startsWith('_:')) continue;

          superclasses.add(superclass);
          queue.push(superclass);
        }
      }

      return superclasses;
    },

    /**
     * Gets a BFO label for a class IRI
     * @param {string} iri - Class IRI
     * @returns {string} Label or short IRI
     */
    getBFOLabel(iri) {
      const classId = iri.replace('http://purl.obolibrary.org/obo/', '');
      return BFO_LABELS[classId] || classId;
    },

    /**
     * Gets a short form of an IRI for display
     * @param {string} iri - Full IRI
     * @returns {string} Short form
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
        return 'Logic reasoner is not ready. Please try again.';
      }

      return 'An error occurred during consistency checking. Please check your diagram syntax.';
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
