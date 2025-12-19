import { describe, it, assert, beforeEach } from '../test-utils.js';
import { storageConcept } from '../../src/concepts/storageConcept.js';

// Mock the normalization functions for testing purposes
import { normalizeDiagram, normalizeProject } from '../../src/utils/normalization.js';
// --- Mock IndexedDB ---

let mockDbStore = {};
let mockDbIndexes = {};
let nextId = 1;

const mockIndexedDB = {
  open: (name, version) => {
    const request = {};
    // Mock the DB object that gets returned
    const db = {
      objectStoreNames: {
        contains: (storeName) => !!mockDbStore[storeName],
      },
      createObjectStore: (storeName, options) => {
        if (!mockDbStore[storeName]) {
          // Initialize store and its indexes
          mockDbStore[storeName] = [];
          mockDbIndexes[storeName] = {};
        }
        const store = {
          createIndex: (indexName, keyPath) => {
            mockDbIndexes[storeName][indexName] = { keyPath };
          },
        };
        return store;
      },
      transaction: (storeName) => ({
        objectStore: (name) => ({
          put: (item) => { // Handles both add and update
            const req = {};
            const store = mockDbStore[name];
            let id = item.id;
            if (options.autoIncrement && !id) { // For auto-incrementing stores
              id = nextId++;
              item.id = id;
              store.push(item);
            } else if (id) { // For items with pre-defined IDs or updates
              const index = store.findIndex(i => i.id === id);
              if (index > -1) store[index] = item;
              else store.push(item);
            } else { // Fallback for non-auto-incrementing stores without an ID
                id = nextId++; // Still assign an ID for mock consistency
                item.id = id;
                store.push(item);
            }
            setTimeout(() => req.onsuccess({ target: { result: item.id || id } }), 0);
            return req;
          },
          get: (key) => {
            const req = {};
            const item = mockDbStore[name].find(i => i.id === key);
            setTimeout(() => req.onsuccess({ target: { result: item } }), 0);
            return req;
          },
          getAll: () => {
            const req = {};
            setTimeout(() => req.onsuccess({ target: { result: [...mockDbStore[name]] } }), 0);
            return req;
          },
          delete: (key) => {
            const req = {};
            mockDbStore[name] = mockDbStore[name].filter(i => i.id !== key);
            setTimeout(() => req.onsuccess({ target: { result: undefined } }), 0);
            return req;
          },
          index: (indexName) => ({
            getAll: (key) => {
              const req = {};
              const indexInfo = mockDbIndexes[name][indexName];
              const results = mockDbStore[name].filter(i => i[indexInfo.keyPath] === key);
              setTimeout(() => req.onsuccess({ target: { result: results } }), 0);
              return req;
            },
            openCursor: (keyRange) => {
                const req = {};
                const indexInfo = mockDbIndexes[name][indexName];
                const matches = mockDbStore[name].filter(i => i[indexInfo.keyPath] === keyRange);
                let cursorIndex = 0;
                
                const advanceCursor = () => {
                    if (cursorIndex < matches.length) {
                        const cursor = {
                            value: matches[cursorIndex],
                            delete: () => {
                                mockDbStore[name] = mockDbStore[name].filter(i => i.id !== cursor.value.id);
                            },
                            continue: () => {
                                cursorIndex++;
                                advanceCursor();
                            }
                        };
                        req.onsuccess({ target: { result: cursor } });
                    } else {
                        req.onsuccess({ target: { result: null } }); // No more items
                    }
                };
                setTimeout(advanceCursor, 0);
                return req;
            }
          }),
        }),
      }),
    };

    setTimeout(() => {
      if (request.onupgradeneeded) request.onupgradeneeded({ target: { result: db } });
      if (request.onsuccess) request.onsuccess({ target: { result: db } });
    }, 0);
    return request;
  },
};

global.indexedDB = mockIndexedDB;

// --- Tests ---

describe('Storage Concept', () => {

  beforeEach(async () => {
    // Reset state and mock DB before each test
    storageConcept.state.db = null;
    mockDbStore = {};
    mockDbIndexes = {};
    nextId = 1;
    // Initialize the concept, which will set up the mock DB schema
    await storageConcept.actions.init();
  });

  // Helper to check if an object is in simple JSON format (not JSON-LD)
  const isSimpleJson = (obj) => !obj['@context'] && !obj['@type'];
  const isJsonLd = (obj) => obj['@context'] && obj['@type'];

  describe('Project CRUD', () => {
    it('[UNIT] should add and get a project', async () => {
      const project = { name: 'Project Alpha' };
      const id = await storageConcept.actions.addProject(project);
      assert.strictEqual(id, 1, 'Should return the new ID');

      const retrieved = await storageConcept.actions.getAllProjects();
      assert.strictEqual(retrieved.length, 1, 'Should have one project in the store');
      assert.strictEqual(retrieved[0].name, 'Project Alpha', 'Project name should match');
      assert.isTrue(isSimpleJson(retrieved[0]), 'Retrieved project should be in simple JSON format');
    });

    it('[UNIT] should get a project and normalize JSON-LD data', async () => {
      // Simulate a project stored in JSON-LD format
      const jsonLdProject = {
        id: 10, // Pre-defined ID for direct retrieval
        "@context": "https://mermaid-ide.org/context/v1.jsonld",
        "@id": "urn:mermaid-ide:project:10",
        "@type": "bfo:BFO_0000027",
        "schema:name": "JSON-LD Project",
        "gitProvider": "github",
        "repositoryPath": "test/repo",
        "defaultBranch": "main",
        "lastSyncSha": "abc",
        "encryptedToken": { "ciphertext": "xyz" },
        "schema:dateCreated": "2023-01-01T00:00:00Z",
        "schema:dateModified": "2023-01-02T00:00:00Z"
      };
      mockDbStore.projects.push(jsonLdProject);

      const retrieved = await storageConcept.actions.getProject(10);
      assert.isNotNull(retrieved, 'Project should be retrieved');
      assert.isTrue(isSimpleJson(retrieved), 'Retrieved project should be in simple JSON format');
      assert.strictEqual(retrieved.id, 10, 'ID should be correctly parsed');
      assert.strictEqual(retrieved.name, 'JSON-LD Project', 'Name should be correctly parsed');
      assert.strictEqual(retrieved.gitProvider, 'github', 'gitProvider should be preserved');
      assert.strictEqual(retrieved.repositoryPath, 'test/repo', 'repositoryPath should be preserved');
      assert.strictEqual(retrieved.defaultBranch, 'main', 'defaultBranch should be preserved');
      assert.strictEqual(retrieved.lastSyncSha, 'abc', 'lastSyncSha should be preserved');
      assert.deepStrictEqual(retrieved.encryptedToken, { "ciphertext": "xyz" }, 'encryptedToken should be preserved');
      assert.instanceOf(retrieved.createdAt, Date, 'createdAt should be a Date object');
      assert.instanceOf(retrieved.updatedAt, Date, 'updatedAt should be a Date object');
      assert.strictEqual(retrieved.createdAt.toISOString(), '2023-01-01T00:00:00.000Z', 'createdAt should match');
    });

    it('[UNIT] should update a project', async () => {
      const project = { name: 'Project Beta' };
      const id = await storageConcept.actions.addProject(project);
      
      const projectToUpdate = { id, name: 'Project Beta Updated' };
      await storageConcept.actions.updateProject(projectToUpdate);

      const retrieved = await storageConcept.actions.getAllProjects();
      assert.strictEqual(retrieved.length, 1, 'Should still have one project');
      assert.strictEqual(retrieved[0].name, 'Project Beta Updated', 'Project name should be updated');
    });

    it('[UNIT] should delete a project', async () => {
      const id = await storageConcept.actions.addProject({ name: 'Project Gamma' });
      await storageConcept.actions.deleteProject(id);

      const retrieved = await storageConcept.actions.getAllProjects();
      assert.strictEqual(retrieved.length, 0, 'Projects store should be empty');
    });
  });

  describe('Diagram CRUD', () => {
    it('[UNIT] should add and get a diagram', async () => {
      const diagram = { title: 'Diagram 1', projectId: 1 };
      const id = await storageConcept.actions.addDiagram(diagram); // ID will be 1

      const retrieved = await storageConcept.actions.getDiagram(1);
      assert.isNotNull(retrieved, 'Diagram should be retrieved');
      assert.strictEqual(retrieved.title, 'Diagram 1', 'Normalized diagram title should match');
      assert.isTrue(isSimpleJson(retrieved), 'Retrieved diagram should be in simple JSON format');

      // Verify that the data was WRITTEN in JSON-LD format
      const rawData = mockDbStore.diagrams.find(d => d.id === 1);
      assert.isTrue(isJsonLd(rawData), 'Raw data in DB should be in JSON-LD format');
      assert.strictEqual(rawData['@type'], 'bfo:BFO_0000031', 'Raw data should have correct @type');
      assert.strictEqual(rawData['schema:name'], 'Diagram 1', 'Raw data should have schema:name');
      assert.strictEqual(rawData['@id'], 'urn:mermaid-ide:diagram:1', 'Raw data should have correct @id');
    });

    it('[UNIT] should get a diagram and normalize JSON-LD data', async () => {
      // Simulate a diagram stored in JSON-LD format
      const jsonLdDiagram = {
        id: 20, // Pre-defined ID for direct retrieval
        "@context": "https://mermaid-ide.org/context/v1.jsonld",
        "@id": "urn:mermaid-ide:diagram:20",
        "@type": "bfo:BFO_0000031",
        "schema:name": "JSON-LD Diagram.mmd",
        "schema:text": "graph TD; A-->B;",
        "bfo:BFO_0000129": { "@id": "urn:mermaid-ide:project:5" },
        "lastModifiedRemoteSha": "xyz",
        "schema:dateCreated": "2023-03-01T10:00:00Z",
        "schema:dateModified": "2023-03-02T11:00:00Z"
      };
      mockDbStore.diagrams.push(jsonLdDiagram);

      const retrieved = await storageConcept.actions.getDiagram(20);
      assert.isNotNull(retrieved, 'Diagram should be retrieved');
      assert.isTrue(isSimpleJson(retrieved), 'Retrieved diagram should be in simple JSON format');
      assert.strictEqual(retrieved.id, 20, 'ID should be correctly parsed');
      assert.strictEqual(retrieved.title, 'JSON-LD Diagram.mmd', 'Title should be correctly parsed');
      assert.strictEqual(retrieved.content, 'graph TD; A-->B;', 'Content should be correctly parsed');
      assert.strictEqual(retrieved.projectId, 5, 'projectId should be correctly parsed');
      assert.strictEqual(retrieved.lastModifiedRemoteSha, 'xyz', 'lastModifiedRemoteSha should be preserved');
      assert.instanceOf(retrieved.createdAt, Date, 'createdAt should be a Date object');
      assert.instanceOf(retrieved.updatedAt, Date, 'updatedAt should be a Date object');
      assert.strictEqual(retrieved.createdAt.toISOString(), '2023-03-01T10:00:00.000Z', 'createdAt should match');
    });

    it('[UNIT] should get diagrams by project ID and normalize JSON-LD data', async () => {
      mockDbStore.diagrams.push({ id: 1, title: 'D1', projectId: 1 }); // Simple JSON
      mockDbStore.diagrams.push({ id: 2, "@context": "url", "@type": "bfo:BFO_0000031", "@id": "urn:diagram:2", "bfo:BFO_0000129": { "@id": "urn:project:1" }, "schema:name": "D2.mmd", "schema:text": "content" }); // JSON-LD
      mockDbStore.diagrams.push({ id: 3, title: 'D3', projectId: 2 }); // Simple JSON

      const project1Diagrams = await storageConcept.actions.getDiagramsByProjectId(1);
      assert.strictEqual(project1Diagrams.length, 2, 'Should retrieve 2 diagrams for project 1');
      assert.isTrue(isSimpleJson(project1Diagrams[0]), 'First diagram should be normalized');
      assert.isTrue(isSimpleJson(project1Diagrams[1]), 'Second diagram should be normalized');
      assert.strictEqual(project1Diagrams[1].title, 'D2.mmd', 'Normalized title should be correct');
    });

    it('[UNIT] should get diagrams by project ID', async () => {
      await storageConcept.actions.addDiagram({ title: 'D1', projectId: 1 });
      await storageConcept.actions.addDiagram({ title: 'D2', projectId: 2 });
      await storageConcept.actions.addDiagram({ title: 'D3', projectId: 1 });

      const project1Diagrams = await storageConcept.actions.getDiagramsByProjectId(1);
      assert.strictEqual(project1Diagrams.length, 2, 'Should retrieve 2 diagrams for project 1');
    });

    it('[UNIT] should delete all diagrams for a project', async () => {
      await storageConcept.actions.addDiagram({ title: 'D1', projectId: 1 });
      await storageConcept.actions.addDiagram({ title: 'D2', projectId: 2 });
      await storageConcept.actions.addDiagram({ title: 'D3', projectId: 1 });

      await storageConcept.actions.deleteDiagramsByProjectId(1);
      const allDiagrams = await storageConcept.actions._getAll('diagrams');
      assert.strictEqual(allDiagrams.length, 1, 'Only one diagram should remain');
      assert.strictEqual(allDiagrams[0].projectId, 2, 'The remaining diagram should belong to project 2');
    });
  });

  describe('SyncQueue CRUD', () => {
    it('[UNIT] should add and get sync queue items', async () => {
      const item = { action: 'create', payload: {} };
      await storageConcept.actions.addSyncQueueItem(item);

      const items = await storageConcept.actions.getSyncQueueItems();
      assert.strictEqual(items.length, 1, 'Should have one item in the queue');
      assert.strictEqual(items[0].action, 'create', 'Item action should match');
    });

    it('[UNIT] should delete a sync queue item', async () => {
      const id = await storageConcept.actions.addSyncQueueItem({ action: 'delete' });
      await storageConcept.actions.deleteSyncQueueItem(id);

      const items = await storageConcept.actions.getSyncQueueItems();
      assert.strictEqual(items.length, 0, 'Sync queue should be empty');
    });
  });
});