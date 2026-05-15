import { describe, it } from './test-helpers.js';
import assert from '../src/assert.js';
import { installDomMock, textOf } from './shared-test-utils/dom-mock.js';

// Import all concepts to be tested
import { storageConcept } from '../src/concepts/storageConcept.js';
import { projectConcept } from '../src/concepts/projectConcept.js';
import { diagramConcept } from '../src/concepts/diagramConcept.js';
import { uiConcept } from '../src/concepts/uiConcept.js';

// Import the wiring
import { initializeApp } from '../src/synchronizations.js';

// --- Mocks (combined from other test files) ---

let mockDbStore = {};
let mockRequests = [];
let mockElements = {};

function createMockRequest(result) {
    const req = { result, onsuccess: null, onerror: null };
    mockRequests.push(req);
    return req;
}

function flushMockRequests(success = true) {
    const queued = mockRequests.splice(0);
    for (const req of queued) {
        if (success && req.onsuccess) {
            req.onsuccess({ target: { result: req.result } });
        } else if (!success && req.onerror) {
            req.onerror({ target: { error: new Error('Mock DB Error') } });
        }
    }
}

// The router awaits IDB promises before emitting events, so a single flush
// no longer drives the full async chain. Loop flush + microtask drain until
// everything settles.
async function flushAllAsync(rounds = 10) {
    for (let i = 0; i < rounds; i++) {
        flushMockRequests();
        await new Promise((r) => setImmediate(r));
    }
}

function setupAllMocks() {
    mockDbStore = {};
    mockRequests = [];
    mockElements = {};

    // Mock IndexedDB — covers both mermaid_viewer_db (projects/diagrams) and
    // the MermaidIDE.handles DB that Storage.init() opens.
    const mockDb = {
        transaction: () => ({
            objectStore: (name) => ({
                add: (data) => {
                    if (!mockDbStore[name]) mockDbStore[name] = [];
                    const id = mockDbStore[name].length + 1;
                    mockDbStore[name].push({ ...data, id });
                    return createMockRequest(id);
                },
                put: (data) => {
                    if (!mockDbStore[name]) mockDbStore[name] = [];
                    const idx = data.id != null ? mockDbStore[name].findIndex((d) => d.id === data.id) : -1;
                    if (idx >= 0) {
                        mockDbStore[name][idx] = data;
                        return createMockRequest(data.id);
                    }
                    const id = data.id != null ? data.id : mockDbStore[name].length + 1;
                    mockDbStore[name].push({ ...data, id });
                    return createMockRequest(id);
                },
                get: (id) => createMockRequest((mockDbStore[name] || []).find((d) => d.id === id)),
                getAll: () => createMockRequest(mockDbStore[name] || []),
                delete: (id) => {
                    mockDbStore[name] = (mockDbStore[name] || []).filter((d) => d.id !== id);
                    return createMockRequest(undefined);
                },
                index: (indexName) => ({
                    getAll: (key) =>
                        createMockRequest((mockDbStore[name] || []).filter((d) => d[indexName] === key)),
                    getAllKeys: (key) =>
                        createMockRequest((mockDbStore[name] || []).filter((d) => d[indexName] === key).map((d) => d.id)),
                }),
            }),
        }),
    };

    global.indexedDB = { open: () => createMockRequest(mockDb) };

    // Mock DOM — minimum subset uiConcept needs.
    const ids = [
        'project-selector', 'diagram-list', 'sidebar-resizer', 'split-view-resizer',
        'project-sidebar', 'main-content', 'code-view', 'diagram-view', 'code-tab',
        'diagram-tab', 'split-view-btn', 'sidebar-toggle-btn', 'new-project-btn',
        'delete-project-btn', 'new-btn', 'save-btn', 'delete-btn', 'rename-btn',
        'export-mmd-btn', 'download-project-btn', 'code-editor', 'new-create-btn',
        'new-cancel-btn', 'render-btn', 'diagram-container',
    ];
    Object.assign(mockElements, installDomMock(ids));

    uiConcept.setMermaid({ parse: () => Promise.resolve(), render: () => Promise.resolve({ svg: '<svg></svg>' }) });
}

function beforeEach() {
    storageConcept.reset();
    projectConcept.reset();
    diagramConcept.reset();
    uiConcept.reset();
    setupAllMocks();
    initializeApp();
}

describe('Synchronizations (Integration Tests)', () => {
    it('Storage -> Project -> UI: Initial app load fetches projects and renders the UI', async () => {
        beforeEach();
        mockDbStore.projects = [{ id: 1, name: 'My First Project' }];

        await flushAllAsync();

        const projectState = projectConcept.getState();
        assert.strictEqual(projectState.projects.length, 1, 'project concept state updated');
        assert.strictEqual(projectState.projects[0].name, 'My First Project', 'name preserved');
        assert.strictEqual(projectState.projects[0].id, 'idb:1', 'id is the compound form');
        assert.strictEqual(projectState.projects[0].mode, 'idb', 'mode is idb');

        const selectorText = textOf(mockElements['project-selector']);
        assert.ok(selectorText.includes('My First Project'), 'project name appears in the selector');
    });

    it('UI -> Project -> Storage: Creating a new project creates the default first, then the user project', async () => {
        beforeEach();
        await flushAllAsync();

        // No projects yet, so initial load triggered the Default Project.
        uiConcept.notify('ui:newProjectClicked', { name: 'New Test Project' });
        await flushAllAsync();

        assert.strictEqual(mockDbStore.projects.length, 2, 'two IDB projects: Default + New');
        assert.strictEqual(mockDbStore.projects[0].name, 'Default Project');
        assert.strictEqual(mockDbStore.projects[1].name, 'New Test Project');
    });

    it('UI -> Diagram -> UI: Creating a new diagram auto-selects it and populates the editor', async () => {
        beforeEach();
        await flushAllAsync();

        uiConcept.notify('ui:createDiagramClicked', { name: 'My Auto-Selected Diagram' });
        await flushAllAsync();

        const diagramState = diagramConcept.getState();
        assert.ok(diagramState.currentDiagram, 'current diagram is set');
        assert.strictEqual(diagramState.currentDiagram.name, 'My Auto-Selected Diagram');
        assert.ok(diagramState.currentDiagram.id?.startsWith('idb:'), 'compound id used');
        assert.ok(diagramState.currentDiagram.projectId?.startsWith('idb:'), 'compound projectId used');

        const editor = mockElements['code-editor'];
        assert.strictEqual(editor.value, diagramState.currentDiagram.content, 'editor populated');
        assert.ok(editor._isFocused, 'editor focused');
    });
});
