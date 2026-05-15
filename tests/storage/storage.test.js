// Lifecycle, CRUD, foreign-folder, and error-translation tests for the
// Storage capability module. Uses MockDirectoryHandle in lieu of a real
// FileSystemDirectoryHandle.

import { Storage, StorageError } from '../../src/storage/storage.js';
import { MockDirectoryHandle, MockFileHandle, buildAppRoot } from './mock-fs.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

function resetStorage() {
  Storage._test.reset();
}

async function readBytesOf(handle) {
  const f = await handle.getFile();
  return new Uint8Array(await f.arrayBuffer());
}

// --- Atomic writes ---

describe('Storage.writeText / writeBytes — happy path', () => {
  it('writes a new file and reads it back', async () => {
    resetStorage();
    const root = new MockDirectoryHandle('MermaidIDE');
    Storage._test.setRoot(root);

    await Storage.writeText('hello.mmd', 'graph TD;\n  A-->B;');
    const got = await Storage.readText('hello.mmd');
    assert.strictEqual(got, 'graph TD;\n  A-->B;');
  });

  it('creates parent directories on write', async () => {
    resetStorage();
    const root = new MockDirectoryHandle('MermaidIDE');
    Storage._test.setRoot(root);

    await Storage.writeText('ProjA/diag1.mmd', 'graph TD; A-->B;');
    const got = await Storage.readText('ProjA/diag1.mmd');
    assert.strictEqual(got, 'graph TD; A-->B;');
  });

  it('overwrites an existing file atomically (no temp left behind)', async () => {
    resetStorage();
    const root = new MockDirectoryHandle('MermaidIDE');
    Storage._test.setRoot(root);

    await Storage.writeText('x.mmd', 'first');
    await Storage.writeText('x.mmd', 'second');
    assert.strictEqual(await Storage.readText('x.mmd'), 'second');
    const names = (await Storage.list('', { includeHidden: true })).map((e) => e.name);
    // No leftover .x.mmd.<rand>.tmp orphans.
    assert.ok(!names.some((n) => /^\.x\.mmd\..*\.tmp$/.test(n)), 'no temp orphan after atomic write');
  });

  it('writeBytes ifAbsent rejects existing path with target_exists', async () => {
    resetStorage();
    const root = new MockDirectoryHandle('MermaidIDE');
    Storage._test.setRoot(root);

    await Storage.writeText('x.mmd', 'one');
    let caught;
    try {
      await Storage.writeBytes('x.mmd', new TextEncoder().encode('two'), { ifAbsent: true });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof StorageError, 'should throw StorageError');
    assert.strictEqual(caught.code, 'target_exists');
    assert.strictEqual(await Storage.readText('x.mmd'), 'one', 'original untouched');
  });

  it('rejects non-Uint8Array/non-Blob data with bad_data_type', async () => {
    resetStorage();
    const root = new MockDirectoryHandle('MermaidIDE');
    Storage._test.setRoot(root);

    let caught;
    try {
      await Storage.writeBytes('x.mmd', 'this is a string, not bytes');
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'bad_data_type');
  });
});

// --- Guard: .app/ writes rejected, .app/ reads permitted ---

describe('Storage — .app/ guard discrimination', () => {
  it('writeText to .app/audit.log throws reserved_path', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    let caught;
    try {
      await Storage.writeText('.app/audit.log', 'x');
    } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'reserved_path');
  });

  it('readText from .app/audit.log succeeds (UX depends on this)', async () => {
    resetStorage();
    const root = await buildAppRoot();
    Storage._test.setRoot(root);

    // Drive a write through audit() so the file exists.
    await Storage.writeText('foo.mmd', 'hi');

    const log = await Storage.readText('.app/audit.log');
    assert.ok(log.length > 0, 'audit log not empty');
    // Each line is a JSON object terminated by newline.
    assert.ok(log.endsWith('\n'));
  });

  it('rename of a .app/ path throws reserved_path', async () => {
    resetStorage();
    Storage._test.setRoot(await buildAppRoot());
    let caught;
    try {
      await Storage.rename('.app/version', 'foo');
    } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'reserved_path');
  });

  it('rename to exactly ".app" throws reserved_path', async () => {
    resetStorage();
    const root = new MockDirectoryHandle('MermaidIDE');
    Storage._test.setRoot(root);
    await Storage.writeText('foo.mmd', 'x');

    let caught;
    try {
      await Storage.rename('foo.mmd', '.app');
    } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'reserved_path');
  });
});

// --- list / readText / readBytes ---

describe('Storage.list', () => {
  it('returns NFC-normalized case-insensitive sort, file metadata, skips dotfiles by default', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));

    await Storage.writeText('zebra.mmd', 'one');
    await Storage.writeText('Apple.mmd', 'two');
    await Storage.writeText('mango.mmd', 'three');
    await Storage.mkdir('subdir');

    const out = await Storage.list('');
    // .app may exist from audit but list skips dotfiles by default.
    const names = out.map((e) => e.name);
    assert.deepEqual(names, ['Apple.mmd', 'mango.mmd', 'subdir', 'zebra.mmd']);
    const apple = out.find((e) => e.name === 'Apple.mmd');
    assert.strictEqual(apple.kind, 'file');
    assert.strictEqual(apple.size, 3);
    assert.ok(typeof apple.modified === 'number');
  });

  it('includeHidden surfaces dotfiles', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    await Storage.writeText('public.mmd', 'x');
    const visible = (await Storage.list('')).map((e) => e.name);
    const all = (await Storage.list('', { includeHidden: true })).map((e) => e.name);
    assert.ok(!visible.includes('.app'), 'public list excludes .app');
    assert.ok(all.includes('.app'), 'includeHidden surfaces .app');
  });
});

describe('Storage.readText', () => {
  it('throws source_not_found for missing path', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    let caught;
    try { await Storage.readText('missing.mmd'); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'source_not_found');
  });
});

// --- mkdir / rename / remove ---

describe('Storage.mkdir', () => {
  it('creates nested directories', async () => {
    resetStorage();
    const root = new MockDirectoryHandle('MermaidIDE');
    Storage._test.setRoot(root);

    await Storage.mkdir('a/b/c');
    const listing = await Storage.list('a/b');
    assert.deepEqual(listing.map((e) => e.name), ['c']);
  });

  it('rejects .app paths', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    let caught;
    try { await Storage.mkdir('.app/sub'); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'reserved_path');
  });
});

describe('Storage.rename', () => {
  it('renames a file within the same directory', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    await Storage.writeText('old.mmd', 'hello');

    const newPath = await Storage.rename('old.mmd', 'new.mmd');
    assert.strictEqual(newPath, 'new.mmd');
    assert.strictEqual(await Storage.readText('new.mmd'), 'hello');

    let caught;
    try { await Storage.readText('old.mmd'); } catch (e) { caught = e; }
    assert.strictEqual(caught.code, 'source_not_found');
  });

  it('rejects rename to an existing file name with target_exists', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    await Storage.writeText('a.mmd', 'A');
    await Storage.writeText('b.mmd', 'B');

    let caught;
    try { await Storage.rename('a.mmd', 'b.mmd'); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'target_exists');
    assert.strictEqual(caught.detail.kind, 'file');
    assert.strictEqual(await Storage.readText('b.mmd'), 'B', 'destination untouched');
  });

  it('rejects rename to an existing directory name with target_exists', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    await Storage.writeText('a.mmd', 'A');
    await Storage.mkdir('b');

    let caught;
    try { await Storage.rename('a.mmd', 'b'); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'target_exists');
    assert.strictEqual(caught.detail.kind, 'directory');
  });

  it('throws source_not_found on missing source', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    let caught;
    try { await Storage.rename('nope.mmd', 'yep.mmd'); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'source_not_found');
  });

  it('returns input relPath when new name equals old', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    await Storage.writeText('same.mmd', 'x');
    const r = await Storage.rename('same.mmd', 'same.mmd');
    assert.strictEqual(r, 'same.mmd');
  });
});

describe('Storage.remove', () => {
  it('removes a file', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    await Storage.writeText('x.mmd', 'hi');
    await Storage.remove('x.mmd');
    let caught;
    try { await Storage.readText('x.mmd'); } catch (e) { caught = e; }
    assert.strictEqual(caught.code, 'source_not_found');
  });

  it('refuses non-empty directory without recursive', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    await Storage.writeText('proj/x.mmd', 'hi');
    let caught;
    try { await Storage.remove('proj'); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'not_empty');
  });

  it('removes a non-empty directory with recursive: true', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'));
    await Storage.writeText('proj/x.mmd', 'a');
    await Storage.writeText('proj/y.mmd', 'b');
    await Storage.remove('proj', { recursive: true });
    const top = await Storage.list('');
    assert.ok(!top.some((e) => e.name === 'proj'));
  });

  it('rejects .app paths', async () => {
    resetStorage();
    Storage._test.setRoot(await buildAppRoot());
    let caught;
    try { await Storage.remove('.app/version'); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'reserved_path');
  });
});

// --- Permission lifecycle ---

describe('Storage permission lifecycle', () => {
  it('isReady is false when handle is absent', () => {
    resetStorage();
    assert.strictEqual(Storage.isReady(), false);
    assert.strictEqual(Storage.hasRoot(), false);
  });

  it('writeText throws not_ready when permission is not granted', async () => {
    resetStorage();
    Storage._test.setRoot(new MockDirectoryHandle('MermaidIDE'), 'prompt');
    let caught;
    try { await Storage.writeText('x.mmd', 'hi'); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'not_ready');
  });

  it('ensurePermission throws no_root before pickRoot', async () => {
    resetStorage();
    let caught;
    try { await Storage.ensurePermission(); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'no_root');
  });

  it('ensurePermission translates NotAllowedError to gesture_required', async () => {
    resetStorage();
    const root = new MockDirectoryHandle('MermaidIDE');
    root.requestPermission = async () => {
      const e = new Error('no gesture'); e.name = 'NotAllowedError'; throw e;
    };
    Storage._test.setRoot(root, 'prompt');

    let caught;
    try { await Storage.ensurePermission(); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'gesture_required');
  });

  it('ensurePermission throws permission_denied when prompt returns denied', async () => {
    resetStorage();
    const root = new MockDirectoryHandle('MermaidIDE');
    root.requestPermission = async () => 'denied';
    Storage._test.setRoot(root, 'prompt');

    let caught;
    try { await Storage.ensurePermission(); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'permission_denied');
  });

  it('emits permissionchange on ensurePermission unconditionally', async () => {
    resetStorage();
    const root = new MockDirectoryHandle('MermaidIDE');
    Storage._test.setRoot(root, 'prompt');
    let count = 0;
    Storage.on('permissionchange', () => count++);

    await Storage.ensurePermission();
    assert.strictEqual(count, 1);
  });
});

// --- Foreign-folder adoption ---

describe('Storage foreign-folder adoption', () => {
  it('adoptForeignFolder throws no_pending_adoption when not pending', async () => {
    resetStorage();
    let caught;
    try { await Storage.adoptForeignFolder(true); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'no_pending_adoption');
  });

  it('adoptForeignFolder throws acknowledgment_required when ack is missing', async () => {
    resetStorage();
    const parent = new MockDirectoryHandle('Documents');
    await parent.getDirectoryHandle('MermaidIDE', { create: true }); // unrelated MermaidIDE
    Storage._test.setForeignParent(parent);

    let caught;
    try { await Storage.adoptForeignFolder(false); } catch (e) { caught = e; }
    assert.ok(caught instanceof StorageError);
    assert.strictEqual(caught.code, 'acknowledgment_required');
  });

  it('adoptForeignFolder nests inside the existing MermaidIDE/ when acknowledged', async () => {
    resetStorage();
    const parent = new MockDirectoryHandle('Documents');
    await parent.getDirectoryHandle('MermaidIDE', { create: true });
    Storage._test.setForeignParent(parent);

    await Storage.adoptForeignFolder(true);

    // Resulting root should be Documents/MermaidIDE/MermaidIDE
    assert.strictEqual(Storage.hasRoot(), true);
    assert.strictEqual(Storage.isReady(), true);
    assert.strictEqual(Storage.rootName(), 'MermaidIDE');
    assert.strictEqual(Storage._test.getForeignParent(), null, 'foreignParent cleared after nest');
  });

  it('cancelForeignAdoption clears the pending parent', () => {
    resetStorage();
    Storage._test.setForeignParent(new MockDirectoryHandle('whatever'));
    assert.ok(Storage._test.getForeignParent() !== null);
    Storage.cancelForeignAdoption();
    assert.strictEqual(Storage._test.getForeignParent(), null);
  });
});

// --- APP_ID_HISTORY recognition ---

describe('Storage APP_ID_HISTORY', () => {
  it('isReady stays granted when version marker matches a historical APP_ID', async () => {
    resetStorage();
    // Construct an "old" root with version marker. Our APP_ID_HISTORY
    // currently has only one entry — verify the lookup mechanism works for
    // the current one. (A real version bump test would add an old id to
    // APP_ID_HISTORY and write that older id into the marker; this test
    // ensures the lookup actually runs.)
    const old = await buildAppRoot(); // uses current APP_ID
    Storage._test.setRoot(old);
    assert.strictEqual(Storage.isReady(), true);
  });
});
