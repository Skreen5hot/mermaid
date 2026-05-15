import { storageConcept } from '../../src/concepts/storageConcept.js';
import { Storage } from '../../src/storage/storage.js';
import { MockDirectoryHandle } from '../storage/mock-fs.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

// --- Mock IndexedDB (extended for the router's full surface) ---
//
// In addition to add/get/getAll (used by the legacy storageConcept), this
// mock supports put, delete, and a stub of index('projectId') with
// getAll/getAllKeys, which the new router uses for diagram CRUD and project
// deletion. Storage.init() (called inside _open) also exercises put/get
// against an 'h' store on a separate DB; the same mock satisfies both.

let mockDbStore = {};
let mockRequests = [];

function createMockRequest(result) {
  const req = { result, onsuccess: null, onerror: null };
  mockRequests.push(req);
  return req;
}

function flushMockRequests(success = true) {
  // Drain in batches because IDB callbacks can enqueue follow-up requests.
  const queued = mockRequests.splice(0);
  for (const req of queued) {
    if (success && req.onsuccess) {
      req.onsuccess({ target: { result: req.result } });
    } else if (!success && req.onerror) {
      req.onerror({ target: { error: new Error('Mock DB Error') } });
    }
  }
}

// flushAllAsync loops flush + microtask drain until quiescent. The router
// awaits promises before emitting events, so a single flush no longer drives
// the full chain — we need to give the microtask queue a chance to run too.
async function flushAllAsync(rounds = 10) {
  for (let i = 0; i < rounds; i++) {
    flushMockRequests();
    await new Promise((r) => setImmediate(r));
  }
}

const mockIndexedDB = {
  open: () => {
    const db = {
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
          get: (id) => {
            const item = (mockDbStore[name] || []).find((d) => d.id === id);
            return createMockRequest(item);
          },
          getAll: () => createMockRequest(mockDbStore[name] || []),
          delete: (id) => {
            mockDbStore[name] = (mockDbStore[name] || []).filter((d) => d.id !== id);
            return createMockRequest(undefined);
          },
          index: (indexName) => ({
            getAll: (key) => createMockRequest((mockDbStore[name] || []).filter((d) => d[indexName] === key)),
            getAllKeys: (key) =>
              createMockRequest((mockDbStore[name] || []).filter((d) => d[indexName] === key).map((d) => d.id)),
          }),
        }),
      }),
      close: () => {},
    };
    return createMockRequest(db);
  },
};

global.indexedDB = mockIndexedDB;

// --- Tests ---

describe('Storage Concept (router)', () => {
  function beforeEach() {
    storageConcept.reset();
    mockDbStore = {};
    mockRequests = [];
  }

  it("listen('do:open') emits 'databaseOpened'", async () => {
    beforeEach();
    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    await storageConcept.listen('do:open');
    await flushAllAsync();

    assert.ok(received.find((e) => e.event === 'databaseOpened'), "should emit 'databaseOpened'");
  });

  it("listen('do:createProject') adds an IDB project and emits 'projectCreated' with compound id", async () => {
    beforeEach();
    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    await storageConcept.listen('do:open');
    await flushAllAsync();

    await storageConcept.listen('do:createProject', { name: 'My Test Project', mode: 'idb' });
    await flushAllAsync();

    const event = received.find((e) => e.event === 'projectCreated');
    assert.ok(event, "should emit 'projectCreated'");
    assert.strictEqual(event.payload.name, 'My Test Project');
    assert.strictEqual(event.payload.mode, 'idb');
    assert.ok(event.payload.id.startsWith('idb:'), `id should be compound, got ${event.payload.id}`);
    assert.strictEqual(mockDbStore.projects.length, 1);
    assert.strictEqual(mockDbStore.projects[0].name, 'My Test Project');
  });

  it("listen('do:createProject') defaults to mode='idb' when omitted", async () => {
    beforeEach();
    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    await storageConcept.listen('do:open');
    await flushAllAsync();

    await storageConcept.listen('do:createProject', { name: 'Defaulted' });
    await flushAllAsync();

    const event = received.find((e) => e.event === 'projectCreated');
    assert.ok(event);
    assert.strictEqual(event.payload.mode, 'idb');
  });

  it("listen('do:loadDiagram') gets an IDB diagram and emits 'diagramLoaded' with compound ids", async () => {
    beforeEach();
    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    const testDiagram = { id: 123, name: 'Test Diagram', content: 'graph TD', projectId: 7 };
    mockDbStore.diagrams = [testDiagram];

    await storageConcept.listen('do:open');
    await flushAllAsync();

    await storageConcept.listen('do:loadDiagram', { diagramId: 'idb:123' });
    await flushAllAsync();

    const event = received.find((e) => e.event === 'diagramLoaded');
    assert.ok(event, "should emit 'diagramLoaded'");
    assert.strictEqual(event.payload.id, 'idb:123');
    assert.strictEqual(event.payload.name, 'Test Diagram');
    assert.strictEqual(event.payload.projectId, 'idb:7');
  });

  it("listen('do:listProjects') merges IDB projects with FSA project list (FSA empty when not ready)", async () => {
    beforeEach();
    mockDbStore.projects = [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }];
    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    await storageConcept.listen('do:open');
    await flushAllAsync();

    await storageConcept.listen('do:listProjects');
    await flushAllAsync();

    const event = received.find((e) => e.event === 'projectsListed');
    assert.ok(event, "should emit 'projectsListed'");
    assert.strictEqual(event.payload.length, 2);
    assert.deepEqual(
      event.payload.map((p) => ({ id: p.id, name: p.name, mode: p.mode })),
      [
        { id: 'idb:1', name: 'First', mode: 'idb' },
        { id: 'idb:2', name: 'Second', mode: 'idb' },
      ]
    );
  });

  it("listen('do:exportProject') copies IDB diagrams to a new FSA folder, source untouched", async () => {
    beforeEach();
    mockDbStore.projects = [{ id: 1, name: 'Source' }];
    mockDbStore.diagrams = [
      { id: 10, projectId: 1, name: 'first', content: 'graph TD; A-->B' },
      { id: 11, projectId: 1, name: 'second', content: 'sequenceDiagram\n  A->>B: hi' },
    ];

    const root = new MockDirectoryHandle('MermaidIDE');
    Storage._test.setRoot(root);

    await storageConcept.listen('do:open');
    await flushAllAsync();

    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    await storageConcept.listen('do:exportProject', { sourceProjectId: 'idb:1', destName: 'Copy' });
    await flushAllAsync();

    const event = received.find((e) => e.event === 'projectCreated');
    assert.ok(event, "should emit 'projectCreated' for the new FSA project");
    assert.strictEqual(event.payload.id, 'fsa:Copy');
    assert.strictEqual(event.payload.mode, 'fsa');
    assert.strictEqual(event.payload.name, 'Copy');

    // Files exist on disk with correct content.
    const copy = await root.getDirectoryHandle('Copy', { create: false });
    const fileFirst = await copy.getFileHandle('first.mmd');
    const textFirst = await (await fileFirst.getFile()).text();
    assert.strictEqual(textFirst, 'graph TD; A-->B');
    const fileSecond = await copy.getFileHandle('second.mmd');
    const textSecond = await (await fileSecond.getFile()).text();
    assert.strictEqual(textSecond, 'sequenceDiagram\n  A->>B: hi');

    // Source IDB unmodified.
    assert.strictEqual(mockDbStore.projects.length, 1);
    assert.strictEqual(mockDbStore.diagrams.length, 2);

    Storage._test.reset();
  });

  it("listen('do:exportProject') errors when destination folder already exists", async () => {
    beforeEach();
    mockDbStore.projects = [{ id: 1, name: 'Source' }];

    const root = new MockDirectoryHandle('MermaidIDE');
    await root.getDirectoryHandle('Existing', { create: true });
    Storage._test.setRoot(root);

    await storageConcept.listen('do:open');
    await flushAllAsync();

    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    await storageConcept.listen('do:exportProject', { sourceProjectId: 'idb:1', destName: 'Existing' });
    await flushAllAsync();

    const err = received.find((e) => e.event === 'error');
    assert.ok(err, 'should emit error');
    assert.ok(err.payload.includes('already exists'), `error message should mention collision: ${err.payload}`);
    assert.ok(!received.find((e) => e.event === 'projectCreated'), 'no projectCreated on collision');

    Storage._test.reset();
  });

  it("listen('do:exportProject') refuses to export a non-IDB project", async () => {
    beforeEach();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));

    await storageConcept.listen('do:open');
    await flushAllAsync();

    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    await storageConcept.listen('do:exportProject', { sourceProjectId: 'fsa:foo', destName: 'Bar' });
    await flushAllAsync();

    const err = received.find((e) => e.event === 'error');
    assert.ok(err);
    assert.ok(err.payload.includes('Only IDB'));

    Storage._test.reset();
  });

  it("listen('do:exportProject') errors when Storage is not ready", async () => {
    beforeEach();
    mockDbStore.projects = [{ id: 1, name: 'Source' }];
    Storage._test.reset(); // ensure Storage has no root

    await storageConcept.listen('do:open');
    await flushAllAsync();

    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    await storageConcept.listen('do:exportProject', { sourceProjectId: 'idb:1', destName: 'Copy' });
    await flushAllAsync();

    const err = received.find((e) => e.event === 'error');
    assert.ok(err);
    assert.ok(err.payload.includes('not ready'));
  });

  it("listen('do:deleteProject') routes to IDB when projectId is 'idb:<n>'", async () => {
    beforeEach();
    mockDbStore.projects = [{ id: 5, name: 'ToDelete' }];
    mockDbStore.diagrams = [
      { id: 100, projectId: 5, name: 'a', content: 'x' },
      { id: 101, projectId: 5, name: 'b', content: 'y' },
    ];

    await storageConcept.listen('do:open');
    await flushAllAsync();

    const received = [];
    storageConcept.subscribe((event, payload) => received.push({ event, payload }));

    await storageConcept.listen('do:deleteProject', { projectId: 'idb:5' });
    await flushAllAsync();

    const event = received.find((e) => e.event === 'projectDeleted');
    assert.ok(event, "should emit 'projectDeleted'");
    assert.strictEqual(event.payload.projectId, 'idb:5');
    assert.strictEqual(mockDbStore.projects.length, 0, 'project removed from IDB');
    assert.strictEqual(mockDbStore.diagrams.length, 0, "project's diagrams removed too");
  });
});
