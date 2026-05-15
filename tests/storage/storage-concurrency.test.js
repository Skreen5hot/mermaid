// Concurrency tests. The Web Lock fallback (Promise chain keyed by lockKey)
// must serialize same-path writes; different-path writes should not block
// each other.

import { Storage, StorageError } from '../../src/storage/storage.js';
import { MockDirectoryHandle } from './mock-fs.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

describe('Storage Web Locks — same-path serialization', () => {
  it('two parallel writeText to the same path produce a defined final value', async () => {
    Storage._test.reset();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));

    // Kick both off without await. Both must succeed; one wins, one's bytes
    // become the final content. The key is that one finishes before the
    // other starts its tmp+move, so we don't get torn or interleaved bytes.
    await Promise.all([
      Storage.writeText('shared.mmd', 'AAA'),
      Storage.writeText('shared.mmd', 'BBB'),
    ]);

    const got = await Storage.readText('shared.mmd');
    assert.ok(got === 'AAA' || got === 'BBB', `expected AAA or BBB, got ${JSON.stringify(got)}`);
    assert.strictEqual(got.length, 3, 'no torn bytes');
  });

  it('two parallel writeBytes with ifAbsent: one succeeds, one throws target_exists', async () => {
    Storage._test.reset();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));

    const enc = new TextEncoder();
    const results = await Promise.allSettled([
      Storage.writeBytes('race.mmd', enc.encode('A'), { ifAbsent: true }),
      Storage.writeBytes('race.mmd', enc.encode('B'), { ifAbsent: true }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.strictEqual(fulfilled.length, 1, 'exactly one ifAbsent write succeeds');
    assert.strictEqual(rejected.length, 1, 'exactly one ifAbsent write fails');
    assert.ok(rejected[0].reason instanceof StorageError);
    assert.strictEqual(rejected[0].reason.code, 'target_exists');
  });

  it('writes to different paths run independently', async () => {
    Storage._test.reset();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));

    await Promise.all([
      Storage.writeText('a.mmd', 'A'),
      Storage.writeText('b.mmd', 'B'),
      Storage.writeText('c.mmd', 'C'),
    ]);

    assert.strictEqual(await Storage.readText('a.mmd'), 'A');
    assert.strictEqual(await Storage.readText('b.mmd'), 'B');
    assert.strictEqual(await Storage.readText('c.mmd'), 'C');
  });

  it('rename and write to the same file serialize against each other', async () => {
    Storage._test.reset();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));

    await Storage.writeText('src.mmd', 'initial');

    // Kick off a write and a rename concurrently. Both must complete; the
    // lock ordering means one observes the other's effect.
    const [, finalPath] = await Promise.all([
      Storage.writeText('src.mmd', 'updated'),
      // The rename uses lockKey('src.mmd') AND lockKey('dst.mmd');
      // serializes with the writeText above.
      (async () => {
        // small delay so writeText acquires the lock first deterministically
        await Promise.resolve();
        return Storage.rename('src.mmd', 'dst.mmd');
      })(),
    ]);

    assert.strictEqual(finalPath, 'dst.mmd');
    // After serialization, either:
    //   - write completed first → dst.mmd has 'updated'
    //   - rename completed first → write would have failed (source moved)
    //   We accept either as long as no torn state remains.
    const dstText = await Storage.readText('dst.mmd');
    assert.ok(dstText === 'updated' || dstText === 'initial');
  });
});
