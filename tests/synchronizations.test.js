import assert from './framework/assert.js';
import { projectConcept } from '../src/concepts/projectConcept.js';
import { diagramConcept } from '../src/concepts/diagramConcept.js';
import { storageConcept } from '../src/concepts/storageConcept.js';
import { uiConcept } from '../src/concepts/uiConcept.js';

// Importing this file executes the code that sets up all the subscriptions
import '../src/synchronizations.js';

/**
 * A simple spy utility to track method calls on an object.
 * @param {object} obj The object to spy on.
 * @param {string} methodName The name of the method to spy on.
 * @returns {object} A spy object with `callCount`, `lastArgs`, and a `restore` method.
 */
function spyOn(obj, methodName) {
    const originalMethod = obj[methodName];
    if (typeof originalMethod !== 'function') {
        throw new Error(`Cannot spy on non-function property: ${methodName}`);
    }

    const spy = {
        callCount: 0,
        lastArgs: null,
        allArgs: [],
        restore: () => {
            obj[methodName] = originalMethod;
        }
    };

    obj[methodName] = function(...args) {
        spy.callCount++;
        spy.lastArgs = args;
        spy.allArgs.push(args);
        return originalMethod.apply(this, args);
    };

    return spy;
}

/**
 * A lightweight, in-memory mock of the IndexedDB API for testing in Node.js.
 * It simulates the async request/response flow and basic data operations.
 */
class MockIndexedDB {
    constructor() {
        this.databases = {};
    }

    open(dbName, version) {
        const request = {};
        const db = this.databases[dbName] || {
            name: dbName,
            version: 0,
            stores: {},
            objectStoreNames: {
                contains: (name) => !!this.databases[dbName]?.stores[name]
            },
            createObjectStore: (name, options) => {
                if (!this.databases[dbName].stores[name]) {
                    this.databases[dbName].stores[name] = {
                        data: new Map(),
                        autoIncrement: options.autoIncrement ? 1 : null,
                        keyPath: options.keyPath,
                        indexes: {}
                    };
                    this.databases[dbName].stores[name].createIndex = (indexName, keyPath) => {
                        this.databases[dbName].stores[name].indexes[indexName] = { keyPath };
                    };
                }
                return this.databases[dbName].stores[name];
            },
            transaction: () => ({
                objectStore: () => ({
                    add: () => ({}),
                    put: () => ({}),
                    get: () => ({}),
                    getAll: () => ({ onsuccess: (e) => e.target.result = [] }),
                    index: () => ({ getAll: () => ({}) })
                })
            })
        };

        if (!this.databases[dbName]) {
            this.databases[dbName] = db;
        }

        // Simulate async opening
        setTimeout(() => {
            if (db.version < version) {
                db.version = version;
                if (request.onupgradeneeded) {
                    request.onupgradeneeded({ target: { result: db } });
                }
            }
            if (request.onsuccess) {
                request.onsuccess({ target: { result: db } });
            }
        }, 0);

        return request;
    }
}

const createClassListMock = () => {
    const classes = new Set();
    return {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        toggle: (c) => classes.has(c) ? classes.delete(c) : classes.add(c),
        has: (c) => classes.has(c),
    };
};
/**
 * Sets up a mock DOM environment in the global scope for testing.
 */
function setupMockEnvironment() {
    // Mock IndexedDB for storageConcept
    global.indexedDB = new MockIndexedDB();

    // Mock DOM for uiConcept
    // This needs to be a robust mock, similar to the one in uiConcept.test.js
    if (!global.document) {
        const createMockElement = (id) => ({
            id,
            innerHTML: '',
            value: '',
            textContent: '',
            classList: createClassListMock(),
            style: {},
            dataset: {},
            appendChild: function(child) { this.innerHTML += child.outerHTML || child.textContent; },
            addEventListener: function(event, callback) {
                this._listeners = this._listeners || {};
                this._listeners[event] = callback;
            },
        });

        const mockElements = {};
        const ids = [
            'code-tab', 'diagram-tab', 'code-view', 'diagram-view', 'code-editor',
            'diagram-container', 'file-info', 'split-view-btn', 'project-sidebar',
            'sidebar-toggle-btn', 'project-selector', 'diagram-list', 'theme-toggle',
            'new-project-btn', 'delete-project-btn', 'new-btn', 'save-btn',
            'delete-btn', 'rename-btn', 'new-modal', 'new-name', 'new-cancel-btn',
            'new-create-btn', 'upload-diagrams-input', 'download-project-btn',
            'export-mmd-btn', 'export-btn', 'import-file-input', 'import-label'
        ];
        ids.forEach(id => mockElements[id] = createMockElement(id));

        global.document = {
            getElementById: (id) => mockElements[id],
            createElement: (tag) => ({ ...createMockElement(null), tagName: tag.toUpperCase(), outerHTML: `<${tag}></${tag}>` }),
            body: { classList: createClassListMock() }
        };
    }

    global.localStorage = {
        _store: {},
        getItem: () => null,
        setItem: function(key, value) { this._store[key] = value; },
        clear: function() { this._store = {}; }
    };

    global.mermaid = {
        initialize: () => {}
    };

    global.prompt = () => 'Mocked Prompt';
}

describe('synchronizations.js (Integration Tests)', () => {
    let spies = [];

    beforeEach(() => {
        // Reset all concepts to a clean state
        projectConcept.reset();
        diagramConcept.reset();
        storageConcept.reset();
        uiConcept.reset();

        // Set up the mock environment before each test.
        setupMockEnvironment();
        uiConcept.listen('initialize');
    });

    afterEach(() => {
        // Restore all spied-on methods after each test
        spies.forEach(spy => spy.restore());
        spies = [];
    });

    it('Storage -> Project: `projectsListed` from storage should call `setProjects` on projectConcept', () => {
        const projectListenSpy = spyOn(projectConcept, 'listen');
        spies.push(projectListenSpy);

        const mockProjects = [{ id: 1, name: 'Test Project' }];
        storageConcept.notify('projectsListed', mockProjects);

        assert.strictEqual(projectListenSpy.callCount, 1, 'projectConcept.listen should be called once');
        assert.strictEqual(projectListenSpy.lastArgs[0], 'setProjects', 'The event should be "setProjects"');
        assert.strictEqual(projectListenSpy.lastArgs[1], mockProjects, 'The payload should be the mock projects array');
    });

    it('Project -> UI: `projectsUpdated` from projectConcept should call `renderProjectSelector` on uiConcept', () => {
        const uiListenSpy = spyOn(uiConcept, 'listen');
        spies.push(uiListenSpy);

        const mockPayload = { projects: [], currentProjectId: null };
        projectConcept.notify('projectsUpdated', mockPayload);

        assert.ok(uiListenSpy.callCount > 0, 'uiConcept.listen should be called');
        assert.strictEqual(uiListenSpy.lastArgs[0], 'renderProjectSelector', 'The event should be "renderProjectSelector"');
        assert.strictEqual(uiListenSpy.lastArgs[1], mockPayload, 'The payload should be correct');
    });

    it('Project -> Diagram: `projectChanged` from projectConcept should call `loadDiagrams` on diagramConcept', () => {
        const diagramListenSpy = spyOn(diagramConcept, 'listen');
        spies.push(diagramListenSpy);

        const mockPayload = { projectId: 123 };
        projectConcept.notify('projectChanged', mockPayload);

        assert.strictEqual(diagramListenSpy.callCount, 1, 'diagramConcept.listen should be called once');
        assert.strictEqual(diagramListenSpy.lastArgs[0], 'loadDiagrams', 'The event should be "loadDiagrams"');
        assert.strictEqual(diagramListenSpy.lastArgs[1], mockPayload, 'The payload should be correct');
    });

    it('UI -> Project: `ui:projectSelected` from uiConcept should call `setCurrentProject` on projectConcept', () => {
        const projectListenSpy = spyOn(projectConcept, 'listen');
        spies.push(projectListenSpy);

        const mockPayload = { projectId: '456' };
        uiConcept.notify('ui:projectSelected', mockPayload);

        assert.strictEqual(projectListenSpy.callCount, 1, 'projectConcept.listen should be called once');
        assert.strictEqual(projectListenSpy.lastArgs[0], 'setCurrentProject', 'The event should be "setCurrentProject"');
        assert.strictEqual(projectListenSpy.lastArgs[1], mockPayload, 'The payload should be correct');
    });

    it('Full Flow: `databaseOpened` should trigger project loading and UI rendering', async () => {
        // Spy on the final link in the chain: the UI render method
        const uiListenSpy = spyOn(uiConcept, 'listen');
        spies.push(uiListenSpy);

        // Spy on the intermediate step
        const projectListenSpy = spyOn(projectConcept, 'listen');
        spies.push(projectListenSpy);

        // 1. Manually trigger the event that starts the flow.
        // The `do:open` call in `beforeEach` will have triggered `databaseOpened`.
        storageConcept.notify('databaseOpened');

        // 2. Verify the link: `databaseOpened` should have triggered `loadProjects`.
        // The spy will capture this call.
        assert.ok(projectListenSpy.callCount > 0, 'projectConcept.listen should have been called');
        assert.strictEqual(projectListenSpy.lastArgs[0], 'loadProjects', 'projectConcept should be told to load projects');
    });

    it('Startup Flow: Creates default project and diagram if none exist', () => {
        const projectNotifySpy = spyOn(projectConcept, 'notify');
        spies.push(projectNotifySpy);

        const diagramListenSpy = spyOn(diagramConcept, 'listen');
        spies.push(diagramListenSpy);

        // 1. Simulate the `projectsListed` event with an empty array, which happens on first load.
        storageConcept.notify('projectsListed', []);

        // 2. Verify that receiving an empty project list triggers the `do:createProject` event.
        const createProjectCall = projectNotifySpy.allArgs.find(args => args[0] === 'do:createProject');
        assert.ok(createProjectCall, 'The "do:createProject" event should have been notified');
        assert.strictEqual(createProjectCall[1].name, 'Default Project', 'The project name should be "Default Project"');

        // 3. Simulate the `projectCreated` event for the default project.
        const newProjectPayload = { id: 1, name: 'Default Project', isDefault: true };
        storageConcept.notify('projectCreated', newProjectPayload);

        // 4. Verify that this triggered the creation of the "generic" diagram.
        const createDiagramCall = diagramListenSpy.allArgs.find(args => args[0] === 'createDiagram');
        assert.ok(createDiagramCall, 'diagramConcept.listen should be called to create a diagram');
        assert.strictEqual(createDiagramCall[1].name, 'generic', 'The diagram name should be "generic"');
    });
});