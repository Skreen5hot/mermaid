// Unit tests for fsaRegistry. Uses the in-memory mock IDB so each test
// gets a fresh database.

import * as fsaRegistry from '../../src/storage/fsaRegistry.js';
import { _resetForTests } from '../../src/storage/handlesDb.js';
import { installMockIDB } from './mock-idb.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

function freshDb() {
  _resetForTests();
  return installMockIDB();
}

describe('fsaRegistry', () => {
  it('list() on a fresh database returns []', async () => {
    freshDb();
    const rows = await fsaRegistry.list();
    assert.deepEqual(rows, []);
  });

  it('add() inserts a row with a generated id and timestamp', async () => {
    freshDb();
    const handle = { kind: 'directory', name: 'MyProj' };
    const row = await fsaRegistry.add({ name: 'Architecture', handle });
    assert.ok(row.id.startsWith('fsa:'), `id should start with fsa:, got ${row.id}`);
    assert.strictEqual(row.name, 'Architecture');
    assert.strictEqual(row.handle, handle);
    assert.strictEqual(row.diagramsPath, 'mermaid');
    assert.ok(row.createdAt, 'createdAt should be set');
  });

  it('add() honors an explicit id (for migration)', async () => {
    freshDb();
    const handle = { kind: 'directory', name: 'Legacy' };
    const row = await fsaRegistry.add({
      id: 'fsa:Legacy',
      name: 'Legacy',
      handle,
      diagramsPath: '',
    });
    assert.strictEqual(row.id, 'fsa:Legacy');
    assert.strictEqual(row.diagramsPath, '');
  });

  it('get() returns the row by id, or null if missing', async () => {
    freshDb();
    const handle = { kind: 'directory' };
    await fsaRegistry.add({ id: 'fsa:Alpha', name: 'Alpha', handle });
    const got = await fsaRegistry.get('fsa:Alpha');
    assert.ok(got);
    assert.strictEqual(got.name, 'Alpha');
    const missing = await fsaRegistry.get('fsa:DoesNotExist');
    assert.strictEqual(missing, null);
  });

  it('list() returns all added rows', async () => {
    freshDb();
    await fsaRegistry.add({ id: 'fsa:A', name: 'A', handle: {} });
    await fsaRegistry.add({ id: 'fsa:B', name: 'B', handle: {} });
    const rows = await fsaRegistry.list();
    assert.strictEqual(rows.length, 2);
    const ids = rows.map((r) => r.id).sort();
    assert.deepEqual(ids, ['fsa:A', 'fsa:B']);
  });

  it('update() merges patch fields and preserves id', async () => {
    freshDb();
    await fsaRegistry.add({ id: 'fsa:X', name: 'Original', handle: {} });
    const updated = await fsaRegistry.update('fsa:X', { name: 'Renamed' });
    assert.strictEqual(updated.name, 'Renamed');
    assert.strictEqual(updated.id, 'fsa:X');
    // Even if patch tries to change id, it's ignored.
    const sneakyUpdate = await fsaRegistry.update('fsa:X', { id: 'fsa:OTHER', name: 'AnotherName' });
    assert.strictEqual(sneakyUpdate.id, 'fsa:X');
    assert.strictEqual(sneakyUpdate.name, 'AnotherName');
  });

  it('update() throws when id is missing', async () => {
    freshDb();
    let caught;
    try { await fsaRegistry.update('fsa:nope', { name: 'X' }); } catch (e) { caught = e; }
    assert.ok(caught, 'update should throw');
    assert.ok(caught.message.includes('no row with id'));
  });

  it('remove() deletes the row', async () => {
    freshDb();
    await fsaRegistry.add({ id: 'fsa:ToDelete', name: 'X', handle: {} });
    await fsaRegistry.remove('fsa:ToDelete');
    const after = await fsaRegistry.get('fsa:ToDelete');
    assert.strictEqual(after, null);
  });

  it('add() throws on missing name or handle', async () => {
    freshDb();
    let e1;
    try { await fsaRegistry.add({ handle: {} }); } catch (e) { e1 = e; }
    assert.ok(e1 && e1.message.includes('name is required'));
    let e2;
    try { await fsaRegistry.add({ name: 'x' }); } catch (e) { e2 = e; }
    assert.ok(e2 && e2.message.includes('handle is required'));
  });

  it('generated ids are unique across multiple adds', async () => {
    freshDb();
    const ids = new Set();
    for (let i = 0; i < 20; i++) {
      const row = await fsaRegistry.add({ name: `p${i}`, handle: {} });
      ids.add(row.id);
    }
    assert.strictEqual(ids.size, 20, 'all generated ids should be unique');
  });
});
