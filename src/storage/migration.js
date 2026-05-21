// One-time data migration from the v2 single-root model to the v3
// per-project model.
//
// Legacy state (v2):
//   IDB store 'h' contains key 'rootHandle' → the FileSystemDirectoryHandle
//   for <picked>/MermaidIDE/. Subfolders inside are FSA "projects."
//
// Target state (v3):
//   IDB store 'fsaProjects' contains one row per subfolder, each holding
//   that subfolder's own FileSystemDirectoryHandle.
//
// Conservative behavior:
//   - Idempotent: if fsaProjects already has rows, do nothing.
//   - Permission-aware: iterating subfolders requires read permission on
//     the legacy root. If permission isn't granted yet, returns 'deferred'
//     — the caller is expected to retry after the user reconnects.
//   - Non-destructive: the legacy 'rootHandle' key is NOT deleted in this
//     pass. New-project creation in the router still uses it. Cleanup of
//     the legacy key happens in 5c when the new UX flow stops needing it.
//   - Logs the migration via auditLog so it's traceable later.

import { open, STORE_LEGACY_HANDLES } from './handlesDb.js';
import * as fsaRegistry from './fsaRegistry.js';
import * as auditLog from './auditLog.js';

const LEGACY_HANDLE_KEY = 'rootHandle';
// The MermaidIDE/.app/ folder is app metadata, not a user project. Skip it.
const RESERVED_FOLDER_NAMES = new Set(['.app']);

function _getLegacyHandle(db) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_LEGACY_HANDLES, 'readonly');
    const rq = tx.objectStore(STORE_LEGACY_HANDLES).get(LEGACY_HANDLE_KEY);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}

// Returns one of:
//   { status: 'no-op',     reason }   — nothing to do (fresh install, already
//                                       migrated, etc.)
//   { status: 'deferred',  reason }   — legacy data found but permission
//                                       isn't granted yet; caller should
//                                       retry after a successful reconnect
//   { status: 'migrated',  count }    — successfully moved N subfolders
//                                       into fsaProjects
//   { status: 'error',     error }    — unexpected failure mid-migration
export async function migrateLegacyRootIfNeeded() {
  const db = await open();
  if (!db) return { status: 'no-op', reason: 'no-idb' };

  // Idempotency: if anyone already migrated (or new install), bail.
  const existing = await fsaRegistry.list();
  if (existing.length > 0) return { status: 'no-op', reason: 'already-migrated' };

  // Anything legacy to migrate?
  const rootHandle = await _getLegacyHandle(db);
  if (!rootHandle) return { status: 'no-op', reason: 'no-legacy-data' };

  // Can we read the root's contents?
  let perm;
  try {
    perm = await rootHandle.queryPermission({ mode: 'readwrite' });
  } catch (e) {
    return { status: 'deferred', reason: 'permission-query-failed', error: e };
  }
  if (perm !== 'granted') {
    return { status: 'deferred', reason: 'permission-not-granted' };
  }

  // Walk subfolders and create fsaProjects rows.
  let count = 0;
  try {
    for await (const entry of rootHandle.values()) {
      if (entry.kind !== 'directory') continue;
      if (RESERVED_FOLDER_NAMES.has(entry.name)) continue;
      try {
        await fsaRegistry.add({
          id: `fsa:${entry.name}`,         // preserve the legacy compound-id form
          name: entry.name,
          handle: entry,
          diagramsPath: '',                // legacy layout: diagrams at folder root
        });
        count++;
      } catch (e) {
        // Most likely a duplicate (e.g. retry after partial run). Keep going.
        // eslint-disable-next-line no-console
        console.warn('Migration: skipped subfolder', entry.name, e?.message || e);
      }
    }
  } catch (e) {
    return { status: 'error', error: e };
  }

  try {
    await auditLog.append({ action: 'migrate-v2-v3', count });
  } catch {
    // Audit logging is best-effort; don't fail the migration if it errors.
  }

  return { status: 'migrated', count };
}
