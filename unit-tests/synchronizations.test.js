import { describe, it, assert, beforeEach } from './test-utils.js';

// Import all concepts to be tested
import { storageConcept } from '../src/concepts/storageConcept.js';
import { projectConcept } from '../src/concepts/projectConcept.js';
import { diagramConcept } from '../src/concepts/diagramConcept.js';
import { uiConcept } from '../src/concepts/uiConcept.js';
import { securityConcept } from '../src/concepts/securityConcept.js';
import { gitAbstractionConcept } from '../src/concepts/gitAbstractionConcept.js';

// Import the wiring
import { initializeApp, synchronizations } from '../src/synchronizations.js';

// --- Mocks (combined from other test files) ---

let mockDbStore = {};
let mockRequests = [];
let mockElements = {};
let syncTriggered = false;

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
    syncTriggered = false;
    global.confirm = () => true; // Auto-confirm any confirmation dialogs

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
                    let id = data.id;
                    const existingIndex = id ? mockDbStore[name].findIndex(item => item.id === id) : -1;
                    if (existingIndex > -1) {
                        mockDbStore[name][existingIndex] = { ...mockDbStore[name][existingIndex], ...data };
                    } else {
                        id = mockDbStore[name].length + 1;
                        mockDbStore[name].push({ ...data, id });
                    }
                    return createMockRequest(id);
                },
                get: (key) => createMockRequest(mockDbStore[name]?.find(item => item.id === key) || null),
                delete: (key) => {
                    mockDbStore[name] = (mockDbStore[name] || []).filter(item => item.id !== key);
                    return createMockRequest(undefined);
                },
                // Mock for getting all items (used for projects)
                getAll: () => createMockRequest(mockDbStore[name] || []),
                // Mock for using an index (used for diagrams)
                index: (indexName) => ({
                    getAll: (key) => {
                        const results = (mockDbStore[name] || []).filter(item => item[indexName] === key);
                        return createMockRequest(results);
                    }
                }),
                openCursor: (range) => ({
                    onsuccess: (event) => {
                        // Simplified mock: just resolve immediately as if all items were deleted.
                        // A more complex mock could iterate, but this is sufficient for the test.
                        const req = createMockRequest(null);
                        flushMockRequests();
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
        'diagram-tab', 'split-view-btn', 'sidebar-toggle-btn', 'new-project-btn', 'project-settings-btn',
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

function getMockElement(id) {
    return mockElements[id] || { style: {}, addEventListener: () => {}, classList: { add: () => {}, remove: () => {} } };
}
function setupSyncTriggerSpy() {
    const originalTrigger = syncService.actions.triggerSync;
    syncService.actions.triggerSync = () => {
        syncTriggered = true;
        originalTrigger();
    };
}

beforeEach(() => {
    // Reset all concepts to a clean state
    const allConcepts = [storageConcept, projectConcept, diagramConcept, uiConcept, securityConcept, gitAbstractionConcept];
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
    setupSyncTriggerSpy();

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

        gitAbstractionConcept.actions.getRepoInfo = () => Promise.resolve({ default_branch: 'main' });
        // Act
        uiConcept.notify('ui:connectProjectClicked', projectDetails);
        flushMockRequests(); // Flush the 'add' request for the new project
        flushMockRequests(); // Flush the subsequent 'getAll' projects request

        // Assert
        assert.strictEqual(mockDbStore.projects.length, 1, 'There should be one project in the mock DB');
        assert.strictEqual(mockDbStore.projects[0]['schema:name'], 'test/repo', 'The new project should be in the mock DB');
    });

    it('[INTEGRATION] Creating a new project should auto-select it', async () => {
        let renderProjectSelectorCalled = false;
        uiConcept.actions.renderProjectSelector = () => {
            renderProjectSelectorCalled = true;
        };

        // Arrange
        const projectDetails = { gitProvider: 'local', name: 'Auto-Selected Project' };

        // Act
        uiConcept.notify('ui:connectProjectClicked', projectDetails);
        flushMockRequests(true); // addProject
        flushMockRequests(true); // addProject (update with @id)

        // Assert
        assert.strictEqual(projectConcept.state.activeProjectId, 1, 'The newly created project should be set as active');
        assert.isTrue(renderProjectSelectorCalled, 'The UI should be instructed to re-render the project selector');
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
        assert.strictEqual(mockDbStore.projects[0]['schema:name'], 'Default Project', 'The project should be named "Default Project"');
        assert.strictEqual(mockDbStore.diagrams.length, 1, 'A default diagram should be created');
        assert.strictEqual(mockDbStore.diagrams[0]['schema:name'], 'example.mmd', 'The diagram should be named "example.mmd"');
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

        const editor = getMockElement('code-editor');
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

    it('UI -> Project: Renaming a project should update its name in storage', async () => {
        // Arrange
        mockDbStore.projects = [{ id: 1, name: 'Old Name' }];
        projectConcept.state.projects = mockDbStore.projects;
        projectConcept.state.activeProjectId = 1;

        // Act: Simulate user renaming the project in the settings modal
        uiConcept.notify('ui:renameProjectConfirmed', { projectId: 1, newName: 'New Name' });
        flushMockRequests(); // getAllProjects
        flushMockRequests(); // updateProject
        flushMockRequests(); // getAllProjects (from loadProjects)

        // Assert
        assert.strictEqual(mockDbStore.projects[0]['schema:name'], 'New Name', 'Project name should be updated in the mock DB');
    });

    it('UI -> Project: Disconnecting a Git project should turn it into a local project', async () => {
        // Arrange
        const gitProject = {
            id: 1,
            name: 'Git Project',
            gitProvider: 'github',
            repositoryPath: 'owner/repo',
            encryptedToken: { ciphertext: 'abc' }
        };
        mockDbStore.projects = [gitProject];
        // Simulate the project being active in the settings modal
        projectConcept.state.projects = [gitProject];

        // Act: Simulate user confirming disconnect in the UI
        uiConcept.notify('ui:disconnectProjectConfirmed', { projectId: 1 });
        flushMockRequests(); // getProject
        flushMockRequests(); // updateProject
        flushMockRequests(); // getAllProjects (from loadProjects)

        // Assert
        const updatedProject = mockDbStore.projects.find(p => p.id === 1);
        assert.strictEqual(updatedProject.gitProvider, 'local', 'Project provider should be changed to local');
        assert.isNull(updatedProject.encryptedToken, 'Project should no longer have an encrypted token');
    });

    it('UI -> Project: Connecting a local project to Git should update its properties', async () => {
        // Arrange
        const localProject = { id: 1, name: 'Local Project', gitProvider: 'local', repositoryPath: null };
        mockDbStore.projects = [localProject];
        projectConcept.state.projects = [localProject];

        const connectPayload = {
            projectId: 1,
            gitProvider: 'github',
            repositoryPath: 'owner/repo',
            token: 'fake-token',
            password: 'fake-password',
        };

        // Mock successful API validation
        gitAbstractionConcept.actions.getRepoInfo = () => Promise.resolve({ default_branch: 'main' });
        securityConcept.actions.encryptToken = () => Promise.resolve({ ciphertext: 'encrypted' });

        // Act
        uiConcept.notify('ui:connectExistingLocalProjectConfirmed', connectPayload);
        flushMockRequests(); // getProject
        flushMockRequests(); // updateProject
        flushMockRequests(); // setProjects

        // Assert
        const updatedProject = mockDbStore.projects.find(p => p.id === 1);
        assert.strictEqual(updatedProject.gitProvider, 'github', 'Project provider should be updated to github');
        assert.strictEqual(updatedProject.repositoryPath, 'owner/repo', 'Repository path should be set');
        assert.isNotNull(updatedProject.encryptedToken, 'An encrypted token should now exist');
        assert.isTrue(syncTriggered, 'A sync should be triggered after connecting a project');
    });

    it('UI -> Diagram: Deleting a local-only diagram should remove it from the sync queue', async () => {
        // Arrange
        projectConcept.state.activeProjectId = 1;
        mockDbStore.diagrams = [{ id: 10, projectId: 1, title: 'local-only.mmd', lastModifiedRemoteSha: null }];
        // This item was added to the queue when the diagram was first created
        mockDbStore.syncQueue = [{ id: 100, diagramId: 10, action: 'create', payload: { title: 'local-only.mmd' } }];

        // Act: Simulate user deleting the diagram
        uiConcept.notify('ui:deleteDiagramClicked');
        // The confirm() dialog is mocked to return true
        flushMockRequests(); // getDiagram
        flushMockRequests(); // getSyncQueueItems
        flushMockRequests(); // deleteSyncQueueItem
        flushMockRequests(); // deleteDiagram
        flushMockRequests(); // getDiagramsByProjectId

        // Assert
        assert.strictEqual(mockDbStore.diagrams.length, 0, 'Diagram should be deleted from the database');
        assert.strictEqual(mockDbStore.syncQueue.length, 0, 'The pending "create" action should be purged from the sync queue');
    });
});

describe('Global Password Architecture (Integration Tests)', () => {
    it('Creating a second Git project should reuse the session password', async () => {
        let firstPasswordUsed = '';
        let secondPasswordUsed = '';

        // Arrange: Spy on encryptToken to capture the password used
        const originalEncrypt = securityConcept.actions.encryptToken;
        securityConcept.actions.encryptToken = (token, password) => {
            if (!firstPasswordUsed) firstPasswordUsed = password;
            else secondPasswordUsed = password;
            return originalEncrypt(token, password);
        };
        gitAbstractionConcept.actions.getRepoInfo = () => Promise.resolve({ default_branch: 'main' });

        // Act 1: Create the first project, which sets the session password
        const project1Details = { gitProvider: 'github', repositoryPath: 'owner/repo1', token: 't1', password: 'my-global-password' };
        uiConcept.notify('ui:connectProjectClicked', project1Details);
        flushMockRequests(); // addProject
        flushMockRequests(); // getAllProjects

        // Act 2: Create the second project WITHOUT providing a password
        const project2Details = { gitProvider: 'github', repositoryPath: 'owner/repo2', token: 't2' }; // No password
        uiConcept.notify('ui:connectProjectClicked', project2Details);
        flushMockRequests(); // addProject
        flushMockRequests(); // getAllProjects

        // Assert
        assert.strictEqual(firstPasswordUsed, 'my-global-password', 'First project should use the provided password');
        assert.strictEqual(secondPasswordUsed, 'my-global-password', 'Second project should reuse the password from the session');
        assert.strictEqual(securityConcept.state.sessionPassword, 'my-global-password', 'Session password should be set');
    });

    it('Switching between two Git projects should not require re-authentication if session is unlocked', async () => {
        let unlockModalShown = false;
        uiConcept.actions.showUnlockSessionModal = () => { unlockModalShown = true; };

        // Arrange: Set up two Git projects and an unlocked session
        const project1 = { id: 1, name: 'Project A', gitProvider: 'github', encryptedToken: { data: 'abc' } };
        const project2 = { id: 2, name: 'Project B', gitProvider: 'github', encryptedToken: { data: 'xyz' } };
        projectConcept.state.projects = [project1, project2];
        securityConcept.state.sessionPassword = 'my-global-password'; // Session is unlocked

        // Act 1: Select the first project
        projectConcept.actions.setActiveProject(1);
        flushMockRequests();

        // Assert 1
        assert.isFalse(unlockModalShown, 'Unlock modal should NOT be shown for Project A');
        assert.isTrue(syncTriggered, 'Sync should be triggered for Project A');

        // Act 2: Select the second project
        syncTriggered = false; // Reset spy
        projectConcept.actions.setActiveProject(2);
        flushMockRequests();

        // Assert 2
        assert.isFalse(unlockModalShown, 'Unlock modal should NOT be shown for Project B');
        assert.isTrue(syncTriggered, 'Sync should be triggered for Project B');
    });
});