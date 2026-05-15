// IndexedDB CRUD layer for IDB-mode projects.
//
// Factory-created. Pure data layer: every operation returns a Promise. No
// event bus dependency — the router (storageConcept) emits events after
// awaiting these promises.
//
// Schema (mermaid_viewer_db v2):
//   - projects: { id (autoIncrement), name }
//   - diagrams: { id (autoIncrement), name, projectId, content, dateModified }
//              with `projectId` index for per-project listing.

const DB_NAME = 'mermaid_viewer_db';
const DB_VERSION = 2;

export function createIdbBackend() {
  let _db = null;
  let _dbConnectionPromise = null;

  function open() {
    if (_db) return Promise.resolve();
    if (_dbConnectionPromise) return _dbConnectionPromise;

    _dbConnectionPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error || new Error('Error opening DB'));
      request.onsuccess = (event) => {
        _db = event.target.result;
        _dbConnectionPromise = null;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('diagrams')) {
          const diagramStore = db.createObjectStore('diagrams', { keyPath: 'id', autoIncrement: true });
          diagramStore.createIndex('projectId', 'projectId', { unique: false });
        }
      };
    });
    return _dbConnectionPromise;
  }

  function getAllProjects() {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(['projects'], 'readonly');
      const r = tx.objectStore('projects').getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  function createProject({ name }) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(['projects'], 'readwrite');
      const r = tx.objectStore('projects').add({ name });
      r.onsuccess = (event) => resolve({ id: event.target.result, name });
      r.onerror = () => reject(r.error);
    });
  }

  function saveProject({ projectData }) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(['projects'], 'readwrite');
      const r = tx.objectStore('projects').put(projectData);
      r.onsuccess = () => resolve(projectData);
      r.onerror = () => reject(r.error);
    });
  }

  function deleteProject({ projectId }) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(['projects', 'diagrams'], 'readwrite');
      const projectStore = tx.objectStore('projects');
      const diagramStore = tx.objectStore('diagrams');
      const diagramIndex = diagramStore.index('projectId');

      const diagramRequest = diagramIndex.getAllKeys(projectId);
      diagramRequest.onsuccess = () => {
        (diagramRequest.result || []).forEach((id) => diagramStore.delete(id));
        const pr = projectStore.delete(projectId);
        pr.onsuccess = () => resolve();
        pr.onerror = () => reject(pr.error);
      };
      diagramRequest.onerror = () => reject(diagramRequest.error);
    });
  }

  function saveDiagram({ diagramData }) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(['diagrams'], 'readwrite');
      const diagram = { ...diagramData, dateModified: new Date().toISOString() };
      const r = tx.objectStore('diagrams').put(diagram);
      r.onsuccess = (event) => resolve({ ...diagram, id: event.target.result });
      r.onerror = () => reject(r.error);
    });
  }

  function loadDiagram({ diagramId }) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(['diagrams'], 'readonly');
      const r = tx.objectStore('diagrams').get(diagramId);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }

  function listDiagrams({ projectId }) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(['diagrams'], 'readonly');
      const r = tx.objectStore('diagrams').index('projectId').getAll(projectId);
      r.onsuccess = (e) => resolve(e.target.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  function deleteDiagram({ diagramId }) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(['diagrams'], 'readwrite');
      const r = tx.objectStore('diagrams').delete(diagramId);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  function reset() {
    _db = null;
    _dbConnectionPromise = null;
  }

  function isOpen() { return _db !== null; }

  return {
    open,
    getAllProjects,
    createProject,
    saveProject,
    deleteProject,
    saveDiagram,
    loadDiagram,
    listDiagrams,
    deleteDiagram,
    reset,
    isOpen,
  };
}
