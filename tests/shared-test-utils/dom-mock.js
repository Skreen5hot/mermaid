// Minimal in-memory DOM mock for unit/integration tests. Supports the subset
// of DOM that uiConcept and synchronizations exercise:
//   - document.getElementById / createElement / createTextNode
//   - element.appendChild / replaceChildren
//   - element.classList (add/remove/toggle/contains)
//   - element.dataset
//   - element.style.cssText / property setters
//   - element.addEventListener (with a _trigger helper for tests)
//   - DOMParser.parseFromString → returns an SVG-shaped document
//
// This is intentionally not jsdom — keeping it small and synchronous so the
// flushAllAsync pattern in our tests remains predictable.

export function createMockElement(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    value: '',
    innerHTML: '',
    textContent: '',
    className: '',
    selected: false,
    disabled: false,
    style: { cssText: '' },
    dataset: {},
    children: [],
    parentNode: null,
    listeners: {},
    namespaceURI: undefined,
    _isFocused: false,

    classList: {
      _classes: new Set(),
      add(...cs) { cs.forEach((c) => this._classes.add(c)); },
      remove(...cs) { cs.forEach((c) => this._classes.delete(c)); },
      toggle(c, force) {
        const has = this._classes.has(c);
        if (force === true || (force === undefined && !has)) this._classes.add(c);
        else if (force === false || (force === undefined && has)) this._classes.delete(c);
      },
      contains(c) { return this._classes.has(c); },
    },

    appendChild(child) {
      this.children.push(child);
      if (child && typeof child === 'object') child.parentNode = this;
      return child;
    },
    replaceChildren(...nodes) {
      this.children = nodes.filter(Boolean);
      this.children.forEach((c) => { if (c && typeof c === 'object') c.parentNode = this; });
    },

    addEventListener(event, callback) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(callback);
    },
    _trigger(event, eventData = {}) {
      (this.listeners[event] || []).forEach((cb) => cb({ target: this, ...eventData }));
    },

    focus() { this._isFocused = true; },
    querySelector() {
      return { classList: { remove: () => {}, add: () => {} } };
    },
  };
  return el;
}

// Walk a mock element's subtree gathering elements whose className matches
// a predicate. Useful for tests that need to find specific rendered nodes.
export function descendants(el, predicate) {
  const out = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) out.push(node);
    (node.children || []).forEach(walk);
  }
  walk(el);
  return out;
}

// Concatenate textContent across a subtree — handy when assertions used to
// check innerHTML for substring presence.
export function textOf(el) {
  if (!el) return '';
  if (el.children && el.children.length > 0) {
    return el.children.map(textOf).join('');
  }
  return el.textContent || '';
}

export function installDomMock(elementIds) {
  const mockElements = {};
  elementIds.forEach((id) => {
    mockElements[id] = createMockElement('div');
    mockElements[id].id = id;
  });

  global.document = {
    getElementById: (id) => mockElements[id] || null,
    createElement: (tag) => createMockElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text), parentNode: null }),
    addEventListener: () => {},
    removeEventListener: () => {},
    body: {
      style: {},
      userSelect: '',
      classList: {
        _classes: new Set(),
        toggle(c, force) {
          if (force) this._classes.add(c);
          else this._classes.delete(c);
        },
        contains(c) { return this._classes.has(c); },
      },
    },
  };

  global.DOMParser = class {
    parseFromString(/* str, type */) {
      const root = createMockElement('svg');
      root.namespaceURI = 'http://www.w3.org/2000/svg';
      return { documentElement: root };
    }
  };

  return mockElements;
}
