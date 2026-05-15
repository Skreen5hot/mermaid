// In-memory mock of the FileSystemDirectoryHandle / FileHandle surface used
// by storage.js. Implements only what the storage module touches:
//   - getDirectoryHandle(name, {create})
//   - getFileHandle(name, {create})
//   - removeEntry(name, {recursive})
//   - values() (async iterator)
//   - queryPermission / requestPermission
// File side:
//   - getFile() → snapshot with .size, .lastModified, .arrayBuffer(), .text()
//   - createWritable({keepExistingData}) → MockWritable
//   - move(targetDir, newName) — atomic rename within or across dirs
//
// Errors use the FSA standard names: NotFoundError, TypeMismatchError,
// InvalidModificationError, so storage.js's catch branches behave the same
// as in a real browser.

function fsErr(name, msg) {
  const e = new Error(msg || name);
  e.name = name;
  return e;
}

class MockWritable {
  constructor(fileHandle, keepExistingData) {
    this._fh = fileHandle;
    this._bytes = keepExistingData && fileHandle._bytes
      ? new Uint8Array(fileHandle._bytes)
      : new Uint8Array(0);
    this._pos = this._bytes.byteLength;
    this._closed = false;
    this._aborted = false;
  }

  async write(data) {
    if (this._closed) throw new Error('writable already closed');
    if (this._aborted) throw new Error('writable aborted');
    let chunk;
    if (data instanceof Uint8Array) {
      chunk = data;
    } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
      chunk = new Uint8Array(await data.arrayBuffer());
    } else if (data && typeof data.arrayBuffer === 'function') {
      // Treat MockFile (from getFile()) like a Blob.
      chunk = new Uint8Array(await data.arrayBuffer());
    } else {
      throw new TypeError(`MockWritable.write: unsupported data type (${typeof data})`);
    }
    const need = Math.max(this._pos + chunk.byteLength, this._bytes.byteLength);
    if (need > this._bytes.byteLength) {
      const grown = new Uint8Array(need);
      grown.set(this._bytes);
      this._bytes = grown;
    }
    this._bytes.set(chunk, this._pos);
    this._pos += chunk.byteLength;
  }

  async seek(pos) {
    if (this._closed || this._aborted) throw new Error('writable not open');
    this._pos = pos;
  }

  async close() {
    if (this._aborted) throw new Error('writable aborted');
    if (this._closed) return;
    this._closed = true;
    this._fh._bytes = this._bytes;
    this._fh._lastModified = Date.now();
  }

  async abort() {
    if (this._closed) throw new Error('already closed');
    this._aborted = true;
  }
}

export class MockFileHandle {
  constructor(name) {
    this.name = name;
    this.kind = 'file';
    this._bytes = new Uint8Array(0);
    this._lastModified = Date.now();
    this._parent = null;
  }

  async getFile() {
    // Snapshot: subsequent writes must not affect this returned File-like.
    const snapshot = new Uint8Array(this._bytes);
    const lastModified = this._lastModified;
    return {
      size: snapshot.byteLength,
      lastModified,
      async arrayBuffer() {
        return snapshot.buffer.slice(snapshot.byteOffset, snapshot.byteOffset + snapshot.byteLength);
      },
      async text() {
        return new TextDecoder('utf-8', { fatal: true }).decode(snapshot);
      },
    };
  }

  async createWritable(opts = {}) {
    return new MockWritable(this, opts.keepExistingData);
  }

  async move(targetDir, newName) {
    if (!(targetDir instanceof MockDirectoryHandle)) {
      throw new TypeError('move: target is not a directory handle');
    }
    if (!this._parent) throw new Error('orphan file handle');
    // Atomic replace: if a file already exists at the destination, overwrite.
    delete this._parent._entries[this.name];
    this.name = newName;
    targetDir._entries[newName] = this;
    this._parent = targetDir;
  }
}

export class MockDirectoryHandle {
  constructor(name = 'mock-root') {
    this.name = name;
    this.kind = 'directory';
    this._entries = Object.create(null);
    this._parent = null;
    this._permission = 'granted';
  }

  async getDirectoryHandle(name, { create = false } = {}) {
    const existing = this._entries[name];
    if (existing) {
      if (existing.kind === 'directory') return existing;
      throw fsErr('TypeMismatchError', `file exists at ${name}`);
    }
    if (!create) throw fsErr('NotFoundError', name);
    const dir = new MockDirectoryHandle(name);
    dir._parent = this;
    this._entries[name] = dir;
    return dir;
  }

  async getFileHandle(name, { create = false } = {}) {
    const existing = this._entries[name];
    if (existing) {
      if (existing.kind === 'file') return existing;
      throw fsErr('TypeMismatchError', `directory exists at ${name}`);
    }
    if (!create) throw fsErr('NotFoundError', name);
    const file = new MockFileHandle(name);
    file._parent = this;
    this._entries[name] = file;
    return file;
  }

  async removeEntry(name, { recursive = false } = {}) {
    const entry = this._entries[name];
    if (!entry) throw fsErr('NotFoundError', name);
    if (entry.kind === 'directory') {
      if (Object.keys(entry._entries).length > 0 && !recursive) {
        throw fsErr('InvalidModificationError', `${name} not empty`);
      }
    }
    delete this._entries[name];
  }

  async *values() {
    for (const v of Object.values(this._entries)) yield v;
  }

  async queryPermission() { return this._permission; }

  async requestPermission() {
    if (this._permission === 'denied-then-request') {
      this._permission = 'denied';
      return 'denied';
    }
    return this._permission;
  }
}

// Build an empty root with the .app/version marker already present.
// Useful for tests that want a "this directory is already our app root".
export async function buildAppRoot(appId = 'mermaid-ide.v1') {
  const root = new MockDirectoryHandle('MermaidIDE');
  const appDir = await root.getDirectoryHandle('.app', { create: true });
  const v = await appDir.getFileHandle('version', { create: true });
  const w = await v.createWritable({ keepExistingData: false });
  await w.write(new TextEncoder().encode(appId + '\n'));
  await w.close();
  return root;
}
