import { describe, it } from './test-helpers.js';
import assert from '../src/assert.js';

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
    while (mockRequests.length > 0) {
        const req = mockRequests.shift();
        if (success && req.onsuccess) {
            req.onsuccess({ target: { result: req.result } });
        } else if (!success && req.onerror) {
            req.onerror({ target: { error: new Error('Mock DB Error') } });
        }
    }
}

function setupAllMocks() {
    // Reset state
    mockDbStore = {};
    mockRequests = [];
    mockElements = {};

    // Mock IndexedDB
    const mockDb = {
        transaction: () => ({
            objectStore: (name) => ({
                // Mock for creating items
                add: (data) => {
                    if (!mockDbStore[name]) mockDbStore[name] = [];
                    const id = mockDbStore[name].length + 1;
                    mockDbStore[name].push({ ...data, id });
                    return createMockRequest(id);
                },
                // Mock for creating/updating items (used by saveDiagram)
                put: (data) => {
                    if (!mockDbStore[name]) mockDbStore[name] = [];
                    // A simple put mock: just add it. A real one would handle updates.
                    const id = data.id || mockDbStore[name].length + 1;
                    mockDbStore[name].push({ ...data, id });
                    return createMockRequest(id);
                },
                // Mock for getting all items (used for projects)
                getAll: () => createMockRequest(mockDbStore[name] || []),
                // Mock for using an index (used for diagrams)
                index: (indexName) => ({
                    getAll: (key) => {
                        const results = (mockDbStore[name] || []).filter(item => item[indexName] === key);
                        return createMockRequest(results);
                    }
                })
            }),
        }),
    };

    global.indexedDB = {
        // The open request should resolve with the mock DB object itself.
        open: () => createMockRequest(mockDb),
    };

    // Mock DOM
    // This list needs to be more complete to support uiConcept initialization.
    const ids = [
        'project-selector', 'diagram-list', 'sidebar-resizer', 'split-view-resizer',
        'project-sidebar', 'main-content', 'code-view', 'diagram-view', 'code-tab',
        'diagram-tab', 'split-view-btn', 'sidebar-toggle-btn', 'new-project-btn',
        'delete-project-btn', 'new-btn', 'save-btn', 'delete-btn', 'rename-btn',
        'export-mmd-btn', 'download-project-btn', 'code-editor', 'new-create-btn',
        'new-cancel-btn', 'render-btn'
    ];
    ids.forEach(id => {
        mockElements[id] = {
            id: id,
            innerHTML: '',
            style: {},
            value: '',
            listeners: {},
            focus: function() { this._isFocused = true; },
            _isFocused: false,
            addEventListener: function(event, callback) { this.listeners[event] = callback; },
            _trigger: function(event) { this.listeners[event]?.({ target: this }); },
            classList: { add: () => {}, remove: () => {}, toggle: () => {} },
            // Add a mock querySelector. It needs to return an object with a classList
            // to prevent the next line in uiConcept from crashing.
            querySelector: function(selector) {
                // Return a mock element that has a classList, or null.
                return { 
                    // It needs both `remove` and `add` to satisfy the _updateActiveDiagramSelection function.
                    classList: { remove: () => {}, add: () => {} } 
                };
            }
        };
    });
    global.document = { getElementById: (id) => mockElements[id] };

    // Mock Mermaid
    uiConcept.setMermaid({ parse: () => Promise.resolve(), render: () => Promise.resolve({ svg: '' }) });
}

function beforeEach() {
    // Reset all concepts to a clean state
    storageConcept.reset();
    projectConcept.reset();
    diagramConcept.reset();
    uiConcept.reset();

    // Set up fresh mocks for the test
    setupAllMocks();

    // Initialize the app to connect all the concepts via synchronizations.js
    initializeApp();
}

describe('Synchronizations (Integration Tests)', () => {

    it('Storage -> Project -> UI: Initial app load should fetch projects and render the UI', async () => {
        beforeEach();
        // Arrange: Define what the mock database will return
        mockDbStore.projects = [{ id: 1, name: 'My First Project' }];

        // Act: The initializeApp() in beforeEach already started the process.
        // We just need to flush the async requests for opening the DB and getting projects.
        flushMockRequests(); // Flushes DB open
        flushMockRequests(); // Flushes getAll projects

        // Assert
        const projectState = projectConcept.getState();
        assert.strictEqual(projectState.projects.length, 1, 'Project concept state should be updated');
        assert.strictEqual(projectState.projects[0].name, 'My First Project', 'Project data should be correct');

        const selectorHtml = mockElements['project-selector'].innerHTML;
        assert.ok(selectorHtml.includes('My First Project'), 'UI should be rendered with the project name');
    });

    it('UI -> Project -> Storage: Creating a new project', async () => {
        beforeEach();
        flushMockRequests(); // Flush DB open
        flushMockRequests(); // Flush initial DB open and project load

        // Act: Simulate the UI event for creating a new project
        uiConcept.notify('ui:newProjectClicked', { name: 'New Test Project' });
        flushMockRequests(); // Flush the 'add' request for the new project
        flushMockRequests(); // Flush the subsequent 'getAll' projects request

        // Assert: Check if the project was added to our mock database
        // The app creates a 'Default Project' on first load, so we expect 2 projects total.
        assert.strictEqual(mockDbStore.projects.length, 2, 'There should be two projects in the mock DB (Default + New)');
        assert.strictEqual(mockDbStore.projects[0].name, 'Default Project', 'The first project should be the default');
        assert.strictEqual(mockDbStore.projects[1].name, 'New Test Project', 'The second project should be our new one');
    });

    it('UI -> Diagram -> UI: Creating a new diagram should auto-select it and populate the editor', async () => {
        beforeEach();
        // Flush initial load
        flushMockRequests(); // DB open
        flushMockRequests(); // Project list
        flushMockRequests(); // Default diagram save
        flushMockRequests(); // Diagram list

        // Arrange: Simulate user clicking the "New Diagram" button and filling out the modal
        uiConcept.notify('ui:createDiagramClicked', { name: 'My Auto-Selected Diagram' });

        // Act: Flush the async requests
        flushMockRequests(); // DB put for the new diagram
        flushMockRequests(); // DB getAll for the diagram list reload

        // Assert
        const diagramState = diagramConcept.getState();
        assert.ok(diagramState.currentDiagram, 'A current diagram should be set');
        assert.strictEqual(diagramState.currentDiagram.name, 'My Auto-Selected Diagram', 'The correct diagram should be selected');

        const editor = mockElements['code-editor'];
        assert.strictEqual(editor.value, diagramState.currentDiagram.content, 'Editor should be populated with the new diagram content');
        
        // Note: The focus assertion is tricky in this mock setup, but we can check our mock property.
        // In a real browser test, you would check document.activeElement.
        assert.ok(editor._isFocused, 'Editor should be focused after the new diagram is loaded');
    });
});