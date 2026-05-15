// Appendix C corpus tests for sanitizeName, splitPath, lockKey, guardPublicPath.
//
// Source of truth: docs/specifications/PWA_LOCAL_STORAGE_GUIDE.md Appendix C.
// Each row is either an "accept" case (input -> expected return value) or a
// "reject" case (input -> expected StorageError.code).
//
// Control characters in the rejects table use \uNNNN escapes per the spec's
// own guidance: readable, reviewable, survives copy-paste.

import {
  sanitizeName,
  splitPath,
  lockKey,
  guardPublicPath,
  MAX_SEGMENT_LEN,
} from '../../src/storage/sanitize.js';
import { StorageError } from '../../src/storage/StorageError.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

// --- sanitizeName -----------------------------------------------------------

describe('sanitizeName — accepts valid names', () => {
  const accepts = [
    ['foo.txt', 'foo.txt'],
    ['Hello World.md', 'Hello World.md'],
    ['café.json', 'café.json'],
    // NFC: precomposed e-acute
    ['café', 'café'],
    // NFD: e + combining acute (U+0301) must normalize to precomposed
    ['café', 'café'],
    // Interior dots preserved (trim is trailing-only)
    ['foo.bar.baz', 'foo.bar.baz'],
    // Look-alikes for reserved names but base differs
    ['CONFIG.txt', 'CONFIG.txt'],
    ['NULL.txt', 'NULL.txt'],
    ['AUXILIARY', 'AUXILIARY'],
    // Trailing trim of dots/spaces
    ['trailing.   ', 'trailing'],
    ['trailing.dot.', 'trailing.dot'],
    ['trailing.space ', 'trailing.space'],
    // Boundary length: 200 passes
    ['a'.repeat(MAX_SEGMENT_LEN), 'a'.repeat(MAX_SEGMENT_LEN)],
  ];
  for (const [input, expected] of accepts) {
    it(`accepts ${JSON.stringify(input)}`, () => {
      assert.strictEqual(sanitizeName(input), expected);
    });
  }
});

describe('sanitizeName — rejects invalid names', () => {
  const rejects = [
    ['', 'empty'],
    ['.', 'traversal'],
    ['..', 'traversal'],
    ['...', 'empty'],

    ['foo/bar.txt', 'separator'],
    ['foo\\bar.txt', 'separator'],

    [`foo${String.fromCharCode(0x00)}bar`, 'control_char'], // NUL
    [`foo${String.fromCharCode(0x07)}bar`, 'control_char'], // BEL
    [`foo${String.fromCharCode(0x1f)}bar`, 'control_char'], // US
    [`foo${String.fromCharCode(0x7f)}bar`, 'control_char'], // DEL
    ['foo\nbar', 'control_char'],
    ['foo\tbar', 'control_char'],

    ['foo<script>.txt', 'forbidden_char'],
    ['foo>bar', 'forbidden_char'],
    ['foo:bar', 'forbidden_char'],
    ['foo"bar', 'forbidden_char'],
    ['foo|bar', 'forbidden_char'],
    ['foo?bar', 'forbidden_char'],
    ['foo*bar', 'forbidden_char'],

    ['   ', 'empty'],
    ['...   ', 'empty'],

    ['CON', 'reserved'],
    ['con', 'reserved'],
    ['CON.txt', 'reserved'],
    ['PRN.json', 'reserved'],
    ['NUL', 'reserved'],
    ['COM1', 'reserved'],
    ['LPT9.tmp', 'reserved'],

    // Boundary length: 201 fails
    ['a'.repeat(MAX_SEGMENT_LEN + 1), 'too_long'],
  ];
  for (const [input, code] of rejects) {
    it(`rejects ${JSON.stringify(input)} with ${code}`, () => {
      const e = assert.throws(() => sanitizeName(input), code);
      assert.ok(e instanceof StorageError, 'thrown error should be a StorageError');
    });
  }

  it('rejects non-string with bad_name', () => {
    assert.throws(() => sanitizeName(null), 'bad_name');
    assert.throws(() => sanitizeName(undefined), 'bad_name');
    assert.throws(() => sanitizeName(42), 'bad_name');
  });
});

// --- splitPath --------------------------------------------------------------

describe('splitPath — accepts valid paths', () => {
  const accepts = [
    ['foo/bar', ['foo', 'bar']],
    ['a/b/c/d.txt', ['a', 'b', 'c', 'd.txt']],
    ['single', ['single']],
    ['.app/audit.log', ['.app', 'audit.log']],
    // Boundary: 190 + 1 + 189 = 380 total joined length, equal to MAX_PATH_LEN
    [`${'a'.repeat(190)}/${'a'.repeat(189)}`, ['a'.repeat(190), 'a'.repeat(189)]],
  ];
  for (const [input, expected] of accepts) {
    it(`accepts ${JSON.stringify(input)}`, () => {
      assert.deepEqual(splitPath(input), expected);
    });
  }
});

describe('splitPath — rejects invalid paths', () => {
  it('rejects empty string with empty_path', () => {
    assert.throws(() => splitPath(''), 'empty_path');
  });
  it('rejects leading slash with empty_segment', () => {
    assert.throws(() => splitPath('/foo'), 'empty_segment');
  });
  it('rejects double slash with empty_segment', () => {
    assert.throws(() => splitPath('foo//bar'), 'empty_segment');
  });
  it('rejects trailing slash with empty_segment', () => {
    assert.throws(() => splitPath('foo/'), 'empty_segment');
  });
  it('propagates traversal from sanitizeName', () => {
    assert.throws(() => splitPath('foo/../bar'), 'traversal');
  });
  it('propagates reserved from sanitizeName', () => {
    assert.throws(() => splitPath('foo/CON/baz'), 'reserved');
  });
  it('rejects total path length > MAX_PATH_LEN with path_too_long', () => {
    // 200 + 1 + 180 = 381. Each segment is <= MAX_SEGMENT_LEN; joined exceeds.
    const input = `${'a'.repeat(200)}/${'a'.repeat(180)}`;
    assert.throws(() => splitPath(input), 'path_too_long');
  });
  it('rejects non-string with bad_path', () => {
    assert.throws(() => splitPath(null), 'bad_path');
    assert.throws(() => splitPath(undefined), 'bad_path');
    assert.throws(() => splitPath(42), 'bad_path');
  });
});

// --- lockKey ----------------------------------------------------------------

describe('lockKey', () => {
  it('produces write: prefix for a leaf path', () => {
    assert.strictEqual(lockKey('foo.txt'), 'write:foo.txt');
  });
  it('produces write: prefix for a nested path', () => {
    assert.strictEqual(lockKey('a/b/c.txt'), 'write:a/b/c.txt');
  });
  it('accepts .app/ paths (public-API guard is a separate concern)', () => {
    assert.strictEqual(lockKey('.app/audit.log'), 'write:.app/audit.log');
  });
  it('propagates splitPath errors', () => {
    assert.throws(() => lockKey(''), 'empty_path');
    assert.throws(() => lockKey('//foo'), 'empty_segment');
    assert.throws(() => lockKey('foo/..'), 'traversal');
  });
});

// --- guardPublicPath --------------------------------------------------------

describe('guardPublicPath — accepts public paths', () => {
  const accepts = [
    'foo.txt',
    'subdir/foo.txt',
    // .app must be the first segment exactly; .apple is unrelated
    '.apple/foo',
    // .app deeper in the path is fine; only the leading segment is reserved
    'foo/.app/bar',
  ];
  for (const input of accepts) {
    it(`accepts ${JSON.stringify(input)}`, () => {
      guardPublicPath(input);
    });
  }
});

describe('guardPublicPath — rejects .app paths', () => {
  const rejects = [
    '.app/audit.log',
    '.app/version',
    // Exact match without trailing slash also rejected
    '.app',
  ];
  for (const input of rejects) {
    it(`rejects ${JSON.stringify(input)} with reserved_path`, () => {
      const e = assert.throws(() => guardPublicPath(input), 'reserved_path');
      assert.strictEqual(e.detail.prefix, '.app/');
    });
  }

  it('rejects non-string with bad_path', () => {
    assert.throws(() => guardPublicPath(null), 'bad_path');
    assert.throws(() => guardPublicPath(undefined), 'bad_path');
  });
});
