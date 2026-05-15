// In-app replacements for window.prompt / window.confirm / window.alert.
//
// Three custom elements (<app-prompt>, <app-confirm>, <app-toast>) plus thin
// async wrappers. The native dialogs are problematic for two reasons the
// spec calls out (PWA_LOCAL_STORAGE_GUIDE §5.6):
//   1. prompt() / confirm() / alert() are blocked or sandbox-restricted in
//      installed PWAs on some platforms;
//   2. they bypass any sanitization layer — anything passed in is treated
//      as plain text by the browser, but the message string itself could
//      have been constructed unsafely earlier in the call chain.
//
// Each element is shadow-DOM'd, lazily instantiated, and rendered via
// createElement + textContent — no innerHTML on user-provided strings.

// Gate class definitions on the browser environment. In Node tests the module
// is imported transitively (via synchronizations.js); HTMLElement is absent
// there, but tests don't actually invoke the dialogs.
const _hasDom = typeof HTMLElement !== 'undefined' && typeof customElements !== 'undefined';

const AppPrompt = _hasDom ? class extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._resolve = null;
    this._validator = null;
    this._buildDom();
  }

  _buildDom() {
    const style = document.createElement('style');
    style.textContent = baseStyle + `
      .panel { min-width: 320px; }
      input { width: 100%; padding: 8px; margin: 8px 0; border: 1px solid #d1d1d1;
              border-radius: 4px; box-sizing: border-box; font: inherit; }
      .err { color: #e74c3c; font-size: 0.9em; min-height: 1.2em; }
    `;

    const panel = document.createElement('div');
    panel.className = 'panel';

    const label = document.createElement('p');
    label.className = 'label';

    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;

    const err = document.createElement('div');
    err.className = 'err';

    const actions = buildActions(
      (cancelBtn) => cancelBtn.addEventListener('click', () => this._cancel()),
      (okBtn) => okBtn.addEventListener('click', () => this._submit()),
    );

    panel.append(label, input, err, actions);
    this._shadow.append(style, panel);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._submit();
      if (e.key === 'Escape') this._cancel();
    });
    input.addEventListener('input', () => this._validate());

    this._label = label;
    this._input = input;
    this._err = err;
  }

  open({ label = '', placeholder = '', initialValue = '', validator = null } = {}) {
    this._label.textContent = label;
    this._input.placeholder = placeholder;
    this._input.value = initialValue;
    this._err.textContent = '';
    this._validator = validator;
    this.setAttribute('open', '');
    // Focus on next microtask so the rendered <input> exists.
    Promise.resolve().then(() => this._input.focus());
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  _validate() {
    if (!this._validator) return true;
    try {
      this._validator(this._input.value);
      this._err.textContent = '';
      return true;
    } catch (e) {
      this._err.textContent = e.code || e.message || 'Invalid';
      return false;
    }
  }

  _submit() {
    if (!this._validate()) return;
    const v = this._input.value;
    this.removeAttribute('open');
    const r = this._resolve;
    this._resolve = null;
    if (r) r(v);
  }

  _cancel() {
    this.removeAttribute('open');
    const r = this._resolve;
    this._resolve = null;
    if (r) r(null);
  }
} : null;

const AppConfirm = _hasDom ? class extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._resolve = null;
    this._buildDom();
  }

  _buildDom() {
    const style = document.createElement('style');
    style.textContent = baseStyle + `
      .panel { min-width: 320px; max-width: 480px; }
      .msg { margin: 0 0 1rem 0; white-space: pre-wrap; }
      .actions button.danger { background: #e74c3c; }
      .actions button.danger:hover { background: #c0392b; }
    `;

    const panel = document.createElement('div');
    panel.className = 'panel';

    const msg = document.createElement('p');
    msg.className = 'msg';

    const actions = buildActions(
      (cancelBtn) => cancelBtn.addEventListener('click', () => this._respond(false)),
      (okBtn) => okBtn.addEventListener('click', () => this._respond(true)),
    );

    panel.append(msg, actions);
    this._shadow.append(style, panel);

    this._msg = msg;
    this._actions = actions;
  }

  open({ message = '', confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false } = {}) {
    this._msg.textContent = message;
    // Update button labels and danger styling.
    const [cancelBtn, okBtn] = this._actions.querySelectorAll('button');
    cancelBtn.textContent = cancelLabel;
    okBtn.textContent = confirmLabel;
    okBtn.classList.toggle('danger', !!danger);
    this.setAttribute('open', '');
    Promise.resolve().then(() => okBtn.focus());
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  _respond(value) {
    this.removeAttribute('open');
    const r = this._resolve;
    this._resolve = null;
    if (r) r(value);
  }
} : null;

const AppToast = _hasDom ? class extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._timer = null;
    this._buildDom();
  }

  _buildDom() {
    const style = document.createElement('style');
    style.textContent = `
      :host { display: none; position: fixed; bottom: 1.5rem; left: 50%;
              transform: translateX(-50%); z-index: 2000; }
      :host([open]) { display: block; }
      .toast { padding: 0.6rem 1rem; border-radius: 6px;
               box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 0.95rem;
               max-width: 80vw; word-wrap: break-word; }
      .toast.info    { background: #34495e; color: #fff; }
      .toast.success { background: #27ae60; color: #fff; }
      .toast.error   { background: #e74c3c; color: #fff; }
    `;
    const toast = document.createElement('div');
    toast.className = 'toast info';
    this._shadow.append(style, toast);
    this._toast = toast;
  }

  show({ message = '', kind = 'info', timeout = 3000 } = {}) {
    this._toast.textContent = message;
    this._toast.className = 'toast ' + (['info', 'success', 'error'].includes(kind) ? kind : 'info');
    this.setAttribute('open', '');
    if (this._timer) clearTimeout(this._timer);
    if (timeout > 0) {
      this._timer = setTimeout(() => this.removeAttribute('open'), timeout);
    }
  }
} : null;

// --- Shared style snippet for the modal-style dialogs (prompt + confirm) ---
const baseStyle = `
  :host { display: none; position: fixed; inset: 0;
          background: rgba(0,0,0,.4); align-items: center; justify-content: center;
          z-index: 1500; }
  :host([open]) { display: flex; }
  .panel { background: #fff; color: #34495e; padding: 1.2rem;
           border-radius: 8px; font-family: inherit; font-size: 1rem;
           box-shadow: 0 4px 24px rgba(0,0,0,0.2); }
  .label { margin: 0 0 0.4rem 0; }
  .actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem; }
  .actions button {
    padding: 0.5rem 1rem; border: 1px solid #BBB; border-radius: 4px;
    cursor: pointer; background: #3498db; color: #fff; font: inherit;
    font-size: 0.9rem; font-weight: 600;
  }
  .actions button:hover { background: #2980b9; }
  .actions button.secondary { background: #fff; color: #34495e; }
  .actions button.secondary:hover { background: #eaf2f8; }
`;

function buildActions(wireCancel, wireOk) {
  const actions = document.createElement('div');
  actions.className = 'actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'secondary';
  cancelBtn.textContent = 'Cancel';

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.textContent = 'OK';

  actions.append(cancelBtn, okBtn);
  wireCancel(cancelBtn);
  wireOk(okBtn);
  return actions;
}

// Register once. Idempotent — re-import in tests won't redefine. No-op when
// the DOM is absent (tests importing this module transitively).
function _registerOnce(name, Ctor) {
  if (!_hasDom || !Ctor) return;
  if (!customElements.get(name)) customElements.define(name, Ctor);
}
_registerOnce('app-prompt', AppPrompt);
_registerOnce('app-confirm', AppConfirm);
_registerOnce('app-toast', AppToast);

// Singleton instances — created lazily on first use, attached to <body>.
function _attach(tag, ref) {
  if (!_hasDom || typeof document === 'undefined' || !document.body) return null;
  if (ref.current) return ref.current;
  const el = document.createElement(tag);
  document.body.appendChild(el);
  ref.current = el;
  return el;
}

const _promptRef = { current: null };
const _confirmRef = { current: null };
const _toastRef = { current: null };

export function appPrompt(opts) {
  const el = _attach('app-prompt', _promptRef);
  if (!el) return Promise.resolve(null);
  return el.open(opts);
}

export function appConfirm(opts) {
  const el = _attach('app-confirm', _confirmRef);
  if (!el) return Promise.resolve(false);
  return el.open(opts);
}

export function appToast(opts) {
  const el = _attach('app-toast', _toastRef);
  if (!el) return;
  el.show(opts);
}
