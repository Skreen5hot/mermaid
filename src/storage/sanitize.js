// Pure sanitization primitives for FSA storage paths.
//
// These run at the storage-module boundary and reject anything that could
// escape the app folder, produce a Windows-illegal name, or smuggle a control
// character past the OS layer.
//
// Cross-references:
//   - PWA_LOCAL_STORAGE_GUIDE §4.2 (guardPublicPath)
//   - PWA_LOCAL_STORAGE_GUIDE §4.3 (sanitizeName, splitPath, lockKey)
//   - PWA_LOCAL_STORAGE_GUIDE Appendix C (test corpus)

import { StorageError } from './StorageError.js';

const WIN_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

export const MAX_SEGMENT_LEN = 200;
export const MAX_PATH_LEN = 380;

export function sanitizeName(name) {
  if (typeof name !== 'string') throw new StorageError('bad_name');
  let s = name.normalize('NFC');

  if (/[\x00-\x1f\x7f]/.test(s)) throw new StorageError('control_char');

  if (s.includes('/') || s.includes('\\')) throw new StorageError('separator');

  if (s === '.' || s === '..') throw new StorageError('traversal');

  if (/[<>:"|?*]/.test(s)) throw new StorageError('forbidden_char');

  // Windows silently trims trailing dots and spaces — be strict at our boundary.
  s = s.replace(/[. ]+$/g, '');
  if (!s) throw new StorageError('empty');

  // Reserved device names match the first segment before any dot:
  // "CON.txt" → "CON" → reserved.
  const base = s.split('.')[0].toUpperCase();
  if (WIN_RESERVED.has(base)) throw new StorageError('reserved');

  if (s.length > MAX_SEGMENT_LEN) throw new StorageError('too_long');

  return s;
}

export function splitPath(relPath) {
  if (typeof relPath !== 'string') throw new StorageError('bad_path');
  if (relPath.length === 0) throw new StorageError('empty_path');

  const raw = relPath.split('/');

  for (const seg of raw) {
    if (seg.length === 0) throw new StorageError('empty_segment');
  }

  const segments = raw.map(sanitizeName);

  const total = segments.reduce((n, s) => n + s.length + 1, 0) - 1;
  if (total > MAX_PATH_LEN) throw new StorageError('path_too_long');

  return segments;
}

// Single source of truth for the canonical form of a path. All Web Lock names
// are derived from this so concurrent operations on the same path always
// agree on the lock name.
export function lockKey(relPath) {
  return `write:${splitPath(relPath).join('/')}`;
}

// Write/mutation guard — rejects anything routed under .app/. The audit log
// and version marker have their own internal writers; public callers must
// never touch .app/* or they would deadlock against the audit lock.
//
// Reads do NOT call this — the Settings → Activity log UX depends on
// readText(".app/audit.log") succeeding (spec §5.4).
export function guardPublicPath(relPath) {
  if (typeof relPath !== 'string') throw new StorageError('bad_path');
  const first = relPath.split('/')[0];
  if (first === '.app') throw new StorageError('reserved_path', { prefix: '.app/' });
}
