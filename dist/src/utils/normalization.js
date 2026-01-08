/**
 * @module normalization
 * @description Provides utility functions to normalize data objects
 * from JSON-LD format back to the application's internal simple JSON format.
 * This allows the application to read both old and new data formats during the transition.
 */

/**
 * Normalizes a diagram object from JSON-LD format to the application's internal simple JSON format.
 * If the object is already in simple JSON format, it returns it as-is.
 * @param {object} data - The diagram object, potentially in JSON-LD.
 * @returns {object} The diagram object in simple JSON format.
 */
export function normalizeDiagram(data) {
  // Check if it's a JSON-LD diagram based on @context and @type
  if (data && data['@context'] && data['@type'] === 'bfo:BFO_0000031') {
    const { ['@context']: context, ['@id']: id, ['@type']: type, ['schema:name']: name, ['schema:text']: text, ['bfo:BFO_0000129']: memberOf, ['schema:dateCreated']: created, ['schema:dateModified']: modified, ...rest } = data;
    return {
      id: parseInt(data['@id'].split(':').pop()), // Extract ID from URN
      projectId: parseInt(data['bfo:BFO_0000129']['@id'].split(':').pop()), // Extract projectId from URN
      title: data['schema:name'],
      content: data['schema:text'],
      createdAt: data['schema:dateCreated'] ? new Date(data['schema:dateCreated']) : undefined,
      updatedAt: data['schema:dateModified'] ? new Date(data['schema:dateModified']) : undefined,
      // Preserve all other app-specific fields by spreading the rest
      ...rest,
    };
  }
  return data; // Already in simple JSON format or not a JSON-LD diagram
}

/**
 * Normalizes a project object from JSON-LD format to the application's internal simple JSON format.
 * If the object is already in simple JSON format, it returns it as-is.
 * @param {object} data - The project object, potentially in JSON-LD.
 * @returns {object} The project object in simple JSON format.
 */
export function normalizeProject(data) {
  // Check if it's a JSON-LD project based on @context and @type
  if (data && data['@context'] && data['@type'] === 'bfo:BFO_0000027') {
    // Destructure all known semantic and application-specific properties, then spread the rest.
    const { ['@context']: context, ['@id']: id, ['@type']: type, ['schema:name']: name, ['schema:dateCreated']: created, ['schema:dateModified']: modified, ...rest } = data;
    return {
      id: parseInt(data['@id'].split(':').pop()), // Extract ID from URN
      name: data['schema:name'],
      createdAt: data['schema:dateCreated'] ? new Date(data['schema:dateCreated']) : undefined,
      updatedAt: data['schema:dateModified'] ? new Date(data['schema:dateModified']) : undefined,
      ...rest, // This will include gitProvider, repositoryPath, etc.
    };
  }
  return data; // Already in simple JSON format or not a JSON-LD project
}

/**
 * Converts a simple diagram object to its JSON-LD representation.
 * @param {object} diagram - The diagram object in simple JSON format.
 * @returns {object} The diagram object in JSON-LD format.
 */
export function toDiagramLD(diagram) {
  // If the object already has a context, assume it's already in the correct format.
  if (diagram['@context']) return diagram;

  const { id, projectId, title, content, createdAt, updatedAt, lastModifiedRemoteSha, ...rest } = diagram; // Destructure all known properties

  const ldObject = {
    '@context': 'https://mermaid-ide.org/context/v1.jsonld',
    '@id': `urn:mermaid-ide:diagram:${id}`,
    '@type': 'bfo:BFO_0000031',
    'schema:name': title,
    'schema:text': content,
    'bfo:BFO_0000129': { '@id': `urn:mermaid-ide:project:${projectId}` },
    'schema:dateCreated': createdAt ? new Date(createdAt).toISOString() : undefined,
    'schema:dateModified': updatedAt ? new Date(updatedAt).toISOString() : undefined,
    // Preserve app-specific, non-semantic fields directly
    lastModifiedRemoteSha: lastModifiedRemoteSha,
    // --- FIX: Add a shadow property with a valid keyPath for indexing ---
    _name_for_index: title,
    projectId: projectId, // Keep for the index
    ...rest, // Spread any other remaining properties
  };

  if (id) ldObject.id = id; // Only add the id property if it exists
  return ldObject;
}

/**
 * Converts a simple project object to its JSON-LD representation.
 * @param {object} project - The project object in simple JSON format.
 * @returns {object} The project object in JSON-LD format.
 */
export function toProjectLD(project) {
  // If the object already has a context, assume it's already in the correct format.
  if (project['@context']) return project;

  const { id, name, createdAt, updatedAt, ...rest } = project; // Destructure all known properties

  const ldObject = {
    '@context': 'https://mermaid-ide.org/context/v1.jsonld',
    '@id': `urn:mermaid-ide:project:${id}`,
    '@type': 'bfo:BFO_0000027',
    'schema:name': name,
    'schema:dateCreated': createdAt ? new Date(createdAt).toISOString() : undefined,
    'schema:dateModified': updatedAt ? new Date(updatedAt).toISOString() : undefined,
    // --- FIX: Add a shadow property with a valid keyPath for indexing ---
    _name_for_index: name,
    // Preserve app-specific, non-semantic fields directly
    ...rest,
  };

  if (id) ldObject.id = id; // Only add the id property if it exists
  return ldObject;
}