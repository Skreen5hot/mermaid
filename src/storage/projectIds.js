// Compound storage ids: "idb:<integer>" or "fsa:<name>".
//
//   Project ids:  "idb:1", "fsa:MyProject"
//   Diagram ids:  "idb:42",  "fsa:MyProject/diagramName"
//
// The router uses these to dispatch operations; the rest of the app treats
// ids as opaque strings (no parsing, no equality with integers).

export function makeIdbProjectId(intId) {
  return `idb:${intId}`;
}

export function makeFsaProjectId(folderName) {
  return `fsa:${folderName}`;
}

export function makeIdbDiagramId(intId) {
  return `idb:${intId}`;
}

export function makeFsaDiagramId(folderName, diagramName) {
  return `fsa:${folderName}/${diagramName}`;
}

// parseStorageId returns { mode, key } where key is the integer IDB id, the
// FSA folder name, or "folder/diagram" for FSA diagrams.
export function parseStorageId(id) {
  if (typeof id !== 'string') {
    throw new Error(`storage id must be a string, got ${typeof id}`);
  }
  if (id.startsWith('idb:')) {
    const key = Number.parseInt(id.slice(4), 10);
    if (Number.isNaN(key)) throw new Error(`malformed idb id: ${id}`);
    return { mode: 'idb', key };
  }
  if (id.startsWith('fsa:')) {
    return { mode: 'fsa', key: id.slice(4) };
  }
  throw new Error(`unknown storage id format: ${id}`);
}

// For an FSA diagram id "fsa:Foo/bar", returns { folder: "Foo", name: "bar" }.
export function parseFsaDiagramKey(key) {
  const slash = key.indexOf('/');
  if (slash < 0) throw new Error(`malformed fsa diagram key: ${key}`);
  return { folder: key.slice(0, slash), name: key.slice(slash + 1) };
}
