// storage.js — the one and only owner of the FileSystemDirectoryHandle.
//
// Public surface: the exported `Storage` object. Never returns the handle itself.
// Implementation follows PWA_LOCAL_STORAGE_GUIDE.md §4.1–§4.9.
//
// Tests use Storage._test.* to inject a mock handle and reset state. The _test
// namespace is not part of the public contract.

import { StorageError } from './StorageError.js';
import { sanitizeName, splitPath, lockKey, guardPublicPath } from './sanitize.js';

// =========================================================================
// Branding constants — MermaidIDE specific.
// If APP_ID is ever bumped, APPEND the new ID to APP_ID_HISTORY; never
// replace. isAppRoot accepts any historical ID so existing installations are
// recognized on next launch.
// =========================================================================
const APP_FOLDER = 'MermaidIDE';
const APP_ID = 'mermaid-ide.v1';
const APP_ID_HISTORY = new Set(['mermaid-ide.v1']);
const DB_NAME = 'MermaidIDE.handles';
// =========================================================================

const HANDLE_KEY = 'rootHandle';

const AUDIT_LOCK = 'write:.app/audit.log';
const AUDIT_MAX_BYTES = 8 * 1024 * 1024;
const AUDIT_KEEP_ROTATED = 8;

// --- module-private state ---
let rootHandle = null;
let permissionState = 'unknown';
let foreignParent = null;
const listeners = new Map();
const _lockQueue = new Map(); // fallback when navigator.locks is absent

// =========================================================================
// Locks — navigator.locks where available, single-process Promise chain
// otherwise. The fallback handles tests in Node and old browsers.
// =========================================================================
async function withLock(name, fn) {
  if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
    return navigator.locks.request(name, () => fn());
  }
  const prev = _lockQueue.get(name) || Promise.resolve();
  const next = prev.then(() => fn(), () => fn());
  _lockQueue.set(name, next.catch(() => {}));
  return next;
}

// =========================================================================
// IDB shim for the directory handle. Browser only — tests inject directly
// via Storage._test.setRoot, bypassing IDB.
// =========================================================================
function openHandleDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      // No IDB — tests path. Return a sentinel; idbGet/idbPut handle it.
      resolve(null);
      return;
    }
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function idbGet(db, key) {
  if (!db) return Promise.resolve(null);
  return new Promise((res, rej) => {
    const tx = db.transaction('h', 'readonly');
    const rq = tx.objectStore('h').get(key);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

function idbPut(db, key, val) {
  if (!db) return Promise.resolve();
  return new Promise((res, rej) => {
    const tx = db.transaction('h', 'readwrite');
    const rq = tx.objectStore('h').put(val, key);
    rq.onsuccess = () => res();
    rq.onerror = () => rej(rq.error);
  });
}

// =========================================================================
// Lifecycle
// =========================================================================

async function init() {
  const db = await openHandleDB();
  const stored = await idbGet(db, HANDLE_KEY);
  if (stored) {
    rootHandle = stored;
    permissionState = await queryPermission(stored);
    emit('permissionchange', permissionState);
    if (permissionState === 'granted') {
      maybeRotateAuditLog().catch(() => {});
    }
  }
}

async function queryPermission(handle) {
  const r = await handle.queryPermission({ mode: 'readwrite' });
  return r;
}

// pickRoot returns:
//   true  — folder picked and adopted, or freshly created.
//   null  — user cancelled the picker (AbortError).
//   false — pickRoot raised foreign_app_folder; UX should call adoptForeignFolder().
async function pickRoot() {
  // Clear any pending adoption from a prior pickRoot that hit foreign_app_folder.
  foreignParent = null;

  let parent;
  try {
    parent = await window.showDirectoryPicker({
      id: 'app-root',
      mode: 'readwrite',
      startIn: 'documents',
    });
  } catch (e) {
    if (e.name === 'AbortError') return null;
    throw e;
  }

  try {
    rootHandle = await adoptOrCreate(parent);
  } catch (e) {
    if (e instanceof StorageError && e.code === 'foreign_app_folder') {
      foreignParent = parent;
      return false;
    }
    throw e;
  }

  const db = await openHandleDB();
  await idbPut(db, HANDLE_KEY, rootHandle);
  permissionState = 'granted';

  // Audit first so listeners can assume the on-disk record exists.
  await audit('init', { folder: APP_FOLDER });
  emit('permissionchange', permissionState);
  return true;
}

async function adoptForeignFolder(acknowledgment) {
  if (!foreignParent) throw new StorageError('no_pending_adoption');
  if (acknowledgment !== true) throw new StorageError('acknowledgment_required');

  const outer = await foreignParent.getDirectoryHandle(APP_FOLDER, { create: false });
  const inner = await outer.getDirectoryHandle(APP_FOLDER, { create: true });
  await initAppMarker(inner);
  rootHandle = inner;
  foreignParent = null;

  const db = await openHandleDB();
  await idbPut(db, HANDLE_KEY, rootHandle);
  permissionState = 'granted';

  await audit('init_nested', { folder: APP_FOLDER });
  emit('permissionchange', permissionState);
}

function cancelForeignAdoption() {
  foreignParent = null;
}

async function adoptOrCreate(picked) {
  // Case 1: the picked folder IS an existing app root.
  if (await isAppRoot(picked)) return picked;

  // Look for <picked>/<AppName>/.
  let candidate = null;
  try {
    candidate = await picked.getDirectoryHandle(APP_FOLDER, { create: false });
  } catch (e) {
    if (e.name !== 'NotFoundError') throw e;
  }

  if (candidate) {
    // Case 2: <picked>/<AppName>/ exists AND has matching version marker.
    if (await isAppRoot(candidate)) return candidate;
    // Case 3: <picked>/<AppName>/ exists but isn't ours. UX must decide.
    throw new StorageError('foreign_app_folder', { basename: APP_FOLDER });
  }

  // Case 4: fresh. Create <picked>/<AppName>/ and write the marker.
  const fresh = await picked.getDirectoryHandle(APP_FOLDER, { create: true });
  await initAppMarker(fresh);
  return fresh;
}

async function isAppRoot(handle) {
  try {
    const appDir = await handle.getDirectoryHandle('.app', { create: false });
    const versionFile = await appDir.getFileHandle('version', { create: false });
    const text = (await (await versionFile.getFile()).text()).trim();
    return APP_ID_HISTORY.has(text);
  } catch {
    return false;
  }
}

async function initAppMarker(root) {
  const appDir = await root.getDirectoryHandle('.app', { create: true });
  const v = await appDir.getFileHandle('version', { create: true });
  const w = await v.createWritable({ keepExistingData: false });
  try {
    await w.write(new TextEncoder().encode(APP_ID + '\n'));
    await w.close();
  } catch (e) {
    try { await w.abort(); } catch {}
    throw e;
  }
}

async function ensurePermission() {
  if (!rootHandle) throw new StorageError('no_root');
  let result;
  try {
    result = await rootHandle.requestPermission({ mode: 'readwrite' });
  } catch (e) {
    if (e.name === 'SecurityError' || e.name === 'NotAllowedError') {
      throw new StorageError('gesture_required');
    }
    throw e;
  }
  permissionState = result;
  emit('permissionchange', permissionState);
  if (result !== 'granted') throw new StorageError('permission_denied');
  maybeRotateAuditLog().catch(() => {});
}

function isReady()  { return !!rootHandle && permissionState === 'granted'; }
function hasRoot()  { return !!rootHandle; }
function rootName() { return rootHandle?.name || null; }

async function detectPersistentPermissions() {
  if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
    return false;
  }
  try {
    const r = await navigator.permissions.query({ name: 'file-system-access' });
    return r.state === 'granted';
  } catch {
    return false;
  }
}

// =========================================================================
// Atomic writes (§4.2)
// =========================================================================

function requireReady() {
  if (!isReady()) throw new StorageError('not_ready');
}

function cryptoRandom() {
  const a = new Uint8Array(8);
  (globalThis.crypto || globalThis.msCrypto).getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function byteLengthOf(data) {
  if (data instanceof Uint8Array) return data.byteLength;
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data.size;
  return undefined;
}

// Internal: used by both public writeBytes (guarded) and by audit log writes
// (which must reach .app/). The public guard runs at the boundary; this
// function trusts its callers.
async function writeBytesInternal(relPath, data, { ifAbsent = false } = {}) {
  return withLock(lockKey(relPath), async () => {
    requireReady();
    const { dir, name } = await resolveParent(relPath, { create: true });
    const safeName = sanitizeName(name);

    if (ifAbsent) {
      const existing = await probeEntry(dir, safeName);
      if (existing !== null) throw new StorageError('target_exists', { kind: existing });
    }

    const tmpName = `.${safeName}.${cryptoRandom()}.tmp`;
    const tmpHandle = await dir.getFileHandle(tmpName, { create: true });

    let writable;
    let atomic = true;
    try {
      writable = await tmpHandle.createWritable({ keepExistingData: false });

      const ok =
        data instanceof Uint8Array ||
        (typeof Blob !== 'undefined' && data instanceof Blob);
      if (!ok) throw new StorageError('bad_data_type');

      await writable.write(data);
      await writable.close();
      writable = null;

      if (typeof tmpHandle.move === 'function') {
        await tmpHandle.move(dir, safeName);
      } else {
        atomic = false;
        await copyTempToTarget(dir, tmpHandle, safeName);
        try { await dir.removeEntry(tmpName); } catch {}
      }
      await audit('write', { path: relPath, bytes: byteLengthOf(data), atomic });
    } catch (err) {
      if (writable) { try { await writable.abort(); } catch {} }
      try { await dir.removeEntry(tmpName); } catch {}
      throw err;
    }
  });
}

async function writeBytes(relPath, data, opts) {
  guardPublicPath(relPath);
  return writeBytesInternal(relPath, data, opts);
}

async function writeText(relPath, text, opts) {
  const bytes = new TextEncoder().encode(text);
  return writeBytes(relPath, bytes, opts);
}

async function copyTempToTarget(dir, tmpHandle, safeName) {
  const targetHandle = await dir.getFileHandle(safeName, { create: true });
  const writable = await targetHandle.createWritable({ keepExistingData: false });
  try {
    const tmpFile = await tmpHandle.getFile();
    await writable.write(tmpFile);
    await writable.close();
  } catch (e) {
    try { await writable.abort(); } catch {}
    throw e;
  }
}

// =========================================================================
// Reads (§4.9) — no guardPublicPath; reads under .app/ are required by the
// Activity log UX.
// =========================================================================

async function list(relPath, { includeHidden = false } = {}) {
  requireReady();
  const dir = await resolveDir(relPath);
  const out = [];
  for await (const entry of dir.values()) {
    if (!includeHidden && entry.name.startsWith('.')) continue;
    let size;
    let modified;
    if (entry.kind === 'file') {
      try {
        const f = await entry.getFile();
        size = f.size;
        modified = f.lastModified;
      } catch { /* transient — leave undefined */ }
    }
    out.push({ name: entry.name, kind: entry.kind, size, modified });
  }
  out.sort((a, b) => {
    const an = a.name.normalize('NFC').toLowerCase();
    const bn = b.name.normalize('NFC').toLowerCase();
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
  return out;
}

async function readBytes(relPath) {
  requireReady();
  const { dir, name } = await resolveParent(relPath);
  const safeName = sanitizeName(name);
  let handle;
  try {
    handle = await dir.getFileHandle(safeName);
  } catch (e) {
    if (e.name === 'NotFoundError') throw new StorageError('source_not_found');
    throw e;
  }
  const file = await handle.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

async function readText(relPath) {
  const bytes = await readBytes(relPath);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

async function resolveDir(relPath) {
  if (relPath === '' || relPath === '/') return rootHandle;
  const parts = splitPath(relPath);
  let dir = rootHandle;
  for (const seg of parts) {
    try {
      dir = await dir.getDirectoryHandle(seg, { create: false });
    } catch (e) {
      if (e.name === 'TypeMismatchError') {
        throw new StorageError('path_collision', { segment: seg });
      }
      if (e.name === 'NotFoundError') {
        throw new StorageError('source_not_found');
      }
      throw e;
    }
  }
  return dir;
}

async function resolveParent(relPath, { create } = {}) {
  const parts = splitPath(relPath);
  if (parts.length === 0) throw new StorageError('empty_path');
  const name = parts.pop();
  let dir = rootHandle;
  for (const seg of parts) {
    try {
      dir = await dir.getDirectoryHandle(seg, { create: !!create });
    } catch (e) {
      if (e.name === 'TypeMismatchError') {
        throw new StorageError('path_collision', { segment: seg });
      }
      if (e.name === 'NotFoundError') {
        throw new StorageError('source_not_found');
      }
      throw e;
    }
  }
  return { dir, name };
}

async function probeEntry(dir, name) {
  try {
    await dir.getFileHandle(name);
    return 'file';
  } catch (e) {
    if (e.name === 'TypeMismatchError') return 'directory';
    if (e.name !== 'NotFoundError') throw e;
  }
  return null;
}

// =========================================================================
// Mutations
// =========================================================================

async function rename(relPath, newName) {
  guardPublicPath(relPath);
  const safeNew = sanitizeName(newName);
  if (safeNew === '.app') throw new StorageError('reserved_path', { name: safeNew });

  const srcParts = splitPath(relPath);
  const safeOld = srcParts.pop();
  const parentSegs = srcParts;
  if (safeOld === safeNew) return relPath;

  const srcPath = [...parentSegs, safeOld].join('/');
  const dstPath = [...parentSegs, safeNew].join('/');
  const a = `write:${srcPath}`;
  const b = `write:${dstPath}`;
  const [first, second] = a < b ? [a, b] : [b, a];

  return withLock(first, () => withLock(second, async () => {
    requireReady();
    const dir = parentSegs.length ? await resolveDir(parentSegs.join('/')) : rootHandle;

    let handle;
    let sourceKind;
    try {
      handle = await dir.getFileHandle(safeOld);
      sourceKind = 'file';
    } catch (e) {
      if (e.name !== 'NotFoundError' && e.name !== 'TypeMismatchError') throw e;
      try {
        handle = await dir.getDirectoryHandle(safeOld);
        sourceKind = 'directory';
      } catch (e2) {
        if (e2.name === 'NotFoundError') throw new StorageError('source_not_found');
        throw e2;
      }
    }

    const collision = await probeEntry(dir, safeNew);
    if (collision !== null) throw new StorageError('target_exists', { kind: collision });

    let atomic = true;
    if (typeof handle.move === 'function') {
      await handle.move(dir, safeNew);
    } else {
      if (sourceKind !== 'file') {
        throw new StorageError('move_unsupported', { kind: sourceKind });
      }
      atomic = false;
      const bytes = new Uint8Array(await (await handle.getFile()).arrayBuffer());
      await writeBytesInternal(dstPath, bytes, { ifAbsent: true });
      try {
        await dir.removeEntry(safeOld);
      } catch {
        throw new StorageError('rename_orphan', { src: srcPath, dst: dstPath });
      }
    }
    await audit('rename', { from: srcPath, to: dstPath, atomic });
    return dstPath;
  }));
}

async function remove(relPath, { recursive = false } = {}) {
  guardPublicPath(relPath);
  return withLock(lockKey(relPath), async () => {
    requireReady();
    const { dir, name } = await resolveParent(relPath);
    const safeName = sanitizeName(name);
    try {
      await dir.removeEntry(safeName, { recursive: !!recursive });
    } catch (e) {
      if (e.name === 'InvalidModificationError') throw new StorageError('not_empty');
      if (e.name === 'NotFoundError') throw new StorageError('source_not_found');
      throw e;
    }
    await audit('remove', { path: relPath, recursive });
  });
}

async function mkdir(relPath) {
  guardPublicPath(relPath);
  return withLock(lockKey(relPath), async () => {
    requireReady();
    const parts = splitPath(relPath);
    let dir = rootHandle;
    for (const seg of parts) {
      try {
        dir = await dir.getDirectoryHandle(seg, { create: true });
      } catch (e) {
        if (e.name === 'TypeMismatchError') {
          throw new StorageError('path_collision', { segment: seg });
        }
        throw e;
      }
    }
    await audit('mkdir', { path: relPath });
  });
}

// =========================================================================
// Audit log (§5.4)
// =========================================================================

async function audit(action, detail) {
  if (!isReady()) return;
  // Canonical keys after spread so caller's detail.action cannot shadow.
  const record = { ...detail, time: new Date().toISOString(), action };
  const line = JSON.stringify(record) + '\n';

  await withLock(AUDIT_LOCK, async () => {
    const handle = await ensureAuditFile();
    const file = await handle.getFile();
    const writable = await handle.createWritable({ keepExistingData: true });
    try {
      await writable.seek(file.size);
      await writable.write(new TextEncoder().encode(line));
      await writable.close();
    } catch (e) {
      try { await writable.abort(); } catch {}
      throw e;
    }
  });

  emit('audit', record);
}

async function ensureAuditFile() {
  const appDir = await rootHandle.getDirectoryHandle('.app', { create: true });
  return appDir.getFileHandle('audit.log', { create: true });
}

async function maybeRotateAuditLog() {
  await withLock(AUDIT_LOCK, async () => {
    if (!rootHandle) return;
    const appDir = await rootHandle.getDirectoryHandle('.app', { create: true });
    let handle;
    try { handle = await appDir.getFileHandle('audit.log'); } catch { return; }
    const f = await handle.getFile();

    if (f.size >= AUDIT_MAX_BYTES) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedName = `audit-${stamp}.log`;

      if (typeof handle.move === 'function') {
        await handle.move(appDir, rotatedName);
      } else {
        const rotated = await appDir.getFileHandle(rotatedName, { create: true });
        const wCopy = await rotated.createWritable({ keepExistingData: false });
        try { await wCopy.write(f); await wCopy.close(); }
        catch (e) { try { await wCopy.abort(); } catch {} throw e; }

        const wTrunc = await handle.createWritable({ keepExistingData: false });
        try { await wTrunc.close(); }
        catch (e) { try { await wTrunc.abort(); } catch {} throw e; }
      }
    }

    // Retention sweep.
    const rotated = [];
    for await (const entry of appDir.values()) {
      if (entry.kind === 'file' && /^audit-.*\.log$/.test(entry.name)) {
        rotated.push(entry.name);
      }
    }
    rotated.sort();
    while (rotated.length > AUDIT_KEEP_ROTATED) {
      const oldest = rotated.shift();
      try { await appDir.removeEntry(oldest); } catch {}
    }
  });
}

// =========================================================================
// Events
// =========================================================================

function on(eventName, fn) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(fn);
  return () => listeners.get(eventName)?.delete(fn);
}

function emit(eventName, payload) {
  const set = listeners.get(eventName);
  if (!set) return;
  for (const fn of set) {
    try { fn(payload); } catch { /* listener errors must not break storage */ }
  }
}

// =========================================================================
// Test hooks — not part of the public contract.
// =========================================================================
const _test = {
  setRoot(handle, state = 'granted') {
    rootHandle = handle;
    permissionState = state;
  },
  setPermission(state) {
    permissionState = state;
  },
  setForeignParent(handle) {
    foreignParent = handle;
  },
  getForeignParent() {
    return foreignParent;
  },
  reset() {
    rootHandle = null;
    permissionState = 'unknown';
    foreignParent = null;
    listeners.clear();
    _lockQueue.clear();
  },
  constants: { APP_FOLDER, APP_ID, APP_ID_HISTORY, AUDIT_MAX_BYTES, AUDIT_KEEP_ROTATED },
};

export { StorageError };

export const Storage = {
  // Lifecycle
  init,
  pickRoot,
  ensurePermission,
  isReady,
  hasRoot,
  rootName,
  detectPersistentPermissions,
  // Maintenance
  maybeRotateAuditLog,
  // Adoption flow
  adoptForeignFolder,
  cancelForeignAdoption,
  // Reads
  list,
  readText,
  readBytes,
  // Writes
  writeText,
  writeBytes,
  // Mutations
  rename,
  remove,
  mkdir,
  // Events
  on,
  // Test hooks (not part of the public contract)
  _test,
};
