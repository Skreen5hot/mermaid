// Migration: legacy v2 (single rootHandle) → v3 (per-folder fsaProjects).

import { migrateLegacyRootIfNeeded } from '../../src/storage/migration.js';
import * as fsaRegistry from '../../src/storage/fsaRegistry.js';
import * as auditLog from '../../src/storage/auditLog.js';
import { _resetForTests, STORE_LEGACY_HANDLES } from '../../src/storage/handlesDb.js';
import { installMockIDB, seedLegacyStore } from './mock-idb.js';
import { MockDirectoryHandle } from './mock-fs.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

function freshDb() {
  _resetForTests();
  return installMockIDB();
}

// Seed a MermaidIDE-shaped root with the given subfolder names + an .app/
// folder (which migration should skip).
async function seedLegacyRoot(db, { subfolders = [], permission = 'granted' } = {}) {
  const root = new MockDirectoryHandle('MermaidIDE');
  root._permission = permission;
  // Override permission query so the test can simulate non-granted state.
  root.queryPermission = async () => permission;
  // Add the reserved .app folder so we can verify it's skipped.
  await root.getDirectoryHandle('.app', { create: true });
  // Add the requested subfolders.
  for (const name of subfolders) {
    await root.getDirectoryHandle(name, { create: true });
  }
  seedLegacyStore(db, STORE_LEGACY_HANDLES, 'rootHandle', root);
  return root;
}

describe('migration: v2 → v3', () => {
  it('no-op on a fresh install (no legacy data)', async () => {
    freshDb();
    const r = await migrateLegacyRootIfNeeded();
    assert.strictEqual(r.status, 'no-op');
    assert.strictEqual(r.reason, 'no-legacy-data');
    assert.strictEqual((await fsaRegistry.list()).length, 0);
  });

  it('no-op when fsaProjects is already populated (already-migrated guard)', async () => {
    const db = freshDb();
    await seedLegacyRoot(db, { subfolders: ['Foo'] });
    // Pretend a previous migration ran:
    await fsaRegistry.add({ id: 'fsa:Old', name: 'Old', handle: new MockDirectoryHandle('Old') });
    const r = await migrateLegacyRootIfNeeded();
    assert.strictEqual(r.status, 'no-op');
    assert.strictEqual(r.reason, 'already-migrated');
    // The 'Foo' subfolder should NOT have been added.
    const rows = await fsaRegistry.list();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].id, 'fsa:Old');
  });

  it('deferred when permission is not granted', async () => {
    const db = freshDb();
    await seedLegacyRoot(db, { subfolders: ['Foo'], permission: 'prompt' });
    const r = await migrateLegacyRootIfNeeded();
    assert.strictEqual(r.status, 'deferred');
    assert.strictEqual(r.reason, 'permission-not-granted');
    assert.strictEqual((await fsaRegistry.list()).length, 0, 'no rows added on deferred');
  });

  it('migrated: subfolders become fsaProjects rows (preserves legacy id form)', async () => {
    const db = freshDb();
    await seedLegacyRoot(db, { subfolders: ['Foobar', 'Yo mama', 'deontic modeling'] });

    const r = await migrateLegacyRootIfNeeded();
    assert.strictEqual(r.status, 'migrated');
    assert.strictEqual(r.count, 3);

    const rows = await fsaRegistry.list();
    assert.strictEqual(rows.length, 3);
    const ids = rows.map((row) => row.id).sort();
    assert.deepEqual(ids, ['fsa:Foobar', 'fsa:Yo mama', 'fsa:deontic modeling']);
    // Diagrams are at folder root for migrated projects, not under mermaid/.
    assert.ok(rows.every((row) => row.diagramsPath === ''));
  });

  it('skips the reserved .app folder', async () => {
    const db = freshDb();
    await seedLegacyRoot(db, { subfolders: ['Foo', 'Bar'] });

    const r = await migrateLegacyRootIfNeeded();
    assert.strictEqual(r.count, 2);

    const rows = await fsaRegistry.list();
    const names = rows.map((row) => row.name);
    assert.ok(!names.includes('.app'), '.app must not become a project');
  });

  it('appends an audit-log entry recording the migration', async () => {
    const db = freshDb();
    await seedLegacyRoot(db, { subfolders: ['Alpha', 'Beta'] });

    await migrateLegacyRootIfNeeded();

    const entries = await auditLog.list({ limit: 10 });
    const migrationEntry = entries.find((e) => e.action === 'migrate-v2-v3');
    assert.ok(migrationEntry, 'migration entry exists in audit log');
    assert.strictEqual(migrationEntry.count, 2);
  });

  it('does NOT delete the legacy rootHandle key (deferred to 5c cleanup)', async () => {
    const db = freshDb();
    await seedLegacyRoot(db, { subfolders: ['Foo'] });

    await migrateLegacyRootIfNeeded();

    // The legacy key should still be readable — new-project flow needs it
    // until 5c switches to per-folder picking.
    const stillThere = await new Promise((res, rej) => {
      const tx = db.transaction(STORE_LEGACY_HANDLES, 'readonly');
      const rq = tx.objectStore(STORE_LEGACY_HANDLES).get('rootHandle');
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    assert.ok(stillThere, 'legacy rootHandle preserved');
  });

  it('is idempotent: running twice does not duplicate rows', async () => {
    const db = freshDb();
    await seedLegacyRoot(db, { subfolders: ['One', 'Two'] });

    const first = await migrateLegacyRootIfNeeded();
    assert.strictEqual(first.status, 'migrated');
    assert.strictEqual(first.count, 2);

    const second = await migrateLegacyRootIfNeeded();
    assert.strictEqual(second.status, 'no-op');
    assert.strictEqual(second.reason, 'already-migrated');

    const rows = await fsaRegistry.list();
    assert.strictEqual(rows.length, 2, 'still exactly 2 rows after second run');
  });
});
