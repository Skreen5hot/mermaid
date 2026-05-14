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

- [ ] Implement `sanitizeName` (spec §4.3)
- [ ] Implement `splitPath` (spec §4.3)
- [ ] Implement `lockKey` (spec §4.3)
- [ ] Implement `guardPublicPath` (spec §4.2)
- [ ] Export `StorageError` class with `code` and `detail`
- [ ] Pass Appendix C corpus for `sanitizeName`
- [ ] Pass Appendix C corpus for `splitPath`
- [ ] Pass Appendix C corpus for `lockKey`
- [ ] Pass Appendix C corpus for `guardPublicPath`

### 1.2 Capability module — `src/storage/storage.js`

- [ ] Branding constants block with MUST-CHANGE comments
- [ ] Module-private state: `rootHandle`, `permissionState`, `listeners`, `foreignParent`
- [ ] `init()` — restore handle, query permission, emit `permissionchange` unconditionally, non-blocking `maybeRotateAuditLog`
- [ ] `pickRoot()` — clears `foreignParent` at top; returns `true` / `false` / `null`
- [ ] `adoptOrCreate()` — four-case logic; raises `foreign_app_folder`
- [ ] `adoptForeignFolder(true)` + `cancelForeignAdoption()`
- [ ] `isAppRoot()`, `initAppMarker()`
- [ ] `ensurePermission()` — translates `NotAllowedError`/`SecurityError` to `gesture_required`
- [ ] `isReady()`, `hasRoot()`, `rootName()`
- [ ] `detectPersistentPermissions()` (best-effort; returns false on any failure)
- [ ] `writeBytesInternal` with temp+`move()` atomic path AND non-atomic copy+remove fallback
- [ ] Public `writeBytes` calls `guardPublicPath` before any lock
- [ ] `writeText` (UTF-8 encode → `writeBytes`)
- [ ] `list` with `includeHidden`, NFC-normalized case-insensitive sort
- [ ] `readBytes`, `readText` (strict UTF-8), `resolveDir`, `resolveParent`
- [ ] `rename` leaf-only with dual-lock lexicographic order + non-atomic file fallback
- [ ] `remove` with `recursive` option; translates `InvalidModificationError` → `not_empty`, `NotFoundError` → `source_not_found`
- [ ] `mkdir`
- [ ] `on(event, fn)` returning unsubscribe; `emit(event, payload)` swallows listener errors
- [ ] `withLock(name, fn)` wrapping `navigator.locks.request`
- [ ] Internal IDB shim: `openHandleDB`, `idbGet`, `idbPut` against `DB_NAME`
- [ ] Audit: `audit(action, detail)` with canonical keys after spread; `AUDIT_LOCK = "write:.app/audit.log"`
- [ ] `ensureAuditFile()` and `maybeRotateAuditLog()` exported on `Storage`
- [ ] Audit constants: `AUDIT_MAX_BYTES = 8 * 1024 * 1024`, `AUDIT_KEEP_ROTATED = 8`
- [ ] Public surface object exported as `Storage`; `StorageError` exported as named class

### 1.3 IDB backend extraction — `src/storage/idbBackend.js`

- [ ] Move existing IDB code from `storageConcept.js` verbatim (no behavior change)
- [ ] Keep existing IDB schema: `mermaid_viewer_db` v2 with `projects` and `diagrams` stores
- [ ] Export: `open`, `listProjects`, `createProject`, `saveProject`, `deleteProject`, `saveDiagram`, `loadDiagram`, `listDiagrams`, `deleteDiagram`, `reset`
- [ ] All existing IDB-side tests still pass after extraction

### 1.4 Router — `src/concepts/storageConcept.js`

- [ ] Parse compound project ids `"idb:<n>"` and `"fsa:<name>"`; helper `parseProjectId(id)`
- [ ] `do:open` opens IDB; if a stored FSA handle exists, `Storage.init()` runs (non-blocking on permission)
- [ ] `do:listProjects` returns merged list: IDB projects (id = `"idb:<n>"`) ∪ FSA folder listing (id = `"fsa:<name>"`)
- [ ] `do:createProject` accepts `{name, mode}`; IDB path calls existing logic; FSA path calls `Storage.mkdir(name)` + writes seed `generic.mmd`
- [ ] `do:deleteProject` routes by id prefix; FSA path calls `Storage.remove(name, {recursive: true})`
- [ ] `do:saveDiagram` routes by current project mode; FSA path resolves to `<projectName>/<diagramName>.mmd` and calls `Storage.writeText`
- [ ] `do:loadDiagram` routes; FSA path reads file and returns synthetic `{id, name, content, projectId}` object so `diagramConcept` is unchanged
- [ ] `do:listDiagrams` routes; FSA path lists `.mmd` files (skips dotfiles), strips extension for display
- [ ] `do:deleteDiagram` routes; FSA path calls `Storage.remove`
- [ ] All existing external events (`projectsListed`, `projectCreated`, `diagramSaved`, etc.) preserved exactly

### 1.5 UI changes — `src/concepts/uiConcept.js` + `index.html`

- [ ] New-project modal: add radio group "Browser storage (works everywhere)" / "Folder on your computer (Chromium only)"
- [ ] FSA radio disabled with tooltip when `typeof window.showDirectoryPicker !== "function"`
- [ ] On choosing FSA: if `Storage.hasRoot()` is false, fire folder picker; handle `pickRoot` returning `false` → show foreign-folder modal; returning `null` → cancel cleanly
- [ ] Reconnect banner element (hidden by default) — shown when current project is FSA AND `Storage.isReady()` is false; click calls `Storage.ensurePermission()`
- [ ] Foreign-folder modal: "There's already a folder called MermaidIDE here" with "Nest" / "Pick different folder" buttons
- [ ] `bus.notify('ui:newProjectClicked', { name, mode })` carries the chosen mode
- [ ] `_updateButtonStates` disables destructive ops when permission denied on an FSA project
- [ ] Sync info popover on first folder pick: short text, two-button "Sounds good / Pick different folder" — informational, not enforcing

### 1.6 Project concept tweaks — `src/concepts/projectConcept.js`

- [ ] Project ids treated as opaque strings throughout (no `parseInt`)
- [ ] `setCurrentProject({projectId})` accepts string id directly
- [ ] `_setProjects` merge logic unchanged (equality remains string-based)
- [ ] Default-project creation continues to hit IDB (matches existing behavior on a fresh install)

### 1.7 Synchronizations tweaks — `src/synchronizations.js`

- [ ] `ui:newProjectClicked` payload includes `mode`; pass through to `createProject`
- [ ] `ui:downloadProjectClicked` works on both modes (FSA path reads via `Storage.readText`)
- [ ] `ui:uploadMmdClicked` routes writes through the router to the current project regardless of mode
- [ ] Wire new events: `permissionchange`, foreign-folder confirm/cancel, reconnect click

### 1.8 Boot & wire-up

- [ ] `initializeApp()` calls `Storage.init()` after IDB open
- [ ] `Storage.on("permissionchange", …)` listener flips Reconnect banner state via `uiConcept`
- [ ] Confirm `window.concepts` debug export still works (handy in browser console)

### 1.9 Documentation

- [ ] Update [README.md](../README.md) Features section: describe two storage modes
- [ ] Add "Storage modes" subsection to README explaining tradeoffs in plain English (one short paragraph each)
- [ ] Update [testStrategy.md](../testStrategy.md) with FSA manual checklist
- [ ] Append paragraph to [agenticDevlopment.md](../agenticDevlopment.md): "FSA storage is a *capability*, not a concept. Only `src/storage/storage.js` imports FSA. Concepts route through it. UI never receives a handle."

### 1.10 Acceptance criteria — functional

- [ ] Existing IDB user opens upgraded app → all projects/diagrams unchanged, zero prompts
- [ ] New IDB project flow: name modal → IDB project created → default diagram seeded
- [ ] New FSA project (first time): folder picker → `MermaidIDE/.app/version` written → `MermaidIDE/<NewName>/` created → seeded `generic.mmd`
- [ ] New FSA project (Nth time): no picker; `mkdir` only
- [ ] Switching to an FSA project lists its `.mmd` files as diagrams
- [ ] Editing a diagram in an FSA project writes via atomic temp+rename
- [ ] Killing the browser between `close()` and `move()` leaves the original file intact (no zero-length under real name)
- [ ] Deleting an FSA project removes the folder recursively after a confirm prompt
- [ ] Renaming an FSA diagram uses `Storage.rename`; target-exists surfaces inline error
- [ ] Two-tab same-file save: serialized via Web Locks; both succeed in order
- [ ] Foreign-folder confirmation modal appears when picking a folder that already contains an unrelated `MermaidIDE/`
- [ ] Permission revoked mid-session: Reconnect banner appears; click → `ensurePermission` → success clears it
- [ ] Re-pick the same folder after IDB wipe: existing root recognized via `.app/version`; no `MermaidIDE/MermaidIDE/` nesting
- [ ] Non-Chromium browser: FSA radio disabled with tooltip; IDB still works fully
- [ ] `writeBytes(".app/audit.log", …)` throws `reserved_path`; `readText(".app/audit.log")` succeeds
- [ ] Audit log records `init`, `mkdir`, `write`, `rename`, `remove` with `atomic: true|false`; rotates at 8 MB; oldest past 8 deleted
- [ ] All existing concept tests still pass

### 1.11 Acceptance criteria — security & correctness

- [ ] Appendix C corpus passes (sanitizeName, splitPath, lockKey, guardPublicPath)
- [ ] `FileSystemDirectoryHandle` imported only in `src/storage/storage.js` (CI grep check)
- [ ] No `createWritable` calls outside `src/storage/` (CI grep check)
- [ ] Every lock name comes from `lockKey()` (no hand-built `write:…` strings outside `storage.js`)
- [ ] `pickRoot` returns `null` on AbortError, `false` on foreign_app_folder, `true` on success
- [ ] `emit("permissionchange")` fires unconditionally on both `init()` and `ensurePermission()`
- [ ] `APP_ID_HISTORY` is a Set; toggle test confirms a future ID bump (with old ID kept in history) still recognizes existing installations

### 1.12 Tests added

- [ ] `tests/storage/sanitize.test.js` — Appendix C corpus (all rows)
- [ ] `tests/storage/storage.test.js` — fake FSA backend (in-memory `MockDirectoryHandle`); full Storage lifecycle (pickRoot, foreign-folder, write/read roundtrip, rename, remove, list)
- [ ] `tests/storage/storage-concurrency.test.js` — Web Lock serialization (two parallel writeText to same path; verify ordered)
- [ ] `tests/storage/audit.test.js` — audit emission shape, rotation at threshold, retention sweep
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

## Phase 2 — Manual IDB → FSA export (sketch)

**Goal:** An IDB project gets an "Export to folder…" action that creates a new FSA-mode project containing copies of all diagrams. The source IDB project is untouched.

- [ ] "Export to folder…" action visible only on IDB projects
- [ ] `exportToFolder({sourceProjectId, destName?})` in `projectConcept`
- [ ] Modal: source name + diagram count + destination input + confirm
- [ ] Validate destination name doesn't collide with existing FSA folders
- [ ] Per-diagram `Storage.writeText` with `ifAbsent: true`; surface error on any failure
- [ ] Audit emits one `mkdir` + N `write` entries on success
- [ ] Tests: happy path; name collision; partial failure leaves partial files cleanly (each individual write is atomic)
- [ ] Acceptance: source IDB project unmodified after export; partial-write crash recoverable by re-export under a new name

---

## Phase 3 — Security hardening (sketch)

**Goal:** Bring the app up to spec §3–§4.7 without changing the data model.

- [ ] Vendor `mermaid` and `jszip` under `vendor/` with pinned versions and a script to refresh + verify checksums
- [ ] Strict CSP `<meta>` tag in `index.html` per spec §4.7
- [ ] `scripts/tt-policy.js` default Trusted Types policy that throws on createHTML/createScript/createScriptURL
- [ ] Move both inline `<script type="module">` blocks from `index.html` into `src/main.js`
- [ ] Refactor `innerHTML` sites in `uiConcept.js`:
  - [ ] Project selector → `option` element construction
  - [ ] Diagram list → DOM construction
  - [ ] Mermaid SVG → DOMParser-and-adopt (avoid named TT policy)
  - [ ] Error display → escaped `textContent` on child node
- [ ] `<app-prompt>` / `<app-confirm>` / `<app-toast>` custom elements
- [ ] Replace every `prompt()` / `confirm()` / `alert()` call
- [ ] Acceptance: zero console CSP violations under full app exercise; Trusted Types proven enforced; Phase 1 + 2 tests still pass

---

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
