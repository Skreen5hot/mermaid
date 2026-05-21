// Shared opener for the MermaidIDE.handles IndexedDB.
//
// One database, three stores, used by:
//   - storage.js: stores the legacy rootHandle in 'h' (kept for v2->v3 migration,
//                 to be drained and ignored by 5b)
//   - fsaRegistry.js: per-project metadata + handles in 'fsaProjects'
//   - auditLog.js: app-wide audit log in 'auditLog'
//
// Schema versions:
//   v1: 'h' store (key/value bag for rootHandle)
//   v2: + 'fsaProjects' (keyPath: 'id')   <- per-folder FSA project metadata
//       + 'auditLog'    (keyPath: 'id', autoIncrement)
//
// onupgradeneeded uses `if (!contains)` guards so the upgrade is idempotent
// — fresh installs get all three stores in one go; v1 installs get the two
// new stores added without touching 'h'.

export const DB_NAME = 'MermaidIDE.handles';
export const DB_VERSION = 2;

export const STORE_LEGACY_HANDLES = 'h';
export const STORE_FSA_PROJECTS = 'fsaProjects';
export const STORE_AUDIT_LOG = 'auditLog';

let _dbPromise = null;

export function open() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE_LEGACY_HANDLES)) {
        db.createObjectStore(STORE_LEGACY_HANDLES);
      }
      if (!db.objectStoreNames.contains(STORE_FSA_PROJECTS)) {
        db.createObjectStore(STORE_FSA_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIT_LOG)) {
        db.createObjectStore(STORE_AUDIT_LOG, { keyPath: 'id', autoIncrement: true });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => {
      _dbPromise = null;
      reject(r.error);
    };
  });
  return _dbPromise;
}

// Test hook: drops the cached connection so the next open() creates a new
// one. Useful when tests swap the indexedDB global between runs.
export function _resetForTests() {
  _dbPromise = null;
}
