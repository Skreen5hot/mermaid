import { storageConcept } from '../../src/concepts/storageConcept.js';
import assert from '../framework/assert.js';

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
            transaction: (storeNames, mode) => ({
                objectStore: (name) => {
                    const store = this.databases[dbName].stores[name];
                    return {
                        add: (value) => {
                            const addRequest = {};
                            const id = store.autoIncrement ? store.autoIncrement++ : value[store.keyPath];
                            if (!value[store.keyPath]) value[store.keyPath] = id;
                            store.data.set(id, value);
                            setTimeout(() => addRequest.onsuccess({ target: { result: id } }), 0);
                            return addRequest;
                        },
                        get: (key) => {
                            const getRequest = {};
                            const result = store.data.get(key);
                            setTimeout(() => getRequest.onsuccess({ target: { result } }), 0);
                            return getRequest;
                        },
                        getAll: () => {
                            const getAllRequest = {};
                            const result = Array.from(store.data.values());
                            setTimeout(() => getAllRequest.onsuccess({ target: { result } }), 0);
                            return getAllRequest;
                        },
                        index: (indexName) => ({
                            getAll: (key) => {
                                const indexRequest = {};
                                const index = store.indexes[indexName];
                                const result = Array.from(store.data.values()).filter(item => item[index.keyPath] === key);
                                setTimeout(() => indexRequest.onsuccess({ target: { result } }), 0);
                                return indexRequest;
                            }
                        })
                    };
                }
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

/**
 * A helper to capture all events emitted by a concept's event bus during a test.
 * @param {object} concept The concept to monitor.
 * @returns {Array<{event: string, payload: any}>} A list of captured events.
 */
function captureEvents(concept) {
    const events = [];
    concept.subscribe((event, payload) => {
        events.push({ event, payload });
    });
    return events;
}

/**
 * Helper to wait for a specific event to be emitted.
 * @param {Array} events The array of captured events.
 * @param {string} eventName The name of the event to wait for.
 * @returns {Promise<object>} A promise that resolves with the event object.
 */
function waitForEvent(events, eventName) {
    return new Promise((resolve) => {
        const check = () => {
            const found = events.find(e => e.event === eventName);
            if (found) {
                resolve(found);
            } else {
                setTimeout(check, 10); // Check again shortly
            }
        };
        check();
    });
}

describe('storageConcept.js', () => {
    beforeEach(() => {
        // Inject the mock IndexedDB into the global scope before each test
        global.indexedDB = new MockIndexedDB();
        // Reset the concept to ensure it uses the new mock DB connection
        storageConcept.reset();
    });

    it("listen('do:open') should attempt to open the database and emit databaseOpened", async () => {
        const events = captureEvents(storageConcept);
        storageConcept.listen('do:open');

        const dbEvent = await waitForEvent(events, 'databaseOpened');
        assert.ok(dbEvent, 'databaseOpened event should be emitted');
    });

    it("listen('do:createProject') should add a project and emit projectCreated", async () => {
        const events = captureEvents(storageConcept);

        // First, open the database
        storageConcept.listen('do:open');
        await waitForEvent(events, 'databaseOpened');

        // Now, create a project
        storageConcept.listen('do:createProject', { name: 'Test Project' });

        const createdEvent = await waitForEvent(events, 'projectCreated');
        assert.ok(createdEvent, 'projectCreated event should be emitted');
        assert.strictEqual(createdEvent.payload.name, 'Test Project', 'Payload should contain the correct name');
        assert.ok(createdEvent.payload.id, 'Payload should contain the new project ID');
    });

    it("listen('do:listProjects') should emit projectsListed with data", async () => {
        const events = captureEvents(storageConcept);

        // Open DB and create a project first
        storageConcept.listen('do:open');
        await waitForEvent(events, 'databaseOpened');
        storageConcept.listen('do:createProject', { name: 'Project One' });
        await waitForEvent(events, 'projectCreated');

        // Now, list the projects
        storageConcept.listen('do:listProjects');

        const listedEvent = await waitForEvent(events, 'projectsListed');
        assert.ok(listedEvent, 'projectsListed event should be emitted');
        assert.ok(Array.isArray(listedEvent.payload), 'Payload should be an array');
        assert.strictEqual(listedEvent.payload.length, 1, 'Payload should contain one project');
        assert.strictEqual(listedEvent.payload[0].name, 'Project One', 'Project name should be correct');
    });

    it("listen('do:loadDiagram') should emit diagramLoaded with the correct diagram", async () => {
        const events = captureEvents(storageConcept);

        // Open DB and save a diagram
        storageConcept.listen('do:open');
        await waitForEvent(events, 'databaseOpened');
        const mockDiagram = { name: 'My Diagram', projectId: 1, content: 'graph TD; A-->B' };
        storageConcept.listen('do:saveDiagram', { diagramData: mockDiagram });
        const savedEvent = await waitForEvent(events, 'diagramSaved');
        const diagramId = savedEvent.payload.id;

        // Now, load the diagram
        storageConcept.listen('do:loadDiagram', { diagramId });

        const loadedEvent = await waitForEvent(events, 'diagramLoaded');
        assert.ok(loadedEvent, 'diagramLoaded event should be emitted');
        assert.strictEqual(loadedEvent.payload.id, diagramId, 'Loaded diagram should have the correct ID');
        assert.strictEqual(loadedEvent.payload.name, 'My Diagram', 'Loaded diagram should have the correct name');
    });
});