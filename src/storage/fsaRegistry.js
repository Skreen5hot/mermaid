// fsaRegistry — per-project FSA folder handle metadata.
//
// Each row in the `fsaProjects` IDB store represents one folder-backed
// project the user has set up. Rows are added by the New-Project flow
// (Phase 5c) and by the v2→v3 migration (Phase 5b). This module is the
// only place that touches that store.
//
// Row shape:
//   {
//     id:            'fsa:<uuid>' (new) or 'fsa:<folderName>' (migrated)
//     name:          user-chosen project label; independent of folder name
//     handle:        FileSystemDirectoryHandle (the folder the user picked)
//     diagramsPath:  '' (legacy, files at folder root) or 'mermaid' (new
//                    projects — files in <folder>/mermaid/)
//     createdAt:     ISO timestamp
//   }
//
// Pure data layer. No events, no permission management. Callers (router,
// migration, UX flow) handle those concerns.

import { open, STORE_FSA_PROJECTS } from './handlesDb.js';

// Generate a stable id for a new project. randomUUID is broadly supported in
// modern browsers; we fall back to a time+random hex string for Node tests
// where the global may not exist.
function _newId() {
  const c = (typeof globalThis !== 'undefined') ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return `fsa:${c.randomUUID()}`;
  }
  const rand = Math.floor(Math.random() * 0xffffffff).toString(36);
  return `fsa:${Date.now().toString(36)}-${rand}`;
}

export async function init() {
  await open();
}

export async function list() {
  const db = await open();
  if (!db) return [];
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_FSA_PROJECTS], 'readonly');
    const r = tx.objectStore(STORE_FSA_PROJECTS).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
}

export async function get(id) {
  const db = await open();
  if (!db) return null;
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_FSA_PROJECTS], 'readonly');
    const r = tx.objectStore(STORE_FSA_PROJECTS).get(id);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}

// Insert a new row. If `id` is omitted, generates a fresh fsa:<uuid>. If
// provided (used by migration to preserve the legacy fsa:<folderName>
// form), inserts with that exact id.
export async function add({ name, handle, diagramsPath = 'mermaid', id } = {}) {
  if (!name) throw new Error('fsaRegistry.add: name is required');
  if (!handle) throw new Error('fsaRegistry.add: handle is required');
  const db = await open();
  if (!db) throw new Error('fsaRegistry.add: IndexedDB is not available');
  const row = {
    id: id || _newId(),
    name,
    handle,
    diagramsPath,
    createdAt: new Date().toISOString(),
  };
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_FSA_PROJECTS], 'readwrite');
    const r = tx.objectStore(STORE_FSA_PROJECTS).add(row);
    r.onsuccess = () => res(row);
    r.onerror = () => rej(r.error);
  });
}

// Merge `patch` into the existing row. Throws if no row with that id.
// Does NOT change the id even if patch.id is set.
export async function update(id, patch) {
  const existing = await get(id);
  if (!existing) throw new Error(`fsaRegistry.update: no row with id ${id}`);
  const merged = { ...existing, ...patch, id: existing.id };
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_FSA_PROJECTS], 'readwrite');
    const r = tx.objectStore(STORE_FSA_PROJECTS).put(merged);
    r.onsuccess = () => res(merged);
    r.onerror = () => rej(r.error);
  });
}

export async function remove(id) {
  const db = await open();
  if (!db) return;
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_FSA_PROJECTS], 'readwrite');
    const r = tx.objectStore(STORE_FSA_PROJECTS).delete(id);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

// Test helper.
export async function clear() {
  const db = await open();
  if (!db) return;
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_FSA_PROJECTS], 'readwrite');
    const r = tx.objectStore(STORE_FSA_PROJECTS).clear();
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}
