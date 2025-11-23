import { describe, it, assert, beforeEach } from '../test-utils.js';
import { storageConcept } from '../../src/concepts/storageConcept.js';

// --- Mock IndexedDB ---

let mockDbStore = {};
let mockDbIndexes = {};
let nextId = 1;

const mockIndexedDB = {
  open: (name, version) => {
    const request = {};
    const db = {
      objectStoreNames: {
        contains: (storeName) => !!mockDbStore[storeName],
      },
      createObjectStore: (storeName, options) => {
        if (!mockDbStore[storeName]) {
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
          put: (item) => {
            const req = {};
            const store = mockDbStore[name];
            let id = item.id;
            if (id) {
              const index = store.findIndex(i => i.id === id);
              if (index > -1) store[index] = item;
              else store.push(item);
            } else {
              id = nextId++;
              item.id = id;
              store.push(item);
            }
            setTimeout(() => req.onsuccess({ target: { result: id } }), 0);
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

  describe('Project CRUD', () => {
    it('[UNIT] should add and get a project', async () => {
      const project = { name: 'Project Alpha' };
      const id = await storageConcept.actions.addProject(project);
      assert.strictEqual(id, 1, 'Should return the new ID');

      const retrieved = await storageConcept.actions.getAllProjects();
      assert.strictEqual(retrieved.length, 1, 'Should have one project in the store');
      assert.strictEqual(retrieved[0].name, 'Project Alpha', 'Project name should match');
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
      const id = await storageConcept.actions.addDiagram(diagram);

      const retrieved = await storageConcept.actions.getDiagram(id);
      assert.strictEqual(retrieved.title, 'Diagram 1', 'Diagram title should match');
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