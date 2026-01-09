/**
 * @module bfoValidator
 * @description Validates that all user-defined classes are rooted in BFO hierarchy
 */

import { Parser, Store, DataFactory } from 'n3';
import { BFO_CORE, BFO_LABELS, getBFOIri } from '../../ontologies/bfo-core.ttl.js';
import { CCO_BFO_MAPPING } from '../../ontologies/cco-bfo-mapping.ttl.js';

const { namedNode } = DataFactory;

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

export const bfoValidator = {
  state: {
    referenceStore: null, // N3 Store with BFO ontology
    initialized: false,
    validationResults: new Map(), // diagramId -> validation result
  },

  actions: {
    /**
     * Initializes the BFO reference ontology
     * Should be called once on application startup
     */
    async initialize() {
      try {
        console.log('[bfoValidator] Initializing BFO reference ontology...');
        const startTime = Date.now();

        const parser = new Parser();

        // Parse BFO core
        const bfoQuads = parser.parse(BFO_CORE);

        // Parse CCO-BFO mapping (Iteration 2: temporary until full CCO extraction)
        const ccoQuads = parser.parse(CCO_BFO_MAPPING);

        bfoValidator.state.referenceStore = new Store();
        bfoValidator.state.referenceStore.addQuads(bfoQuads);
        bfoValidator.state.referenceStore.addQuads(ccoQuads);
        bfoValidator.state.initialized = true;

        const elapsed = Date.now() - startTime;
        const totalTriples = bfoQuads.length + ccoQuads.length;
        console.log(`[bfoValidator] Loaded ${bfoQuads.length} BFO triples + ${ccoQuads.length} CCO mappings in ${elapsed}ms`);

        notify('bfoInitialized', { tripleCount: totalTriples, elapsed });
      } catch (error) {
        console.error('[bfoValidator] Initialization failed:', error);
        notify('bfoInitializationFailed', { error });
        throw error;
      }
    },

    /**
     * Validates BFO rooting for all classes in the RDF graph
     * @param {Object} params
     * @param {string} params.diagramId - Diagram identifier
     * @param {Store} params.rdfGraph - N3 Store with user's RDF triples
     */
    validateRooting({ diagramId, rdfGraph }) {
      try {
        console.log(`[bfoValidator] Validating BFO rooting for diagram ${diagramId}...`);

        if (!bfoValidator.state.initialized) {
          throw new Error('BFO validator not initialized. Call initialize() first.');
        }

        const result = bfoValidator.helpers.checkRooting(rdfGraph);

        bfoValidator.state.validationResults.set(diagramId, result);

        console.log(`[bfoValidator] Rooting validation complete:`);
        console.log(`  - Total classes: ${result.totalClasses}`);
        console.log(`  - Rooted: ${result.rootedClasses}`);
        console.log(`  - Orphans: ${result.orphanClasses}`);
        if (result.orphans.length > 0) {
          console.log(`  - Orphan IRIs:`, result.orphans);
        }
        console.log(`  - Pass: ${result.pass ? 'YES' : 'NO'}`);

        notify('rootingValidated', { diagramId, result });
      } catch (error) {
        console.error(`[bfoValidator] Validation failed:`, error);

        const errorResult = {
          pass: false,
          error: error.message,
          userMessage: bfoValidator.helpers.getUserFriendlyMessage(error),
        };

        bfoValidator.state.validationResults.set(diagramId, errorResult);
        notify('rootingValidationFailed', { diagramId, error: errorResult });
      }
    },
  },

  helpers: {
    /**
     * Pure function: Checks BFO rooting for all classes in RDF graph
     * @param {Store} rdfGraph - N3 Store with user's RDF triples
     * @returns {Object} Validation result
     */
    checkRooting(rdfGraph) {
      const referenceStore = bfoValidator.state.referenceStore;

      // Extract all user-defined classes from the graph
      const userClasses = bfoValidator.helpers.extractUserClasses(rdfGraph);

      console.log(`[bfoValidator] Extracted ${userClasses.length} user classes:`, userClasses);

      if (userClasses.length === 0) {
        return {
          pass: true,
          totalClasses: 0,
          rootedClasses: 0,
          orphanClasses: 0,
          orphans: [],
          paths: {},
          message: 'No user-defined classes found'
        };
      }

      // Check each class for path to bfo:Entity
      const results = {
        pass: true,
        totalClasses: userClasses.length,
        rootedClasses: 0,
        orphanClasses: 0,
        orphans: [],
        paths: {},
      };

      const entityIri = getBFOIri('BFO_0000001'); // bfo:Entity

      for (const classIri of userClasses) {
        const path = bfoValidator.helpers.findPathToEntity(
          classIri,
          entityIri,
          rdfGraph,
          referenceStore
        );

        if (path && path.length > 0) {
          results.rootedClasses++;
          results.paths[classIri] = path;
        } else {
          results.orphanClasses++;
          results.orphans.push(classIri);
          results.pass = false;
        }
      }

      // Add human-readable message
      if (results.pass) {
        results.message = `All ${results.totalClasses} classes are properly rooted in BFO`;
      } else {
        results.message = `Found ${results.orphanClasses} orphan class(es) not rooted in BFO`;
      }

      return results;
    },

    /**
     * Extracts all user-defined class IRIs from RDF graph
     * (Classes that are used as rdf:type values)
     * @param {Store} rdfGraph - N3 Store
     * @returns {Array<string>} Array of class IRIs
     */
    extractUserClasses(rdfGraph) {
      const classes = new Set();
      const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

      // Find all objects of rdf:type triples
      const typeQuads = rdfGraph.getQuads(null, RDF_TYPE, null, null);

      for (const quad of typeQuads) {
        const classIri = quad.object.value;

        // Only include CCO/custom classes, not BFO, RDF, OWL, etc.
        if (
          classIri.includes('CommonCoreOntologies') ||
          classIri.includes('example.org') ||
          (classIri.includes('purl.obolibrary.org/obo/') &&
           !classIri.includes('BFO_') &&
           !classIri.includes('IAO_'))
        ) {
          classes.add(classIri);
        }
      }

      return Array.from(classes);
    },

    /**
     * Finds path from a class to bfo:Entity using rdfs:subClassOf
     * @param {string} startClass - Starting class IRI
     * @param {string} targetClass - Target class IRI (bfo:Entity)
     * @param {Store} userStore - User's RDF graph
     * @param {Store} referenceStore - BFO reference ontology
     * @returns {Array<string>|null} Path array or null if no path found
     */
    findPathToEntity(startClass, targetClass, userStore, referenceStore) {
      const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
      const visited = new Set();
      const queue = [[startClass]]; // Array of paths

      while (queue.length > 0) {
        const path = queue.shift();
        const currentClass = path[path.length - 1];

        // Check if we reached the target
        if (currentClass === targetClass) {
          return path;
        }

        // Avoid cycles
        if (visited.has(currentClass)) {
          continue;
        }
        visited.add(currentClass);

        // Find superclasses in both user store and reference store
        const superclassQuads = [
          ...userStore.getQuads(namedNode(currentClass), SUBCLASS_OF, null, null),
          ...referenceStore.getQuads(namedNode(currentClass), SUBCLASS_OF, null, null)
        ];

        for (const quad of superclassQuads) {
          const superclass = quad.object.value;

          // Skip blank nodes and restrictions
          if (superclass.startsWith('_:') || superclass.startsWith('http://www.w3.org/2002/07/owl#')) {
            continue;
          }

          const newPath = [...path, superclass];
          queue.push(newPath);
        }
      }

      // No path found
      return null;
    },

    /**
     * Returns user-friendly error messages
     * @param {Error} error - Error object
     * @returns {string} User-friendly message
     */
    getUserFriendlyMessage(error) {
      if (error.message.includes('not initialized')) {
        return 'BFO validator is not ready. Please try again.';
      }

      return 'An error occurred during BFO rooting validation. Please check your diagram syntax.';
    },

    /**
     * Gets a human-readable label for a class IRI
     * @param {string} iri - Class IRI
     * @returns {string} Label or shortened IRI
     */
    getClassLabel(iri) {
      // Check BFO labels
      const bfoId = iri.replace('http://purl.obolibrary.org/obo/', '');
      if (BFO_LABELS[bfoId]) {
        return BFO_LABELS[bfoId];
      }

      // Extract last part of IRI
      const parts = iri.split(/[/#]/);
      return parts[parts.length - 1] || iri;
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
