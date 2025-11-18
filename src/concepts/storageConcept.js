import { createEventBus } from '../utils/eventBus.js';

const bus = createEventBus();
let _db = null;
let _dbConnectionPromise = null;

async function _open() {
    if (_db) {
        bus.notify('databaseOpened');
        return;
    }
    if (_dbConnectionPromise) {
        return _dbConnectionPromise;
    }
    _dbConnectionPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('mermaid_viewer_db', 2);
        request.onerror = () => {
            bus.notify('error', "Error opening DB");
            reject("Error opening DB");
        };
        request.onsuccess = (event) => {
            _db = event.target.result;
            bus.notify('databaseOpened');
            _dbConnectionPromise = null; // Reset for future connections if needed
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

function _createProject({ name }) {
    const transaction = _db.transaction(['projects'], 'readwrite');
    const store = transaction.objectStore('projects');
    const request = store.add({ name });
    request.onsuccess = (event) => bus.notify('projectCreated', { id: event.target.result, name });
    request.onerror = () => bus.notify('error', 'Failed to create project.');
}

function _saveProject({ projectData }) {
    const transaction = _db.transaction(['projects'], 'readwrite');
    const store = transaction.objectStore('projects');
    const request = store.put(projectData);
    // After saving, we should re-list to update UI everywhere
    request.onsuccess = () => _listProjects();
    request.onerror = () => bus.notify('error', 'Failed to save project.');
}

function _listProjects() {
    const transaction = _db.transaction(['projects'], 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.getAll();
    request.onsuccess = () => bus.notify('projectsListed', request.result);
    request.onerror = () => bus.notify('error', 'Failed to list projects.');
}

function _deleteProject({ projectId }) {
    const transaction = _db.transaction(['projects', 'diagrams'], 'readwrite');
    const projectStore = transaction.objectStore('projects');
    const diagramStore = transaction.objectStore('diagrams');
    const diagramIndex = diagramStore.index('projectId');

    const diagramRequest = diagramIndex.getAllKeys(projectId);
    diagramRequest.onsuccess = () => {
        diagramRequest.result.forEach(diagramId => diagramStore.delete(diagramId));
        const projectRequest = projectStore.delete(projectId);
        projectRequest.onsuccess = () => bus.notify('projectDeleted', { projectId });
        projectRequest.onerror = () => bus.notify('error', 'Failed to delete project.');
    };
    diagramRequest.onerror = () => bus.notify('error', 'Failed to find diagrams for project deletion.');
}

function _saveDiagram({ diagramData }) {
    const transaction = _db.transaction(['diagrams'], 'readwrite');
    const store = transaction.objectStore('diagrams');
    const diagram = { ...diagramData, dateModified: new Date().toISOString() };
    const request = store.put(diagram);
    request.onsuccess = (event) => bus.notify('diagramSaved', { ...diagram, id: event.target.result });
    request.onerror = () => bus.notify('error', 'Failed to save diagram.');
}

function _loadDiagram({ diagramId }) {
    const transaction = _db.transaction(['diagrams'], 'readonly');
    const store = transaction.objectStore('diagrams');
    const request = store.get(diagramId);
    request.onsuccess = () => bus.notify('diagramLoaded', request.result);
    request.onerror = () => bus.notify('error', 'Failed to load diagram.');
}

function _listDiagrams({ projectId }) {
    const transaction = _db.transaction(['diagrams'], 'readonly');
    const store = transaction.objectStore('diagrams');
    const index = store.index('projectId');
    const request = index.getAll(projectId);
    request.onsuccess = (e) => {
        const diagrams = e.target.result;
        bus.notify('diagramsListed', { diagrams, projectId });
    };
    request.onerror = () => bus.notify('error', 'Failed to list diagrams.');
}

function _deleteDiagram({ diagramId }) {
    const transaction = _db.transaction(['diagrams'], 'readwrite');
    const store = transaction.objectStore('diagrams');
    const request = store.delete(diagramId);
    request.onsuccess = () => bus.notify('diagramDeleted', { diagramId });
    request.onerror = () => bus.notify('error', 'Failed to delete diagram.');
}

function _reset() {
    _db = null;
}

const actions = {
    'do:open': _open,
    'do:createProject': _createProject,
    'do:saveProject': _saveProject,
    'do:listProjects': _listProjects,
    'do:deleteProject': _deleteProject,
    'do:saveDiagram': _saveDiagram,
    'do:loadDiagram': _loadDiagram,
    'do:listDiagrams': _listDiagrams,
    'do:deleteDiagram': _deleteDiagram,
    'reset': _reset,
};

export const storageConcept = {
    subscribe: bus.subscribe,
    notify: bus.notify,
    reset: _reset,
    async listen(event, payload) {
        // For any action that is not 'do:open', ensure the db is open first.
        if (event !== 'do:open' && !_db) {
            await _open();
        }
        if (actions[event]) { // Now that we know _db is ready, proceed.
            actions[event](payload);
        }
    }
};