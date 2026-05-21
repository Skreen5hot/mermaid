// Minimal in-memory IndexedDB mock for the MermaidIDE.handles tests.
// Intentionally simpler than fake-indexeddb — we only need the surface our
// fsaRegistry / auditLog / handlesDb modules actually use:
//   - indexedDB.open with version + onupgradeneeded
//   - db.transaction([stores], mode) → tx.objectStore(name)
//   - store.add / put / get / getAll / delete / clear / count / openCursor
//   - db.objectStoreNames.contains
//   - keyPath + autoIncrement semantics on add/put
//
// Requests resolve via microtask (Promise.resolve().then) so callers using
// `await` proceed naturally without a manual flushMockRequests pump.

function _firePromise(req, kind, value) {
  Promise.resolve().then(() => {
    if (kind === 'success') {
      req.result = value;
      if (req.onsuccess) req.onsuccess({ target: req });
    } else {
      req.error = value;
      if (req.onerror) req.onerror({ target: req });
    }
  });
}

class MockStore {
  constructor(name, opts = {}) {
    this.name = name;
    this.keyPath = opts.keyPath || null;
    this.autoIncrement = !!opts.autoIncrement;
    this._records = [];
    this._nextAuto = 1;
  }

  _keyOf(record, explicitKey) {
    if (this.keyPath) return record[this.keyPath];
    return explicitKey;
  }

  _findIndex(key) {
    return this._records.findIndex((r) => {
      if (this.keyPath) return r[this.keyPath] === key;
      return r._mockKey === key;
    });
  }

  add(value, key) {
    const req = {};
    let stored;
    if (this.keyPath) {
      stored = value;
      if (stored[this.keyPath] == null && this.autoIncrement) {
        stored[this.keyPath] = this._nextAuto++;
      }
      const k = stored[this.keyPath];
      if (k == null) { _firePromise(req, 'error', new Error('Key required')); return req; }
      if (this._findIndex(k) >= 0) { _firePromise(req, 'error', new Error('ConstraintError: key already exists')); return req; }
      this._records.push(stored);
      _firePromise(req, 'success', k);
    } else {
      stored = { ...(value == null ? {} : value), _mockKey: key };
      this._records.push(stored);
      _firePromise(req, 'success', key);
    }
    return req;
  }

  put(value, key) {
    const req = {};
    if (this.keyPath) {
      const stored = value;
      const k = stored[this.keyPath];
      if (k == null) { _firePromise(req, 'error', new Error('Key required')); return req; }
      const idx = this._findIndex(k);
      if (idx >= 0) this._records[idx] = stored;
      else this._records.push(stored);
      _firePromise(req, 'success', k);
    } else {
      const idx = this._findIndex(key);
      const stored = { _mockKey: key, _value: value };
      if (idx >= 0) this._records[idx] = stored;
      else this._records.push(stored);
      _firePromise(req, 'success', key);
    }
    return req;
  }

  get(key) {
    const req = {};
    const idx = this._findIndex(key);
    if (idx < 0) { _firePromise(req, 'success', undefined); return req; }
    const rec = this._records[idx];
    // Out-of-line key store: caller stored arbitrary values. Return _value if present,
    // else the whole record. Keyed-store rows are returned directly.
    if (!this.keyPath && rec && Object.prototype.hasOwnProperty.call(rec, '_value')) {
      _firePromise(req, 'success', rec._value);
    } else {
      _firePromise(req, 'success', rec);
    }
    return req;
  }

  getAll() {
    const req = {};
    const out = this._records.map((r) => {
      if (!this.keyPath && r && Object.prototype.hasOwnProperty.call(r, '_value')) return r._value;
      return r;
    });
    _firePromise(req, 'success', out);
    return req;
  }

  delete(key) {
    const req = {};
    const idx = this._findIndex(key);
    if (idx >= 0) this._records.splice(idx, 1);
    _firePromise(req, 'success', undefined);
    return req;
  }

  clear() {
    const req = {};
    this._records = [];
    _firePromise(req, 'success', undefined);
    return req;
  }

  count() {
    const req = {};
    _firePromise(req, 'success', this._records.length);
    return req;
  }

  // Cursor: walks records sorted by insertion order. Supports .delete() and .continue().
  openCursor() {
    const req = { onsuccess: null, onerror: null };
    const records = this._records.slice();
    const indexer = records.map((r, i) => i); // indexes into this._records
    let pos = 0;
    const tick = () => {
      Promise.resolve().then(() => {
        if (pos >= indexer.length) {
          req.result = null;
          if (req.onsuccess) req.onsuccess({ target: req });
          return;
        }
        const recordRef = records[pos];
        const liveIdx = this._records.indexOf(recordRef);
        const cursor = {
          value: recordRef,
          delete: () => {
            if (liveIdx >= 0) this._records.splice(liveIdx, 1);
          },
          continue: () => { pos++; tick(); },
        };
        req.result = cursor;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
    };
    tick();
    return req;
  }
}

class MockDb {
  constructor() {
    this._stores = new Map();
    this.objectStoreNames = {
      contains: (name) => this._stores.has(name),
    };
  }
  createObjectStore(name, opts) {
    const s = new MockStore(name, opts);
    this._stores.set(name, s);
    return s;
  }
  transaction(storeNames /*, mode */) {
    return {
      objectStore: (name) => {
        const s = this._stores.get(name);
        if (!s) throw new Error(`MockDb: no such store ${name}`);
        return s;
      },
    };
  }
  close() {}
}

// Installs a mock indexedDB globally with the schema defined by the
// caller's onupgradeneeded. Returns the db so tests can seed it.
//
// version-bump semantics: if `existingDb` is provided, the next open() at
// the same or higher version reuses it (and fires onupgradeneeded if the
// requested version is higher).
export function installMockIDB(existingDb = null) {
  let db = existingDb || new MockDb();
  let currentVersion = existingDb ? existingDb._version || 1 : 0;

  global.indexedDB = {
    open: (name, version) => {
      const req = {};
      Promise.resolve().then(() => {
        if (currentVersion < (version || 1)) {
          // Upgrade
          if (req.onupgradeneeded) {
            req.result = db;
            req.onupgradeneeded({ target: req });
          }
          currentVersion = version || 1;
          db._version = currentVersion;
        }
        req.result = db;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    },
  };
  return db;
}

// Seed a key-value entry into an out-of-line store (the legacy 'h' store).
export function seedLegacyStore(db, storeName, key, value) {
  const s = db._stores.get(storeName) || db.createObjectStore(storeName);
  s.put(value, key);
}
