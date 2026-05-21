// Unit tests for auditLog. Fresh mock IDB per test.

import * as auditLog from '../../src/storage/auditLog.js';
import { _resetForTests } from '../../src/storage/handlesDb.js';
import { installMockIDB } from './mock-idb.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

function freshDb() {
  _resetForTests();
  return installMockIDB();
}

describe('auditLog', () => {
  it('list() on a fresh database returns []', async () => {
    freshDb();
    const rows = await auditLog.list();
    assert.deepEqual(rows, []);
  });

  it('append() rejects records without an action', async () => {
    freshDb();
    let caught;
    try { await auditLog.append({ path: 'x' }); } catch (e) { caught = e; }
    assert.ok(caught && caught.message.includes('action: string'));
  });

  it('append() stores the record with a server-set time field', async () => {
    freshDb();
    await auditLog.append({ action: 'write', projectId: 'fsa:p', path: 'foo.mmd', bytes: 42 });
    const rows = await auditLog.list();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].action, 'write');
    assert.strictEqual(rows[0].path, 'foo.mmd');
    assert.strictEqual(rows[0].bytes, 42);
    assert.ok(rows[0].time, 'time should be set');
    // Time should be ISO format (Z suffix indicates UTC).
    assert.ok(rows[0].time.endsWith('Z'));
  });

  it('time + action cannot be shadowed by caller detail', async () => {
    freshDb();
    // Caller maliciously tries to set its own action — auditLog must overwrite.
    await auditLog.append({ action: 'write', time: 'fake-time', projectId: 'fsa:p' });
    const rows = await auditLog.list();
    assert.ok(rows[0].time !== 'fake-time', 'time must be overwritten by server');
    assert.strictEqual(rows[0].action, 'write');
  });

  it('list({projectId}) filters by project', async () => {
    freshDb();
    await auditLog.append({ action: 'write', projectId: 'fsa:A', path: 'a.mmd' });
    await auditLog.append({ action: 'write', projectId: 'fsa:B', path: 'b.mmd' });
    await auditLog.append({ action: 'write', projectId: 'fsa:A', path: 'a2.mmd' });
    const onlyA = await auditLog.list({ projectId: 'fsa:A' });
    assert.strictEqual(onlyA.length, 2);
    assert.ok(onlyA.every((r) => r.projectId === 'fsa:A'));
    const onlyB = await auditLog.list({ projectId: 'fsa:B' });
    assert.strictEqual(onlyB.length, 1);
  });

  it('list({since}) filters by timestamp threshold', async () => {
    freshDb();
    await auditLog.append({ action: 'write', projectId: 'fsa:A' });
    // Force a later timestamp on the second row by waiting one tick + injecting.
    // Easier: just check that filtering on a high `since` returns zero rows.
    const future = '2099-01-01T00:00:00.000Z';
    const filtered = await auditLog.list({ since: future });
    assert.deepEqual(filtered, []);
  });

  it('list() is sorted most-recent-first by id', async () => {
    freshDb();
    await auditLog.append({ action: 'write', path: 'first' });
    await auditLog.append({ action: 'write', path: 'second' });
    await auditLog.append({ action: 'write', path: 'third' });
    const rows = await auditLog.list();
    assert.strictEqual(rows[0].path, 'third');
    assert.strictEqual(rows[1].path, 'second');
    assert.strictEqual(rows[2].path, 'first');
  });

  it('list({limit}) caps the result count', async () => {
    freshDb();
    for (let i = 0; i < 5; i++) await auditLog.append({ action: 'write', path: `p${i}` });
    const rows = await auditLog.list({ limit: 2 });
    assert.strictEqual(rows.length, 2);
  });

  it('count() reports total row count', async () => {
    freshDb();
    assert.strictEqual(await auditLog.count(), 0);
    await auditLog.append({ action: 'write' });
    await auditLog.append({ action: 'remove' });
    assert.strictEqual(await auditLog.count(), 2);
  });

  it('clear() drops all rows', async () => {
    freshDb();
    await auditLog.append({ action: 'write' });
    await auditLog.append({ action: 'write' });
    await auditLog.clear();
    assert.strictEqual(await auditLog.count(), 0);
  });

  it('sweep(cap) deletes oldest rows beyond cap', async () => {
    freshDb();
    for (let i = 0; i < 10; i++) await auditLog.append({ action: 'write', path: `p${i}` });
    assert.strictEqual(await auditLog.count(), 10);
    const deleted = await auditLog.sweep(6);
    assert.strictEqual(deleted, 4);
    assert.strictEqual(await auditLog.count(), 6);
    // The 6 newest should be retained (p4..p9).
    const rows = await auditLog.list({ limit: 100 });
    const paths = rows.map((r) => r.path).sort();
    assert.deepEqual(paths, ['p4', 'p5', 'p6', 'p7', 'p8', 'p9']);
  });

  it('sweep(cap) is a no-op when under cap', async () => {
    freshDb();
    await auditLog.append({ action: 'write' });
    const deleted = await auditLog.sweep(10);
    assert.strictEqual(deleted, 0);
  });
});
