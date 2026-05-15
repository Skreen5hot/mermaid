# Simplified Test Strategy: Process-Isolated Testing

## 1. What: The Core Idea

Our previous testing strategy suffered from state pollution, where tests interfered with one another, leading to flaky results and complex reset logic. This new strategy abandons the shared-process model in favor of **process-level isolation**.

The core idea is simple and powerful: **Every single `*.test.js` file is executed in its own, separate Node.js process.**

This approach provides the ultimate test isolation. Since no memory or state is shared between test files, it is impossible for one test file to "contaminate" another. This eliminates the need for manual `reset()` functions on concepts and complex `beforeEach` hooks for cleanup between files.

## 2. How: The Implementation

The new infrastructure is even simpler than before and consists of two key parts.

### a. `run-tests.js` (The Test Runner)

This is the sole entry point for running the entire test suite. It has one job: find all test files and run each one in a dedicated child process.

-   **Discovery**: It uses Node.js's `fs` module to recursively find all files ending in `.test.js` within the `tests/` directory.
-   **Execution**: For each test file found, it spawns a new `node` child process using `child_process.spawn`.
-   **Reporting**:
    -   It captures the `stdout` and `stderr` from the child process and streams it directly to the console, so you see the output from `describe` and `it` blocks in real-time.
    -   It monitors the exit code of the child process. An exit code of `0` signifies that all tests in the file passed. A non-zero exit code signifies a failure.
-   **Summary**: After all files have been run, it prints a final summary of which files passed and which failed.
-   **CI/CD Integration**: If any test file fails (exits with a non-zero code), the main `run-tests.js` script will exit with `process.exit(1)`, ensuring that CI pipelines correctly detect the failure.

### b. `*.test.js` (The Tests)

Test files are now completely self-contained. They no longer depend on a global runner or implicit setup.

-   **Setup**: Each test file is responsible for its own setup. This includes importing an `assert` utility and the concepts it needs to test.
-   **Structure**: The familiar `describe` and `it` syntax can still be used for organizational purposes, but they can be implemented as simple functions that just print to the console.
-   **Failure Handling**: The key change is how failures are handled. Inside an `it` block, if an assertion fails, the error is caught, a "FAIL" message is logged, and the process is terminated immediately with `process.exit(1)`. This is the signal to the `run-tests.js` parent process that this test file has failed.

Here is a conceptual example of a simple `it` function:

```javascript
// Inside a test file or a shared 'test-utils.js'
export function it(name, testFn) {
  try {
    testFn();
    console.log(`  ✓ PASS: ${name}`);
  } catch (error) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(error);
    process.exit(1); // <-- Critical for signaling failure
  }
}
```

## 3. Why: The Rationale

This process-isolated approach directly addresses the failures of the previous strategy.

-   **Guaranteed Isolation**: By using separate processes, we eliminate all forms of test pollution between files—no more shared global state, no more singleton instances carrying state from one test to the next. Tests are stable and predictable.

-   **Radical Simplicity**: The need for complex `reset()` logic on our concepts is completely gone. The `run-tests.js` file, which implicitly coupled all tests together, is also eliminated. The test runner becomes a simple process manager, and test files become simple, standalone scripts.

-   **Zero Dependencies**: This strategy maintains our goal of a zero-dependency testing framework. It uses only built-in Node.js modules (`fs`, `path`, `child_process`).

-   **Maintainability**: When a test fails, it is contained to its own process. Debugging is easier because you can run the failing file directly (`node tests/concepts/my-failing.test.js`) and know that no other file is influencing its environment.

## 4. Handling Mocks and the DOM

The challenge of mocking browser-specific APIs like `document` and `localStorage` in a Node.js environment remains. However, the new strategy simplifies how we manage them.

-   **Local Mocks**: Instead of a single, massive `setupMockDOM()` function that pollutes the global scope for all tests, each test file that needs a DOM will be responsible for setting up its own mock environment.
-   **Shared Mock Utilities**: Common mocking logic (like creating a mock element) can be placed in a shared utility file (e.g., `tests/test-utils.js`) and imported by the test files that need it.

This ensures that a test file only creates the mocks it explicitly needs, and those mocks are automatically destroyed when the process exits, leaving a clean slate for the next test file.

This revised strategy provides a much more resilient and scalable foundation for testing, ensuring our tests remain a reliable asset rather than a source of maintenance headaches.

## 5. Lessons Learned: Taming State and Asynchronicity

While the process-isolated strategy provides a robust foundation, our experience with implementing the test suite revealed critical patterns necessary for writing stable tests, especially for stateful, asynchronous modules like `storageConcept`.

### The Singleton Challenge

Process isolation prevents state from leaking between test *files*. However, it does not prevent state from leaking between `it` blocks *within the same file*. Since our concepts are implemented as singletons, importing `storageConcept` once means the same instance (and its state, like an open database connection) is shared across all tests in that file.

### The Golden Rule: Isolate Every `it` Block

The solution to singleton state pollution is a strict and non-negotiable pattern: **a setup/reset function must be called at the beginning of every single `it` block.**

```javascript
// GOOD: Guarantees a clean slate for every test.
it('should do something', () => {
  beforeEach(); // Reset state at the start of the test.
  // ... test logic
});
```

This ensures that no residual state from a previous test can cause a subsequent test to fail, which was the root cause of the instability we saw with the `storageConcept` tests.

### The Integration Mocking Trap

Mocks for unit tests can be simple, but mocks for integration tests must be much more complete. Our `synchronizations.test.js` file required a mock `IndexedDB` that supported `index()` and `put()` methods, whereas the simpler unit tests did not. This is because integration tests exercise deeper and more complex code paths. The strategy must account for evolving mocks as integration coverage grows.

## 5. FSA Storage: Manual Browser Checklist

The File System Access API cannot be exercised under Node — it requires a real Chromium browser with a real user gesture for the folder picker. Storage capability logic is unit-tested via the in-memory `MockDirectoryHandle` in `tests/storage/mock-fs.js`, but the *integration* with the OS, the picker, and the permission system can only be verified manually.

Run this checklist after any change that touches `src/storage/storage.js`, the router's FSA paths in `src/concepts/storageConcept.js`, the UI's new-project / reconnect / foreign-folder flows, or the synchronization wiring.

### Setup
- Serve the app on `http://localhost` (e.g. `npx serve`). FSA requires a secure context; `file://` will silently fail.
- Open in a Chromium browser (Edge, Chrome, Brave, Opera, Arc).
- Open DevTools console — many checks below want a glance at `Storage.isReady()` etc.

### First-run FSA pick
- [ ] Click "+" in the sidebar → New Project modal opens with the IDB / FSA radio (IDB checked by default).
- [ ] Switch to "Folder on your computer", type a name, click Create → modal closes, folder picker opens.
- [ ] Pick a folder. Sync-Info modal pops up.
- [ ] Click "Sounds good" → the new project appears in the selector and is selected. A default `generic.mmd` diagram is visible in the sidebar.
- [ ] Open File Explorer / Finder: the picked folder now contains `MermaidIDE/<projectName>/generic.mmd` plus a `.app/` folder with `version` and `audit.log`.

### Subsequent FSA project (no second picker)
- [ ] Click "+" again, pick "Folder on your computer", give a different name, Create → no picker; the project is created directly inside the existing `MermaidIDE/` folder.

### IDB project (regression)
- [ ] Click "+", keep "Browser storage" selected, name + Create → project appears, no folder picker, behaves as before.

### Foreign-folder flow
- [ ] In Explorer, manually create a folder called `MermaidIDE` somewhere fresh (e.g. `~/Desktop/scratch/MermaidIDE`).
- [ ] In a fresh browser profile (or after clearing IndexedDB), do the FSA project flow and point the picker at the *parent* of that manual folder.
- [ ] Foreign-Folder modal appears with "Use a nested folder" / "Pick a different folder".
- [ ] **Nest path**: click "Use a nested folder" → on disk you should see `<parent>/MermaidIDE/MermaidIDE/` (nested), and the new project lives in there.
- [ ] **Repick path**: instead click "Pick a different folder" → the picker re-opens. Choose a different parent.

### External edits round-trip
- [ ] With an FSA project selected, open one of its `.mmd` files in another editor.
- [ ] Change the content and save.
- [ ] In the app, click the diagram in the sidebar (or reload the page). The new content appears.

### Permission lifecycle
- [ ] After picking a folder, reload the page. Depending on Chrome's session persistence settings, you may see the yellow Reconnect banner at the top.
- [ ] Click Reconnect → permission prompt → grant. Banner disappears; FSA projects re-appear in the selector.
- [ ] In Chrome's site settings, revoke folder access. Reload. Banner reappears. FSA projects do **not** appear in the selector until you reconnect.

### Two-tab safety
- [ ] Open the app in two browser tabs, both pointing at the same FSA project.
- [ ] Make a small edit in tab A, save. Switch to tab B, make a different edit, save. Tab A's file should still be on disk; switching back and reloading shows tab B's content.
- [ ] No torn writes — `Storage.readText` for any saved diagram returns a complete file.

### Non-Chromium fallback
- [ ] Open the app in Firefox or Safari. New-Project modal's "Folder on your computer" radio is greyed out with a tooltip "Requires Chrome, Edge, or another Chromium browser."
- [ ] IDB-mode projects still work fully.

### Audit log on disk
- [ ] After several operations in an FSA project, open `MermaidIDE/.app/audit.log` in any text editor.
- [ ] Each line is a JSON object with `time`, `action` (`init`, `mkdir`, `write`, `rename`, `remove`), and operation-specific detail.
- [ ] Successful writes carry `atomic: true`; falls back to `atomic: false` only on older Chromium without `handle.move()`.

### Sanity console probes
At any point during testing:
```js
Storage.hasRoot()    // → true if a folder is remembered
Storage.isReady()    // → true if permission is currently granted
Storage.rootName()   // → basename of the picked folder
concepts.projectConcept.getState().projects
// → [{id: "idb:1", name: "...", mode: "idb"}, {id: "fsa:Foo", name: "Foo", mode: "fsa"}, ...]
```
