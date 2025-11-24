import { describe, it, assert, beforeEach } from './test-utils.js';

// Import all concepts to be tested
import { storageConcept } from '../src/concepts/storageConcept.js';
import { projectConcept } from '../src/concepts/projectConcept.js';
import { diagramConcept } from '../src/concepts/diagramConcept.js';
import { uiConcept } from '../src/concepts/uiConcept.js';
import { securityConcept } from '../src/concepts/securityConcept.js';

// Import the wiring
import { initializeApp, synchronizations } from '../src/synchronizations.js';

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

    // Mock JSZip for the download test
    global.JSZip = class {
        constructor() {
            this.files = {};
        }
        file(name, content) {
            this.files[name] = content;
            return this; // for chaining
        }
        generateAsync() {
            return Promise.resolve({ isMockBlob: true, content: this.files });
        }
    };
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

beforeEach(() => {
    // Reset all concepts to a clean state
    const allConcepts = [storageConcept, projectConcept, diagramConcept, uiConcept, securityConcept];
    allConcepts.forEach(c => {
      if (c.state) {
        Object.keys(c.state).forEach(key => {
          c.state[key] = Array.isArray(c.state[key]) ? [] : null;
        });
      }
      const subscribers = c.subscribe(() => {});
      if (subscribers) subscribers.clear();
    });

    // Set up fresh mocks for the test
    setupAllMocks();

    // Initialize the app to connect all the concepts via synchronizations.js
    synchronizations.forEach((sync) => {
        sync.from.subscribe((event, payload) => {
          if (event === sync.when) {
            sync.do(payload);
          }
        });
      });
});

describe('Synchronizations (Integration Tests)', () => {

    it('Storage -> Project -> UI: Initial app load should fetch projects and render the UI', async () => {
        // Arrange: Define what the mock database will return
        mockDbStore.projects = [{ id: 1, name: 'My First Project' }];

        // Act: Trigger the initial load and flush async requests
        projectConcept.actions.loadProjects();
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
        // Arrange: Simulate a UI event for creating a new project
        const projectDetails = { gitProvider: 'github', repositoryPath: 'test/repo', token: 't', password: 'p' };

        // Act
        uiConcept.notify('ui:connectProjectClicked', projectDetails);
        flushMockRequests(); // Flush the 'add' request for the new project
        flushMockRequests(); // Flush the subsequent 'getAll' projects request

        // Assert
        assert.strictEqual(mockDbStore.projects.length, 1, 'There should be one project in the mock DB');
        assert.strictEqual(mockDbStore.projects[0].name, 'test/repo', 'The new project should be in the mock DB');
    });

    it('Storage -> Project -> Diagram: Initial load with empty DB should create a default project and diagram', async () => {
        // Arrange: Ensure the mock database is empty
        mockDbStore.projects = [];
        mockDbStore.diagrams = [];

        // Act: Trigger the initial load
        projectConcept.actions.loadProjects();
        flushMockRequests(); // DB open
        flushMockRequests(); // getAll projects (returns empty)
        flushMockRequests(); // addProject for "Default Project"
        flushMockRequests(); // getAll projects (reloaded)
        flushMockRequests(); // addDiagram for "example.mmd"
        flushMockRequests(); // addSyncQueueItem for the new diagram

        // Assert
        assert.strictEqual(mockDbStore.projects.length, 1, 'A default project should be created');
        assert.strictEqual(mockDbStore.projects[0].name, 'Default Project', 'The project should be named "Default Project"');
        assert.strictEqual(mockDbStore.diagrams.length, 1, 'A default diagram should be created');
        assert.strictEqual(mockDbStore.diagrams[0].title, 'example.mmd', 'The diagram should be named "example.mmd"');
    });

    it('UI -> Diagram -> UI: Creating a new diagram should auto-select it and populate the editor', async () => {
        // Arrange: Set an active project
        projectConcept.state.activeProjectId = 1;

        // Act: Simulate user clicking the "New Diagram" button and flush async requests
        uiConcept.notify('ui:createDiagramClicked', { name: 'My Auto-Selected Diagram' });
        flushMockRequests(); // DB put for the new diagram
        flushMockRequests(); // DB getAll for the diagram list reload

        // Assert
        const diagramState = diagramConcept.getState();
        assert.ok(diagramState.activeDiagram, 'An active diagram should be set');
        assert.strictEqual(diagramState.activeDiagram.title, 'My Auto-Selected Diagram', 'The correct diagram should be selected');

        const editor = mockElements['code-editor'];
        assert.strictEqual(editor.value, diagramState.activeDiagram.content, 'Editor should be populated with the new diagram content');
        
        assert.ok(editor._isFocused, 'Editor should be focused after the new diagram is loaded');
    });
});

describe('UI -> File I/O Synchronizations', () => {
    let downloadFileSpy;

    beforeEach(() => {
        // Spy on the download action
        downloadFileSpy = null;
        uiConcept.actions.downloadFile = (payload) => {
            downloadFileSpy = payload;
        };
    });

    it('UI -> Storage: Uploading .mmd files should create new diagrams', async () => {
        // Arrange
        projectConcept.state.activeProjectId = 1;
        mockDbStore.diagrams = [];
        const uploadedFiles = [
            { name: 'upload1.mmd', content: 'graph TD; A-->B;' },
            { name: 'upload2.mmd', content: 'graph TD; C-->D;' }
        ];

        // Act
        uiConcept.notify('ui:diagramsUploaded', { diagrams: uploadedFiles });
        flushMockRequests(); // addDiagram for upload1
        flushMockRequests(); // addSyncQueue for upload1
        flushMockRequests(); // addDiagram for upload2
        flushMockRequests(); // addSyncQueue for upload2

        // Assert
        assert.strictEqual(mockDbStore.diagrams.length, 2, 'Two new diagrams should be in the mock DB');
        assert.strictEqual(mockDbStore.diagrams[0].title, 'upload1.mmd', 'First uploaded diagram should be saved');
    });

    it('UI -> Action: Export .mmd should trigger a download of the active diagram', async () => {
        // Arrange
        diagramConcept.state.activeDiagram = { id: 5, title: 'active_diagram.mmd', content: 'graph TD; E-->F;' };

        // Act
        uiConcept.notify('ui:exportMmdClicked');

        // Assert
        assert.isNotNull(downloadFileSpy, 'downloadFile action should have been called');
        assert.strictEqual(downloadFileSpy.filename, 'active_diagram.mmd', 'Download filename should match active diagram title');
        assert.strictEqual(downloadFileSpy.content, 'graph TD; E-->F;', 'Download content should match active diagram content');
    });

    it('UI -> Action: Download .zip should trigger a download with all project diagrams', async () => {
        // Arrange
        projectConcept.state.activeProjectId = 1;
        projectConcept.state.projects = [{ id: 1, name: 'My Test Project' }];
        mockDbStore.diagrams = [{ projectId: 1, title: 'file1.mmd', content: 'content1' }, { projectId: 1, title: 'file2.mmd', content: 'content2' }];

        // Act
        uiConcept.notify('ui:downloadProjectClicked');
        flushMockRequests(); // getDiagramsByProjectId

        // Assert
        assert.isNotNull(downloadFileSpy, 'downloadFile action should have been called');
        assert.strictEqual(downloadFileSpy.filename, 'my_test_project_project.zip', 'Download filename for the zip should be correct');
        assert.isTrue(downloadFileSpy.content.isMockBlob, 'Download content should be a (mocked) zip blob');
    });
});