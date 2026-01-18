/**
 * @module mermaidLifter
 * @description Parses Mermaid diagram syntax and converts to RDF triples
 */

import { Parser, Store, Writer, DataFactory } from 'n3';
import { normalizeCCOIri, expandCCOPrefix, CANONICAL_CCO_NAMESPACE } from '../../ontologies/cco-iri-normalizer.js';

const { namedNode, literal, quad } = DataFactory;

const subscribers = new Set();

/**
 * Standard ontology prefix mappings
 * Used for expanding prefixed IRIs to full URIs
 */
const STANDARD_PREFIXES = {
  // Ontology namespaces
  'cco': 'http://www.ontologyrepository.com/CommonCoreOntologies/',
  'CCO': 'http://www.ontologyrepository.com/CommonCoreOntologies/',
  'bfo': 'http://purl.obolibrary.org/obo/',
  'obo': 'http://purl.obolibrary.org/obo/',
  'ro': 'http://purl.obolibrary.org/obo/',  // OBO Relations use same namespace

  // Standard vocabularies
  'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
  'owl': 'http://www.w3.org/2002/07/owl#',
  'xsd': 'http://www.w3.org/2001/XMLSchema#',
  'xml': 'http://www.w3.org/XML/1998/namespace',

  // Dublin Core
  'dc': 'http://purl.org/dc/terms/',
  'dc11': 'http://purl.org/dc/elements/1.1/',

  // SKOS
  'skos': 'http://www.w3.org/2004/02/skos/core#',

  // Testing
  'ex': 'http://example.org/',
};

/**
 * Maps predicate IRIs to their expected XSD datatypes
 * Used when creating literal triples to add proper datatype annotations
 */
const PREDICATE_DATATYPES = {
  // CCO temporal predicates
  'http://www.ontologyrepository.com/CommonCoreOntologies/has_start_time': 'http://www.w3.org/2001/XMLSchema#dateTime',
  'http://www.ontologyrepository.com/CommonCoreOntologies/has_end_time': 'http://www.w3.org/2001/XMLSchema#dateTime',
  'http://www.ontologyrepository.com/CommonCoreOntologies/has_time_value': 'http://www.w3.org/2001/XMLSchema#dateTime',
  'http://www.ontologyrepository.com/CommonCoreOntologies/has_text_value': 'http://www.w3.org/2001/XMLSchema#string',
  'http://www.ontologyrepository.com/CommonCoreOntologies/has_measurement_value': 'http://www.w3.org/2001/XMLSchema#decimal',
};

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

export const mermaidLifter = {
  state: {
    rdfGraphs: new Map(), // diagramId -> RDF graph (N3 Store)
    errors: new Map(), // diagramId -> error details
  },

  actions: {
    /**
     * Lifts a Mermaid diagram to RDF triples
     * @param {Object} params
     * @param {string} params.diagramId - Diagram identifier
     * @param {string} params.mermaidText - Mermaid diagram source
     */
    liftDiagram({ diagramId, mermaidText }) {
      try {
        console.log(`[mermaidLifter] Lifting diagram ${diagramId}...`);

        // Validate size first
        const nodeCount = (mermaidText.match(/\w+\["/g) || []).length;
        if (nodeCount > 100) {
          notify('largeGraphWarning', { diagramId, nodeCount });
        }

        const rdfGraph = mermaidLifter.helpers.liftToRDF(mermaidText);

        mermaidLifter.state.rdfGraphs.set(diagramId, rdfGraph);
        mermaidLifter.state.errors.delete(diagramId);

        notify('diagramLifted', { diagramId, rdfGraph });
      } catch (error) {
        console.error(`[mermaidLifter] Lifting failed:`, error);

        // Classify error
        const errorType = error.message.includes('syntax') || error.message.includes('valid')
          ? 'PARSE_ERROR'
          : 'UNKNOWN_ERROR';

        mermaidLifter.state.errors.set(diagramId, {
          type: errorType,
          message: error.message,
          userMessage: mermaidLifter.helpers.getUserFriendlyMessage(errorType, error),
          timestamp: Date.now(),
        });

        notify('liftingFailed', { diagramId, error: mermaidLifter.state.errors.get(diagramId) });
      }
    },
  },

  helpers: {
    /**
     * Pure function: Converts Mermaid syntax to N3 RDF Store
     * @param {string} mermaidText - Mermaid diagram source
     * @returns {Store} N3 Store with RDF triples
     */
    liftToRDF(mermaidText) {
      const store = new Store();

      // Map to store literal node values: lit_0 -> "literal value"
      const literalNodes = new Map();

      // Parse Mermaid syntax
      const lines = mermaidText.split('\n').filter(l => l.trim());

      if (lines.length === 0) {
        throw new Error('No valid nodes or edges found in Mermaid diagram');
      }

      // Skip first line if it's "graph TD" or similar
      const dataLines = lines[0].match(/^graph\s+(TD|LR|TB|RL|BT)/)
        ? lines.slice(1)
        : lines;

      for (const line of dataLines) {
        // Skip comments (lines starting with %%)
        if (line.trim().startsWith('%%')) {
          continue;
        }

        // Skip subgraph declarations and end statements
        if (line.trim().startsWith('subgraph') || line.trim() === 'end') {
          continue;
        }

        // Literal node definition: lit_0("literal value")
        // Pattern: lit_N("value") where N is a number
        const literalNodeMatch = line.match(/(lit_\d+)\("([^"]+)"\)/);
        if (literalNodeMatch) {
          const [, nodeId, literalValue] = literalNodeMatch;
          literalNodes.set(nodeId, literalValue);
          continue; // Don't add to RDF as a node - will be added when edge is parsed
        }

        // Node definition: Person_0["Person<br>IRI: cco:Person"]
        const nodeMatch = line.match(/(\w+)\["([^"]+)"\]/);
        if (nodeMatch) {
          const [, nodeId, label] = nodeMatch;

          // Extract IRI from label
          const iriMatch = label.match(/IRI:\s*(\S+)/);
          const iri = iriMatch ? iriMatch[1] : `http://example.org/${nodeId}`;

          // Extract type from label (first line before <br>)
          const type = label.split('<br>')[0].trim();

          // Add type triple
          store.addQuad(
            namedNode(`http://example.org/${nodeId}`),
            namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            namedNode(mermaidLifter.helpers.expandIRI(iri))
          );

          // Add label triple
          store.addQuad(
            namedNode(`http://example.org/${nodeId}`),
            namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
            literal(type)
          );
        }

        // Edge definition with literal (new format): TI_0 -->|"has start time<br>IRI: cco:has_start_time"| "2026-01-01T00:00:00"
        // Pattern: Subject -->|"label<br>IRI: prefix:localPart"| "literal_value"
        const literalEdgeMatchNew = line.match(/(\w+)\s*-->?\s*\|"([^"]+)"\|\s*"([^"]+)"/);
        if (literalEdgeMatchNew) {
          const [, subject, predicateLabel, literalValue] = literalEdgeMatchNew;

          // Extract IRI from predicate label
          const predicateIri = mermaidLifter.helpers.extractPredicateIRI(predicateLabel);

          // Get datatype for this predicate (if known)
          const datatype = PREDICATE_DATATYPES[predicateIri];

          // Create literal with or without datatype
          const literalNode = datatype
            ? literal(literalValue, namedNode(datatype))
            : literal(literalValue);

          store.addQuad(
            namedNode(`http://example.org/${subject}`),
            namedNode(predicateIri),
            literalNode
          );
          continue; // Don't try to match as regular edge
        }

        // Edge definition (new format): Person_0 -->|"participates in<br>IRI: bfo:BFO_0000056"| Act_0
        // Pattern: Subject -->|"label<br>IRI: prefix:localPart"| Object
        const edgeMatchNew = line.match(/(\w+)\s*-->?\s*\|"([^"]+)"\|\s*(\w+)/);
        if (edgeMatchNew) {
          const [, subject, predicateLabel, object] = edgeMatchNew;

          // Extract IRI from predicate label
          const predicateIri = mermaidLifter.helpers.extractPredicateIRI(predicateLabel);

          // Check if target is a literal node (lit_N)
          if (literalNodes.has(object)) {
            const literalValue = literalNodes.get(object);

            // Get datatype for this predicate (if known)
            const datatype = PREDICATE_DATATYPES[predicateIri];

            // Create literal with or without datatype
            const literalNode = datatype
              ? literal(literalValue, namedNode(datatype))
              : literal(literalValue);

            store.addQuad(
              namedNode(`http://example.org/${subject}`),
              namedNode(predicateIri),
              literalNode
            );
          } else {
            // Regular object node
            store.addQuad(
              namedNode(`http://example.org/${subject}`),
              namedNode(predicateIri),
              namedNode(`http://example.org/${object}`)
            );
          }
        }
      }

      // Validate that store is not empty
      if (store.size === 0) {
        throw new Error('No valid nodes or edges found in Mermaid diagram');
      }

      return store;
    },

    /**
     * Extracts and expands the IRI from a predicate label
     * @param {string} predicateLabel - Label like "participates in<br>IRI: bfo:BFO_0000056"
     * @returns {string} Full expanded IRI
     */
    extractPredicateIRI(predicateLabel) {
      // Extract IRI from label (after "IRI: ")
      const iriMatch = predicateLabel.match(/IRI:\s*(\S+)/);
      if (iriMatch) {
        return mermaidLifter.helpers.expandIRI(iriMatch[1]);
      }

      // Fallback: use the label itself as a CCO predicate name (for backwards compatibility during transition)
      const label = predicateLabel.split('<br>')[0].trim().replace(/\s+/g, '_');
      return `http://www.ontologyrepository.com/CommonCoreOntologies/${label}`;
    },

    /**
     * Expands abbreviated IRI prefixes to full URIs
     * Handles CCO IRI variants including numeric IDs (ont#####)
     * @param {string} iri - Abbreviated IRI (e.g., "cco:Person", "cco:ont00001262", "bfo:BFO_0000056")
     * @returns {string} Full URI (normalized for CCO)
     */
    expandIRI(iri) {
      // Handle CCO IRIs specially (supports numeric IDs and all namespace variants)
      if (iri.startsWith('cco:') || iri.startsWith('CCO:')) {
        return expandCCOPrefix(iri);
      }

      // Handle full CCO namespace variants
      const normalizedCCO = normalizeCCOIri(iri);
      if (normalizedCCO !== iri) {
        return normalizedCCO;
      }

      // Check if IRI has a prefix
      const colonIndex = iri.indexOf(':');
      if (colonIndex > 0) {
        const prefix = iri.substring(0, colonIndex);
        const localPart = iri.substring(colonIndex + 1);

        if (STANDARD_PREFIXES[prefix]) {
          return STANDARD_PREFIXES[prefix] + localPart;
        }
      }

      // If no prefix or unknown prefix, return as-is (might be a full IRI)
      return iri;
    },

    /**
     * Returns user-friendly error messages
     * @param {string} errorType - Error type classification
     * @param {Error} error - Original error object
     * @returns {string} User-friendly message
     */
    getUserFriendlyMessage(errorType, error) {
      const messages = {
        PARSE_ERROR: 'Invalid Mermaid syntax. Please check your diagram structure.',
        UNKNOWN_ERROR: 'An unexpected error occurred during diagram analysis.',
      };
      return messages[errorType] || messages.UNKNOWN_ERROR;
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
