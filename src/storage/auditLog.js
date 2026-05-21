// auditLog — IDB-backed app-wide log of FSA operations.
//
// Replaces the per-folder `.app/audit.log` files Phases 1–3 wrote. Each
// row carries the projectId, so a single store can be filtered per project.
// Stored in the same MermaidIDE.handles database as fsaProjects.
//
// Row shape:
//   {
//     id:        autoIncrement integer (chronological)
//     time:      ISO timestamp
//     action:    'init' | 'mkdir' | 'write' | 'rename' | 'remove' | 'migrate-v2-v3' | ...
//     projectId: 'fsa:...' (or undefined for app-level events like migration)
//     ...detail: action-specific fields (path, bytes, atomic, etc.)
//   }
//
// Pure data layer. Callers (router post-operation, migration) call append();
// the future Settings → Activity Log UI (Phase 5d) calls list().

import { open, STORE_AUDIT_LOG } from './handlesDb.js';

const DEFAULT_LIMIT = 200;
const RETENTION_LIMIT = 10000;

export async function init() {
  await open();
}

// Append a record. Time is set here so callers don't need to remember.
// Returns the assigned id (the autoIncrement key) on success.
export async function append(record) {
  if (!record || typeof record.action !== 'string') {
    throw new Error('auditLog.append: record must include `action: string`');
  }
  const db = await open();
  if (!db) return null;
  // Canonical keys after the spread so detail.time / detail.action can't shadow.
  const row = { ...record, time: new Date().toISOString(), action: record.action };
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_AUDIT_LOG], 'readwrite');
    const r = tx.objectStore(STORE_AUDIT_LOG).add(row);
    r.onsuccess = (e) => res(e.target.result);
    r.onerror = () => rej(r.error);
  });
}

// Query rows. Filters are applied client-side after a full getAll, which is
// fine at the scale of an audit log (10k cap). Most recent first.
export async function list({ projectId, since, limit = DEFAULT_LIMIT } = {}) {
  const db = await open();
  if (!db) return [];
  const all = await new Promise((res, rej) => {
    const tx = db.transaction([STORE_AUDIT_LOG], 'readonly');
    const r = tx.objectStore(STORE_AUDIT_LOG).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
  let filtered = all;
  if (projectId !== undefined) {
    filtered = filtered.filter((row) => row.projectId === projectId);
  }
  if (since) {
    filtered = filtered.filter((row) => row.time >= since);
  }
  // Sort most-recent-first by autoIncrement id (chronological by insertion).
  filtered.sort((a, b) => (b.id || 0) - (a.id || 0));
  return filtered.slice(0, limit);
}

export async function count() {
  const db = await open();
  if (!db) return 0;
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_AUDIT_LOG], 'readonly');
    const r = tx.objectStore(STORE_AUDIT_LOG).count();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// Drop everything. Tests + a future "clear log" Settings action.
export async function clear() {
  const db = await open();
  if (!db) return;
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_AUDIT_LOG], 'readwrite');
    const r = tx.objectStore(STORE_AUDIT_LOG).clear();
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

// Retention sweep — delete oldest rows beyond the cap. Called periodically
// (e.g. after N appends, or on init). Returns count deleted.
export async function sweep(cap = RETENTION_LIMIT) {
  const total = await count();
  if (total <= cap) return 0;
  const overflow = total - cap;
  const db = await open();
  if (!db) return 0;
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_AUDIT_LOG], 'readwrite');
    const cursorReq = tx.objectStore(STORE_AUDIT_LOG).openCursor();
    let deleted = 0;
    cursorReq.onsuccess = (e) => {
      const cur = e.target.result;
      if (!cur || deleted >= overflow) {
        res(deleted);
        return;
      }
      cur.delete();
      deleted++;
      cur.continue();
    };
    cursorReq.onerror = () => rej(cursorReq.error);
  });
}
