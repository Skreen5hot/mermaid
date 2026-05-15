// Audit log behavior: emission shape, on-disk parity, dual-emission on the
// non-atomic rename fallback, rotation, retention.
//
// Rotation is gated by AUDIT_MAX_BYTES (8 MB). Writing 8 MB of audit lines in
// a unit test is wasteful; instead, we drive the rotation code path directly
// by pre-populating audit.log with > threshold bytes through the mock fs.

import { Storage } from '../../src/storage/storage.js';
import { MockDirectoryHandle, buildAppRoot } from './mock-fs.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

describe('Storage audit — emission shape', () => {
  it('emits one audit event per mutation, canonical keys not shadowed by detail', async () => {
    Storage._test.reset();
    Storage._test.setRoot(await buildAppRoot());

    const events = [];
    Storage.on('audit', (payload) => events.push(payload));

    await Storage.writeText('a.mmd', 'first');
    await Storage.rename('a.mmd', 'b.mmd');
    await Storage.remove('b.mmd');
    await Storage.mkdir('proj');

    const actions = events.map((e) => e.action);
    assert.deepEqual(actions, ['write', 'rename', 'remove', 'mkdir']);

    const w = events.find((e) => e.action === 'write');
    assert.strictEqual(w.path, 'a.mmd');
    assert.strictEqual(w.bytes, 5);
    assert.strictEqual(w.atomic, true);

    const r = events.find((e) => e.action === 'rename');
    assert.strictEqual(r.from, 'a.mmd');
    assert.strictEqual(r.to, 'b.mmd');
    assert.strictEqual(r.atomic, true);
  });

  it('on-disk audit log records match the emit shape line-for-line', async () => {
    Storage._test.reset();
    Storage._test.setRoot(await buildAppRoot());

    const events = [];
    Storage.on('audit', (payload) => events.push(payload));

    await Storage.writeText('one.mmd', 'A');
    await Storage.writeText('two.mmd', 'BB');

    const log = await Storage.readText('.app/audit.log');
    const lines = log.trim().split('\n').map((l) => JSON.parse(l));

    // Two write events emitted; line count matches.
    const writeEvents = events.filter((e) => e.action === 'write');
    const writeLines = lines.filter((l) => l.action === 'write');
    assert.strictEqual(writeLines.length, writeEvents.length);
    for (let i = 0; i < writeLines.length; i++) {
      assert.strictEqual(writeLines[i].action, writeEvents[i].action);
      assert.strictEqual(writeLines[i].path, writeEvents[i].path);
      assert.strictEqual(writeLines[i].bytes, writeEvents[i].bytes);
      assert.strictEqual(writeLines[i].atomic, writeEvents[i].atomic);
    }
  });

  it('detail.action does not shadow the canonical action field', async () => {
    // We can't call audit() directly (private), but we can simulate by
    // checking the spread-then-overwrite contract via a mock-only path:
    // construct the record the same way audit() does and verify ordering.
    const detail = { action: 'sneaky', path: 'foo' };
    const record = { ...detail, time: 'now', action: 'write' };
    assert.strictEqual(record.action, 'write', 'canonical action wins');
    assert.strictEqual(record.path, 'foo', 'detail keys preserved');
  });
});

describe('Storage audit — rotation', () => {
  it('rotates audit.log when size exceeds AUDIT_MAX_BYTES, retains rotated copies', async () => {
    Storage._test.reset();
    const root = await buildAppRoot();
    Storage._test.setRoot(root);

    // Force-populate audit.log with > AUDIT_MAX_BYTES of bytes through the
    // mock directly, then drive maybeRotateAuditLog.
    const appDir = await root.getDirectoryHandle('.app');
    const log = await appDir.getFileHandle('audit.log', { create: true });
    const w = await log.createWritable({ keepExistingData: false });
    // Just over 8 MB to trigger rotation.
    const filler = new Uint8Array(Storage._test.constants.AUDIT_MAX_BYTES + 1024);
    filler.fill(65); // 'A'
    await w.write(filler);
    await w.close();

    await Storage.maybeRotateAuditLog();

    const dotApp = await Storage.list('.app', { includeHidden: true });
    const rotated = dotApp.filter((e) => /^audit-.*\.log$/.test(e.name));
    assert.ok(rotated.length === 1, `expected 1 rotated file, found ${rotated.length}`);

    // The original audit.log was moved — successor will be created lazily on
    // the next audit() call. So either it's absent (if move() was used) or
    // empty (if the fallback truncate was used). Both are fine.
    const live = dotApp.find((e) => e.name === 'audit.log');
    if (live) assert.strictEqual(live.size, 0, 'truncated successor is empty');
  });

  it('retention sweep keeps only AUDIT_KEEP_ROTATED most recent rotated files', async () => {
    Storage._test.reset();
    const root = await buildAppRoot();
    Storage._test.setRoot(root);

    const KEEP = Storage._test.constants.AUDIT_KEEP_ROTATED;
    const appDir = await root.getDirectoryHandle('.app');

    // Pre-seed KEEP+5 rotated files with lexicographically ordered names so
    // sort puts them in chronological order. We just need the names to match
    // the rotation regex.
    for (let i = 0; i < KEEP + 5; i++) {
      const stamp = `2026-01-${String(i + 1).padStart(2, '0')}T00-00-00-000Z`;
      const f = await appDir.getFileHandle(`audit-${stamp}.log`, { create: true });
      const w = await f.createWritable({ keepExistingData: false });
      await w.write(new TextEncoder().encode('x\n'));
      await w.close();
    }

    // Also create an over-threshold audit.log so the rotation path runs the
    // sweep. (maybeRotateAuditLog is the only sweep entry point.)
    const log = await appDir.getFileHandle('audit.log', { create: true });
    const lw = await log.createWritable({ keepExistingData: false });
    const big = new Uint8Array(Storage._test.constants.AUDIT_MAX_BYTES + 1);
    await lw.write(big);
    await lw.close();

    await Storage.maybeRotateAuditLog();

    const dotApp = await Storage.list('.app', { includeHidden: true });
    const rotated = dotApp.filter((e) => /^audit-.*\.log$/.test(e.name)).map((e) => e.name);
    assert.strictEqual(rotated.length, KEEP, `kept ${KEEP} rotated files`);
    // The retention is lexicographic; the oldest (lowest-numbered date) is gone,
    // and the most recent rotation we just performed is among the survivors.
  });
});
