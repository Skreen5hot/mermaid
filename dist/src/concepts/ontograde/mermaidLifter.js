/**
 * @module mermaidLifter
 * @description Parses Mermaid diagram syntax and converts to RDF triples
 */

import { Parser, Store, Writer, DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

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

        // Edge definition: Person_0 -->|is_bearer_of| Role_0
        const edgeMatch = line.match(/(\w+)\s*-->?\s*\|([^|]+)\|\s*(\w+)/);
        if (edgeMatch) {
          const [, subject, predicate, object] = edgeMatch;

          store.addQuad(
            namedNode(`http://example.org/${subject}`),
            namedNode(`http://www.ontologyrepository.com/CommonCoreOntologies/${predicate}`),
            namedNode(`http://example.org/${object}`)
          );
        }
      }

      // Validate that store is not empty
      if (store.size === 0) {
        throw new Error('No valid nodes or edges found in Mermaid diagram');
      }

      return store;
    },

    /**
     * Expands abbreviated IRI prefixes to full URIs
     * @param {string} iri - Abbreviated IRI (e.g., "cco:Person")
     * @returns {string} Full URI
     */
    expandIRI(iri) {
      const prefixes = {
        'cco': 'http://www.ontologyrepository.com/CommonCoreOntologies/',
        'bfo': 'http://purl.obolibrary.org/obo/',
        'ex': 'http://example.org/',
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      };

      // Check if IRI has a prefix
      const colonIndex = iri.indexOf(':');
      if (colonIndex > 0) {
        const prefix = iri.substring(0, colonIndex);
        const localPart = iri.substring(colonIndex + 1);

        if (prefixes[prefix]) {
          return prefixes[prefix] + localPart;
        }
      }

      // If no prefix or unknown prefix, return as-is
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
