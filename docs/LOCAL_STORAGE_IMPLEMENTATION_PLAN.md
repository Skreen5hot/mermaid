# Local Storage Implementation Plan

Phased plan to fix the "lost diagrams on PC crash / OS update" problem by adding File System Access (FSA) backed storage **alongside** the existing IndexedDB (IDB) backend. Implements the pattern documented in [specifications/PWA_LOCAL_STORAGE_GUIDE.md](specifications/PWA_LOCAL_STORAGE_GUIDE.md).

## How to use this document

- Phases run in order. Phase 1 closes the data-loss bug; later phases harden and polish.
- Each task is a checkbox. Tick `- [x]` as it ships. Don't bulk-tick — tick when actually done with tests passing.
- Phase 1 is detailed task-by-task. Phases 2–4 are sketched; expand the active phase into the same level of detail when its predecessor is mostly green.
- **Status keys:** `[ ]` not started · `[x]` done · `[~]` in progress · `[!]` blocked / needs decision

---

## Decisions log

Locked-in calls. Do not re-litigate without recording a rationale.

| # | Decision | Rationale |
|---|---|---|
| D1 | Storage mode is **per-project**, chosen at "New Project" time. IDB and FSA are both first-class and supported indefinitely. | Some users prefer IDB and do not want to grant folder access. Others want disk durability. No forced choice. |
| D2 | **No auto-migration** from IDB to FSA on upgrade. | Existing IDB users see zero change until they explicitly opt to export. |
| D3 | **One** MermaidIDE root for all FSA projects (not one folder pick per project). | Matches spec; one permission flow; one audit log; simpler mental model. |
| D4 | Phase 2 is **one-way IDB → FSA** export only. | FSA → IDB not requested. |
| D5 | **Chromium-only for FSA**; IDB works in every browser. | `showDirectoryPicker` is Chromium-only. IDB-mode users don't need it. |
| D6 | **Audit log on disk from day one; no UI.** | Forensic value with no UI cost. Activity-log viewer reconsidered in Phase 4. |
| D7 | **Cloud-sync stance is neutral.** Inform, don't steer. | User is responsible for backup; we make it easier, not mandatory. |
| D8 | Branding constants: `APP_FOLDER = "MermaidIDE"`, `APP_ID = "mermaid-ide.v1"`, `APP_ID_HISTORY = new Set(["mermaid-ide.v1"])`, `DB_NAME = "MermaidIDE.handles"`. | Distinct from any template defaults; versioned for future bumps. |
| D9 | Capability module `src/storage/storage.js` is the **only** file that imports the FSA API. Concepts route through it. UI never sees a handle. | Spec §2: smallest possible attack surface. |
| D10 | Phase order: durability → export → hardening → PWA. | Closes the reported user pain first. |

---

## Architecture after Phase 1

```
src/
├── concepts/
│   ├── storageConcept.js        router; dispatches to idb or fsa backend
│   ├── projectConcept.js        unchanged logic; projectIds now "idb:<n>" / "fsa:<name>"
│   ├── diagramConcept.js        unchanged
│   └── uiConcept.js             +mode picker, +Reconnect banner, +foreign-folder modal
├── storage/
│   ├── storage.js               FSA capability module (spec §4.1–§4.9)
│   ├── sanitize.js              sanitizeName, splitPath, lockKey, guardPublicPath
│   └── idbBackend.js            extracted from today's storageConcept.js
└── ...
```

- Project list at render time = IDB-mode projects ∪ folder listing under MermaidIDE root.
- Project identifier: string `"idb:<n>"` or `"fsa:<foldername>"`. No parseInt.
- `FileSystemDirectoryHandle` is imported in exactly one file: `src/storage/storage.js`.
- No other concept files change their external event shape.

---

## Phase 1 — Add FSA-backed projects alongside IDB

**Goal:** A user can create a new project in either storage mode. Existing IDB users see no change. FSA projects round-trip through disk with atomic writes, Web Locks, sanitization, and audit logging.

### 1.1 Sanitization primitives — `src/storage/sanitize.js`

- [x] Implement `sanitizeName` (spec §4.3)
- [x] Implement `splitPath` (spec §4.3)
- [x] Implement `lockKey` (spec §4.3)
- [x] Implement `guardPublicPath` (spec §4.2)
- [x] Export `StorageError` class with `code` and `detail`
- [x] Pass Appendix C corpus for `sanitizeName`
- [x] Pass Appendix C corpus for `splitPath`
- [x] Pass Appendix C corpus for `lockKey`
- [x] Pass Appendix C corpus for `guardPublicPath`

### 1.2 Capability module — `src/storage/storage.js`

- [x] Branding constants block with MUST-CHANGE comments
- [x] Module-private state: `rootHandle`, `permissionState`, `listeners`, `foreignParent`
- [x] `init()` — restore handle, query permission, emit `permissionchange` unconditionally, non-blocking `maybeRotateAuditLog`
- [x] `pickRoot()` — clears `foreignParent` at top; returns `true` / `false` / `null`
- [x] `adoptOrCreate()` — four-case logic; raises `foreign_app_folder`
- [x] `adoptForeignFolder(true)` + `cancelForeignAdoption()`
- [x] `isAppRoot()`, `initAppMarker()`
- [x] `ensurePermission()` — translates `NotAllowedError`/`SecurityError` to `gesture_required`
- [x] `isReady()`, `hasRoot()`, `rootName()`
- [x] `detectPersistentPermissions()` (best-effort; returns false on any failure)
- [x] `writeBytesInternal` with temp+`move()` atomic path AND non-atomic copy+remove fallback
- [x] Public `writeBytes` calls `guardPublicPath` before any lock
- [x] `writeText` (UTF-8 encode → `writeBytes`)
- [x] `list` with `includeHidden`, NFC-normalized case-insensitive sort
- [x] `readBytes`, `readText` (strict UTF-8), `resolveDir`, `resolveParent`
- [x] `rename` leaf-only with dual-lock lexicographic order + non-atomic file fallback
- [x] `remove` with `recursive` option; translates `InvalidModificationError` → `not_empty`, `NotFoundError` → `source_not_found`
- [x] `mkdir`
- [x] `on(event, fn)` returning unsubscribe; `emit(event, payload)` swallows listener errors
- [x] `withLock(name, fn)` wrapping `navigator.locks.request` (with single-process Promise-chain fallback for tests)
- [x] Internal IDB shim: `openHandleDB`, `idbGet`, `idbPut` against `DB_NAME`
- [x] Audit: `audit(action, detail)` with canonical keys after spread; `AUDIT_LOCK = "write:.app/audit.log"`
- [x] `ensureAuditFile()` and `maybeRotateAuditLog()` exported on `Storage`
- [x] Audit constants: `AUDIT_MAX_BYTES = 8 * 1024 * 1024`, `AUDIT_KEEP_ROTATED = 8`
- [x] Public surface object exported as `Storage`; `StorageError` exported as named class

### 1.3 IDB backend extraction — `src/storage/idbBackend.js`

- [x] Move existing IDB code from `storageConcept.js` verbatim (no behavior change)
- [x] Keep existing IDB schema: `mermaid_viewer_db` v2 with `projects` and `diagrams` stores
- [x] Export: `open`, `listProjects`, `createProject`, `saveProject`, `deleteProject`, `saveDiagram`, `loadDiagram`, `listDiagrams`, `deleteDiagram`, `reset` (plus `isOpen` / `getConnectionPromise` helpers needed by listen())
- [x] All existing IDB-side tests still pass after extraction (zero test changes)

### 1.4 Router — `src/concepts/storageConcept.js`

- [x] Parse compound project ids `"idb:<n>"` and `"fsa:<name>"`; helpers in `src/storage/projectIds.js` (`parseStorageId`, `makeIdbProjectId`, `makeFsaProjectId`, `makeIdbDiagramId`, `makeFsaDiagramId`, `parseFsaDiagramKey`)
- [x] `do:open` opens IDB; if a stored FSA handle exists, `Storage.init()` runs (non-blocking on permission)
- [x] `do:listProjects` returns merged list: IDB projects (id = `"idb:<n>"`) ∪ FSA folder listing (id = `"fsa:<name>"`) when Storage is ready; FSA-empty fallback otherwise
- [x] `do:createProject` accepts `{name, mode}`; IDB path calls existing logic; FSA path calls `Storage.mkdir(name)` + writes seed `generic.mmd`
- [x] `do:deleteProject` routes by id prefix; FSA path calls `Storage.remove(name, {recursive: true})`
- [x] `do:saveDiagram` routes by current project mode; FSA path resolves to `<projectName>/<diagramName>.mmd` and calls `Storage.writeText` (handles rename by writing new path then removing old)
- [x] `do:loadDiagram` routes; FSA path reads file and returns synthetic `{id, name, content, projectId}` object so `diagramConcept` is unchanged
- [x] `do:listDiagrams` routes; FSA path lists `.mmd` files (skips dotfiles), strips extension for display
- [x] `do:deleteDiagram` routes; FSA path calls `Storage.remove`
- [x] All existing external events (`projectsListed`, `projectCreated`, `diagramSaved`, etc.) preserved exactly — only id values changed shape

### 1.5 UI changes — `src/concepts/uiConcept.js` + `index.html`

- [x] New-project modal: radio group "Browser storage" / "Folder on your computer" (replaces `prompt()`)
- [x] FSA radio disabled with tooltip when `typeof window.showDirectoryPicker !== "function"`
- [x] On choosing FSA: if `Storage.hasRoot()` is false, fire folder picker; `pickRoot` returning `false` → show foreign-folder modal; returning `null` → cancel cleanly
- [x] Reconnect banner element (hidden by default) — shown whenever `Storage.hasRoot() && !Storage.isReady()`; click calls `Storage.ensurePermission()` (slightly broader than the original "current project is FSA" gate, so users who had FSA projects can recover them)
- [x] Foreign-folder modal: "There's already a folder called MermaidIDE here" with "Nest" / "Pick different folder" buttons
- [x] `bus.notify('ui:newProjectClicked', { name, mode })` carries the chosen mode
- [ ] `_updateButtonStates` disables destructive ops when permission denied on an FSA project (deferred — the banner already gates the user, this is a stricter belt-and-braces; revisit if needed)
- [x] Sync info popover on first folder pick: short text, two-button "Sounds good / Pick different folder" — informational, not enforcing

### 1.6 Project concept tweaks — `src/concepts/projectConcept.js`

- [x] Project ids treated as opaque strings throughout (no `parseInt`)
- [x] `setCurrentProject({projectId})` accepts string id directly
- [x] `_setProjects` merge logic unchanged (equality remains string-based)
- [x] Default-project creation continues to hit IDB (matches existing behavior on a fresh install)
- [x] Bonus: `uiConcept` diagram-list click handler also stopped parsing `data-diagram-id` as integer (`src/concepts/uiConcept.js`)

### 1.7 Synchronizations tweaks — `src/synchronizations.js`

- [x] `ui:newProjectClicked` payload includes `mode`; orchestrates FSA pick flow (pickRoot → foreign-folder modal / sync-info modal) before delegating to `projectConcept.createProject`
- [x] `ui:downloadProjectClicked` works on both modes (FSA diagrams now eager-load `content` in `do:listDiagrams`, so the zip path uses the same `diagramConcept.state.diagrams` array)
- [x] `ui:uploadMmdClicked` routes writes through the router to the current project regardless of mode (already mode-agnostic via `do:saveDiagram` routing on `projectId` prefix)
- [x] Wire new events: `ui:reconnectClicked`, `ui:foreignFolderNest`, `ui:foreignFolderRepick`, `ui:syncInfoAcknowledged`, `ui:syncInfoRepick`

### 1.8 Boot & wire-up

- [x] `initializeApp()` calls `Storage.init()` after IDB open (via `_open()` in the router)
- [x] `Storage.on("permissionchange", …)` listener flips Reconnect banner state via `uiConcept`; on `granted`, also re-fires `loadProjects` so FSA folders re-appear
- [x] `window.concepts` and `window.Storage` exposed in `synchronizations.js` for console debugging

### 1.9 Documentation

- [x] Update [README.md](../README.md) Features section: describe two storage modes
- [x] Add "Storage modes" subsection to README explaining tradeoffs in plain English (one short paragraph each)
- [x] Update [testStrategy.md](../testStrategy.md) with FSA manual checklist (Section 5)
- [x] Append paragraph to [agenticDevlopment.md](../agenticDevlopment.md): "FSA storage is a *capability*, not a concept. Only `src/storage/storage.js` imports FSA. Concepts route through it. UI never receives a handle."

### 1.10 Acceptance criteria — functional

Status legend: `✅` user-verified in browser · `🧪` covered by automated tests · `🔲` still pending manual verification

- [x] ✅ Existing IDB user opens upgraded app → all projects/diagrams unchanged, zero prompts
- [x] ✅ New IDB project flow: name modal → IDB project created → default diagram seeded
- [x] ✅ New FSA project (first time): folder picker → `MermaidIDE/.app/version` written → `MermaidIDE/<NewName>/` created → seeded `generic.mmd`
- [x] ✅ New FSA project (Nth time): no picker; `mkdir` only — verifiable by creating a second FSA project after the first
- [x] ✅ Switching to an FSA project lists its `.mmd` files as diagrams (user saw two diagrams in sidebar)
- [x] 🧪 Editing a diagram in an FSA project writes via atomic temp+rename (covered by `tests/storage/storage.test.js`)
- [x] ✅ Killing the browser between `close()` and `move()` leaves the original file intact (no zero-length under real name) — manual chaos test
- [x] ✅ Deleting an FSA project removes the folder recursively after a confirm prompt
- [x] ✅ Renaming an FSA diagram uses `Storage.rename`; target-exists surfaces inline error
- [x] ✅ Two-tab same-file save: serialized via Web Locks; both succeed in order (router covered by `tests/storage/storage-concurrency.test.js`; full browser multi-tab still manual)
- [x] ✅ Foreign-folder confirmation modal appears when picking a folder that already contains an unrelated `MermaidIDE/`
- [x] ✅ Permission revoked mid-session: Reconnect banner appears; click → `ensurePermission` → success clears it
- [x] ✅ Re-pick the same folder after IDB wipe: existing root recognized via `.app/version`; no `MermaidIDE/MermaidIDE/` nesting
- [x] ✅ Non-Chromium browser: FSA radio disabled with tooltip; IDB still works fully
- [x] 🧪 `writeBytes(".app/audit.log", …)` throws `reserved_path`; `readText(".app/audit.log")` succeeds (covered by `tests/storage/storage.test.js`)
- [x] 🧪 Audit log records `init`, `mkdir`, `write`, `rename`, `remove` with `atomic: true|false`; rotates at 8 MB; oldest past 8 deleted (covered by `tests/storage/audit.test.js`)
- [x] 🧪 All existing concept tests still pass

### 1.11 Acceptance criteria — security & correctness

- [x] 🧪 Appendix C corpus passes (sanitizeName, splitPath, lockKey, guardPublicPath) — 68 cases
- [x] 🔍 `FileSystemDirectoryHandle` / `showDirectoryPicker` imported only in `src/storage/storage.js` (grep verified; the `uiConcept.js` line is a `typeof window.showDirectoryPicker === 'function'` feature-detect, not an API use)
- [x] 🔍 No `createWritable` calls outside `src/storage/` (grep verified)
- [x] 🔍 Every lock name comes from `lockKey()`; the one hand-built `'write:'` string is the documented `AUDIT_LOCK` constant in `storage.js`
- [x] 🧪 `pickRoot` returns `null` on AbortError, `false` on foreign_app_folder, `true` on success (covered by mock-fs tests for the latter two; AbortError path inspected by code review)
- [x] 🧪 `emit("permissionchange")` fires unconditionally on `ensurePermission()` (covered by `tests/storage/storage.test.js`)
- [ ] 🔲 `APP_ID_HISTORY` toggle test: future ID bump (with old ID kept in history) still recognizes existing installations — would require a dedicated test that monkey-patches `APP_ID_HISTORY`; deferred to whenever we bump APP_ID

### 1.12 Tests added

- [x] `tests/storage/sanitize.test.js` — Appendix C corpus (all rows)
- [x] `tests/storage/storage.test.js` — fake FSA backend (in-memory `MockDirectoryHandle`); full Storage lifecycle (pickRoot, foreign-folder, write/read roundtrip, rename, remove, list)
- [x] `tests/storage/storage-concurrency.test.js` — Web Lock serialization (two parallel writeText to same path; verify ordered)
- [x] `tests/storage/audit.test.js` — audit emission shape, rotation at threshold, retention sweep
- [ ] `tests/concepts/storageConcept.test.js` extended — router dispatches to correct backend based on project mode
- [ ] `tests/synchronizations.test.js` extended — new-project-with-mode flow, reconnect flow, foreign-folder flow
- [ ] [testStrategy.md](../testStrategy.md) manual checklist updated: multi-tab, permission revoke, browser kill mid-write, picker cancel, foreign folder, non-Chromium browser

### 1.13 Out of scope (Phase 1)

- CSP, Trusted Types, vendoring mermaid/jszip, in-app dialogs, service worker — Phase 3.
- Manual IDB → FSA migration UI — Phase 2.
- Activity-log UI — deferred (D6).
- `duplicate()` on FSA projects, cross-folder rename, drag-and-drop — not requested.
- "Change folder" UX after first pick — Phase 4 backlog.

---

## Phase 2 — Manual IDB → FSA export

**Goal:** An IDB project gets an "Export to folder…" action that creates a new FSA-mode project containing copies of all diagrams. The source IDB project is untouched.

- [x] "Export to folder…" action visible only on IDB projects (sidebar-footer button toggled via `setExportButtonVisible` on project change)
- [x] `do:exportProject({sourceProjectId, destName})` router action in `storageConcept.js` (lives at the router layer since it touches both backends)
- [x] Modal: source name + diagram count + destination input + confirm
- [x] Validate destination name doesn't collide with existing FSA folders (router-side via `Storage.list('')`)
- [x] Per-diagram `Storage.writeText` with `ifAbsent: true`; surface error on any failure
- [x] Audit emits one `mkdir` + N `write` entries on success (inherited from each Storage op)
- [x] Tests: happy path; name collision; non-IDB source; storage-not-ready (4 cases in `tests/concepts/storageConcept.test.js`)
- [x] Acceptance: source IDB project unmodified after export (verified by test); partial-write crash recoverable by re-export under a new name (each per-file write is atomic via temp+move; user can also delete the partial folder manually)
- [x] FSA-not-ready bootstrap: clicking Export with no folder picked chains transparently through `pickRoot` → foreign-folder modal → sync-info modal → export modal (via `_pendingExportInfo` in `synchronizations.js`)

---

## Phase 3 — Security hardening

**Goal:** Bring the app up to spec §3–§4.7 without changing the data model. Split into two slices: 3a is pure refactor (no user-visible change, still works without CSP); 3b is when the CSP "cage closes" and any unsafe site would throw.

### Phase 3a — Code reorganization + DOM refactor

- [x] Move both inline `<script type="module">` blocks from `index.html` into `src/main.js`
- [x] Refactor `innerHTML` sites in `uiConcept.js`:
  - [x] Project selector → `option` element construction via `replaceChildren`
  - [x] Diagram list → DOM construction via `_buildDiagramListItem` + `replaceChildren`
  - [x] Mermaid SVG → `_svgFromString` (DOMParser-and-adopt); shared by main view and thumbnails
  - [x] Error display → `<pre>` with `textContent` for the error message
- [x] Test mocks extended to support DOM construction (`tests/shared-test-utils/dom-mock.js` — shared between uiConcept and synchronizations tests; supports `createElement`, `replaceChildren`, `dataset`, `classList`, mock `DOMParser`)
- [x] `tests/concepts/uiConcept.test.js` assertion for `renderProjectSelector` rewritten to inspect children tree (option elements with correct `value`/`textContent`/`selected`)
- [x] `tests/synchronizations.test.js` "selector includes name" assertion uses new `textOf` helper that walks the children
- [x] All 11 test suites still pass

### Phase 3b — Vendoring + Trusted Types + CSP + in-app dialogs

- [x] Vendor `mermaid` and `jszip` under `vendor/` with pinned versions (`vendor/README.md` documents the versions: mermaid 11.15.0, jszip 3.10.1, plus refresh instructions)
- [x] `src/tt-policy.js` default Trusted Types policy installed; loaded as a non-module `<script>` BEFORE any module. **Pass-through with console warnings**, not throw — mermaid 11.x uses `innerHTML` internally to build its render wrapper, and throwing breaks every render. The policy is observational defense-in-depth (warnings let us audit sink usage over time); flip `THROW_ON_USE` to `true` for a strict pass. Spec §4.7's "Library policies" footnote calls out this exact situation.
- [x] Strict CSP `<meta>` tag in `index.html` per spec §4.7 (`default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `require-trusted-types-for 'script'`, `trusted-types default dompurify`). `dompurify` allowed because mermaid bundles DOMPurify, which installs its own named policy. `frame-ancestors` dropped from the meta version (Chromium ignores it in meta with a warning); it'd need an HTTP header for real enforcement.
- [x] `<app-prompt>` / `<app-confirm>` / `<app-toast>` custom elements in `src/components/dialogs.js`; helpers `appPrompt`/`appConfirm`/`appToast` exported as the call-site API
- [x] Replace every `prompt()` / `confirm()` / `alert()` call: 1 prompt (rename diagram), 2 confirms (delete project, delete diagram), 5 alerts (no-project errors, foreign-folder error, no-diagram-to-export, empty project, no-project-for-upload). All in `src/synchronizations.js`.
- [x] ✅ Acceptance: zero console CSP violations under full app exercise (verified after the `frame-ancestors` removal + `dompurify` allowlist fix)
- [x] ✅ Acceptance: Trusted Types policy installed and observing every HTML sink — verified by `[TT default] createHTML used at TrustedHTML — first occurrence this session` warning appearing once per session. Note: policy is **observational pass-through**, not strict throw — `document.body.innerHTML = '<b>x</b>'` succeeds with a warning rather than throwing, by design (see Phase 3b bugfix changelog entry).
- [x] Acceptance: Phase 1 + 2 + 3a tests still pass

---

## Inserted feature — Autosave

Out-of-band user request between Phase 3 and Phase 4. Reuses the previously-unwired theme-toggle slider in the header.

- [x] Toggle in header (relabeled from theme-toggle); persists `mermaidide.autoSave` in localStorage
- [x] Idle-based debounce: saves 5s after the user stops typing
- [x] Only autosaves saved diagrams (id ≠ null); unsaved diagrams still need a one-time manual Save for the name
- [x] In-flight typing preserved: if the user keeps typing while a save is in flight, the saved-version content does not clobber state.currentDiagram.content; `isDirty` is re-evaluated by content comparison
- [x] New event `diagramAfterSave` separates save-of-current (no editor/mermaid re-render) from save-of-different-diagram (full render via `diagramContentLoaded`)
- [x] Tests: 8 new cases in `tests/concepts/diagramConcept.test.js` covering persistence, schedule/cancel, unsaved skip, switch-cancel, and the in-flight-typing race
- [ ] Manual verification in browser pending

## Phase 4 — PWA conversion (sketch, optional)

**Goal:** Installable PWA with offline app shell.

- [ ] `manifest.webmanifest` with icons, name, scope, start_url
- [ ] `service-worker.js` per spec §4.6 (same-origin precache, stale-while-revalidate, offline fallback)
- [ ] Persistent-permissions detection wired to Reconnect banner ("remembered for this site" label)
- [ ] Reconsider Settings → Activity log viewer (D6 revisit)
- [ ] "Change folder…" action that re-runs `pickRoot`
- [ ] Acceptance: installable in Chrome/Edge; cold load works offline after first online load; no cross-origin caching

---

## Open questions / followups

- [ ] **APP_ID bump discipline.** When `APP_ID` is bumped, *append* the new ID to `APP_ID_HISTORY`; never replace. Capture as a comment in `storage.js` and a CONTRIBUTING note.
- [ ] **Sync question copy.** Phase 1 ships a neutral info popover. Revisit wording after first round of user feedback.
- [ ] **Existing typo'd doc filenames.** `agenticDevlopment.md`, `securityStratagy.md` — fix at a quiet moment; not blocking.

---

## Change log for this document

- 2026-05-14 — Initial plan written after spec review and Q&A round.
- 2026-05-14 — Phase 1.1 (sanitization primitives) complete. New files: `src/storage/sanitize.js`, `src/storage/StorageError.js`, `tests/storage/sanitize.test.js`. `src/assert.js` extended with `throws` and `deepEqual`. 68 corpus cases pass.
- 2026-05-14 — Phase 1.2 (capability module) complete. New files: `src/storage/storage.js` (capability module per spec §4.1–§4.9, minus `duplicate` per OOS), `tests/storage/mock-fs.js` (in-memory FSA mock), `tests/storage/storage.test.js` (33 cases), `tests/storage/storage-concurrency.test.js` (4 cases), `tests/storage/audit.test.js` (5 cases). `tests/test-helpers.js` rewritten to chain tests onto a per-file promise queue so async test bodies serialize. `src/synchronizations.js` now exposes `window.Storage` for hand-testing (full `Storage.init()` wire-up is task 1.8).
- 2026-05-14 — Phase 1.3 (IDB backend extraction) complete. New file: `src/storage/idbBackend.js` (factory-pattern: `createIdbBackend(bus)` returns CRUD methods with the bus closed over). `src/concepts/storageConcept.js` rewritten as a thin delegator. Behavior preserved exactly: every existing test passes without modification.
- 2026-05-14 — Phase 1.4 + 1.6 (router + concept tweaks) complete. New file: `src/storage/projectIds.js` (compound id helpers). `src/storage/idbBackend.js` refactored to a pure promise-returning data layer (no bus parameter; the router translates results into events). `src/concepts/storageConcept.js` is now the router — dispatches by compound id prefix to IDB or FSA. `src/concepts/projectConcept.js` no longer parses ids as integers. `src/concepts/uiConcept.js` diagram-list click handler stopped parsing `data-diagram-id`. Tests updated: `tests/concepts/storageConcept.test.js` rewritten (6 router cases) and `tests/synchronizations.test.js` re-targeted at compound ids — both use a new `flushAllAsync()` helper that loops flush + microtask drain to drive promise-based chains.
- 2026-05-15 — Phase 1.5 + 1.7 + 1.8 (UI + synchronizations + boot) complete. `index.html` gains 3 modals (New Project with IDB/FSA mode picker, Foreign-Folder confirmation, Sync-Info popover) and a Reconnect banner. `styles/style.css` adds banner + mode-picker styling. `src/concepts/uiConcept.js` replaces `prompt('Enter new project name')` with the modal, adds show/hide functions for the new surfaces, and emits new UI events. `src/concepts/projectConcept.js` `createProject` passes `mode` through. `src/synchronizations.js` orchestrates the full FSA pick flow: pickRoot → (true) sync-info → create / (false) foreign-folder → nest+sync-info → create / (null) cancel; reconnect via `ensurePermission`; on permission grant, auto-reload project list so FSA folders appear. Router's `do:listDiagrams` eager-loads FSA file contents so thumbnails and zip download work uniformly. FSA radio is disabled with tooltip on non-Chromium. All 11 test suites still green.
- 2026-05-15 — Bugfix from first browser run: thumbnails failed and `<main>` shrank to 368px because `_renderSingleThumbnail` passed compound diagram ids (containing `:` and `/`) directly into `mermaid.render`, which uses them as CSS selectors. Mermaid leaked wrapper divs into `<body>` on each failed render (~150px each by default browser SVG sizing), crunching `main` via the flex column. Fix: added `_safeIdForMermaid` helper that maps non-`[A-Za-z0-9_-]` characters to `_` before passing the id to `mermaid.render`. `src/concepts/uiConcept.js` only.
- 2026-05-15 — Phase 1.9 (documentation) complete. `README.md` Features section rewritten with "Storage modes — which to pick" subsection. `testStrategy.md` gets a new Section 5 ("FSA Storage: Manual Browser Checklist") covering first-run, subsequent, foreign-folder, external edits, permission lifecycle, multi-tab, non-Chromium, audit log, and console probes. `agenticDevlopment.md` gets an addendum reminding AI generators that FSA is a capability, not a concept, and only `src/storage/storage.js` imports the FSA API. Acceptance criteria 1.10 and 1.11 reviewed: every item covered by automated tests or grep is ticked; items requiring manual browser verification are explicitly marked `🔲` for the user to walk through.
- 2026-05-15 — User completed manual checklist for Phase 1.10/1.11. All `🔲` items now `✅` except the `APP_ID_HISTORY` toggle test, which is deferred to whenever we actually bump APP_ID (it'd require monkey-patching the constant to fake a version transition). Phase 1 is closed.
- 2026-05-15 — Save-on-switch bugfix. Triage of a regression report ("modified a diagram, switched to another within 5s, edits lost on return") revealed that this loss-on-switch was actually pre-existing behavior — the old code silently dropped in-memory edits when `_handleDiagramLoaded` replaced `state.currentDiagram`. The new autosave feature made the bug observable by creating an expectation that the app "remembers what I'm working on". Fix: `_setCurrentDiagram` now fires `do:saveDiagram` for the currently-open diagram if it's dirty (and has an id) before firing `do:loadDiagram` for the new one. To avoid the save-on-switch race clobbering the new selection on completion, the `do:saveDiagram` payload gained a `becomeCurrent` flag (set `true` only by the New Diagram creation flow); `_handleDiagramSaved` only replaces `state.currentDiagram` when `sameAsCurrent` or `becomeCurrent`. The router (`_saveDiagram`) passes the flag through. Synchronizations also flush `uiConcept.getEditorContent()` into state on `ui:diagramSelected` so the 300ms input-debounce can't lose the last keystrokes before the switch. 3 new tests in `tests/concepts/diagramConcept.test.js` (suite goes 14 → 17). All 11 suites green.
- 2026-05-15 — Autosave inserted between Phase 3 and Phase 4 (user request). Reuses the previously-unwired theme-toggle slider as the autosave switch. `src/concepts/diagramConcept.js` gains `state.autoSaveEnabled` (persisted in `localStorage` under `mermaidide.autoSave`), an `isDirty` flag on `currentDiagram`, and a module-private 5-second idle timer. `_handleDiagramSaved` rewritten to distinguish "save of current diagram" (preserve in-memory typing, lightweight `diagramAfterSave` event, no editor/mermaid re-render) from "save of a different diagram" (full `diagramContentLoaded`). `src/concepts/uiConcept.js` caches `autosave-toggle`, wires its `change` event to emit `ui:autoSaveToggled`, and exposes `setAutoSaveToggle` so the sync layer can sync the checkbox on boot. `src/synchronizations.js` forwards `ui:autoSaveToggled` → `setAutoSave` and routes `diagramAfterSave` to file-info + button-state updates. `index.html` relabels the header container; `styles/style.css` renames `.theme-switch-container` → `.autosave-container` with a `gap` for the label. 8 new tests in `tests/concepts/diagramConcept.test.js` (suite goes 6 → 14). All 11 suites green.
- 2026-05-15 — Phase 3b CSP refinement after second browser run: (1) removed `frame-ancestors 'none'` from the meta CSP — Chromium ignores it in meta and now warns about the ignore. The directive needs an HTTP header to actually enforce. (2) Added `dompurify` to the `trusted-types` allowlist — mermaid 11.x bundles DOMPurify, which installs its own named TT policy; without the allowlist entry, the policy-creation was blocked and DOMPurify fell back through our pass-through default. Console clean of those two warnings now.
- 2026-05-15 — Phase 3b bugfix: first browser test under the new CSP revealed mermaid 11.15.0 uses `innerHTML` internally when building its temp render wrapper. The strict `throw`-on-every-sink default Trusted Types policy broke every mermaid render and leaked the temp `<div id="dthumbnail-...">` wrappers into `<body>` (because mermaid's cleanup never ran after the throw), crunching `<main>` via the flex column. Fix: `src/tt-policy.js` rewritten to **pass-through with `console.warn`** instead of throwing. The other CSP directives (`script-src 'self'`, `style-src`, `connect-src`, etc.) remain strict — the only protection that's degraded is the TT same-origin-string-to-DOM defense. Flip `THROW_ON_USE` to `true` in `tt-policy.js` for a hardening audit run.
- 2026-05-15 — Phase 3b (vendoring + Trusted Types + CSP + in-app dialogs) complete. New `vendor/` directory with `mermaid.min.js` (v11.15.0) and `jszip.min.js` (3.10.1) — `index.html` now loads both from same-origin. New `src/tt-policy.js` installs the default Trusted Types policy that throws on every HTML/script sink; loaded as a non-module `<script>` so it runs before any module. New `src/components/dialogs.js` defines `<app-prompt>` / `<app-confirm>` / `<app-toast>` custom elements (shadow-DOM, lazily instantiated, all text via textContent) plus the `appPrompt`/`appConfirm`/`appToast` helper functions; gated on a `_hasDom` check so importing the module in Node tests doesn't crash on the missing `HTMLElement`. `src/synchronizations.js` replaces 1 `prompt()`, 2 `confirm()`, and 5 `alert()` calls with the new helpers. Strict CSP `<meta>` tag added to `<head>` per spec §4.7 (`default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `require-trusted-types-for 'script'`, `trusted-types default`). All 11 test suites still green.
- 2026-05-15 — Phase 3a (code reorganization + DOM refactor) complete. New `src/main.js` consolidates the two inline `<script type="module">` blocks that were embedded in `index.html`; both inline scripts removed. `src/concepts/uiConcept.js` has zero `innerHTML = ...` writes left — every render path goes through `document.createElement` + `replaceChildren`, with `_svgFromString` (DOMParser-and-adopt) handling Mermaid SVG. New `tests/shared-test-utils/dom-mock.js` provides a small in-memory DOM mock used by both `tests/concepts/uiConcept.test.js` and `tests/synchronizations.test.js`; existing assertions updated to walk the children tree via a `textOf` helper. All 11 test suites still green. CSP not enabled yet — that's Phase 3b.
- 2026-05-15 — Phase 2 (IDB → FSA export) complete. New router action `do:exportProject` in `src/concepts/storageConcept.js` reads source diagrams from IDB, validates dest-name doesn't collide, `mkdir`s the new FSA folder, and writes each diagram via `Storage.writeText({ifAbsent:true})`. Emits `projectCreated` for the new FSA copy; source IDB project never modified. Test suite gains 4 cases covering happy path, dest-name collision, non-IDB-source rejection, and storage-not-ready rejection. UI: new "Export to folder…" button in sidebar-footer (visible only when current project is IDB), export modal with source name + diagram count + dest-name input, transparent bootstrap through `pickRoot`/foreign-folder/sync-info if FSA isn't set up yet (tracked via `_pendingExportInfo` in `synchronizations.js`). All 11 test suites green.
