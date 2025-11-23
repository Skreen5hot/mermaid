# Comprehensive Test Plan: Mermaid Project IDE

## 1. Objective

The primary objective of this test plan is to achieve comprehensive test coverage for the Mermaid Project IDE, ensuring its stability, reliability, and maintainability. This plan outlines the specific unit, integration, and end-to-end (E2E) tests required to validate all features implemented according to the `Mermaid IDB Devlpment Plan.md`. The successful execution of this plan will signify that the application is feature-complete and ready for release.

## 2. Guiding Principles

All tests will adhere to the principles outlined in the `testStrategy.md` document:

*   **Process-Level Isolation**: Each `*.test.js` file will run in a separate Node.js process to guarantee test isolation and prevent state pollution.
*   **Simplicity & Maintainability**: Tests will be self-contained and easy to understand. Complex global setup is forbidden.
*   **Zero Dependencies**: The testing framework will continue to use only built-in Node.js modules.
*   **Strict Assertion**: Tests will fail fast. An assertion failure within an `it` block will immediately terminate that test file's process with a non-zero exit code.

## 3. Scope of Testing

This plan covers three layers of testing:

1.  **Unit Tests**: Verify the internal logic of individual concepts and pure functions in isolation.
2.  **Integration Tests**: Verify the declarative rules in `synchronizations.js` by mocking concept actions and confirming that events correctly trigger the intended cross-concept interactions.
3.  **End-to-End (E2E) Tests**: High-level tests simulating full user workflows. These will be scripted but may require manual execution in the browser environment to validate the full stack, including the DOM.

---

## 4. Detailed Test Cases by Module

### Module A: Security (`securityConcept.js`)

*   **File**: `tests/concepts/security.concept.test.js`
*   **Cases**:
    *   `[UNIT]` **encryptToken**: Should produce a valid ciphertext, salt, and IV from a plaintext string.
    *   `[UNIT]` **decryptToken**: Should correctly decrypt a token given the correct password and encrypted bundle.
    *   `[UNIT]` **decryptToken Failure**: Should throw an error when given an incorrect password.
    *   `[UNIT]` **clearDecryptedToken**: Should set the in-memory `decryptedToken` state to `null`.

### Module B: Git Abstraction Layer (GAL)

*   **File**: `tests/adapters/github.adapter.test.js` & `tests/adapters/gitlab.adapter.test.js`
*   **Cases**:
    *   `[UNIT]` **Rate Limit Handling**:
        *   Create a test that mocks `fetch` to return a `403` (GitHub) or `429` (GitLab) status.
        *   Assert that the fetch helper function retries the request multiple times with an increasing delay.
        *   Assert that the function eventually throws an error after all retries are exhausted.
        *   Create a test that mocks a `Retry-After` header and asserts that the wait time respects the header value.

### Module C: Synchronization Core Agent (`syncConcept.js`)

*   **File**: `tests/concepts/sync.concept.test.js`
*   **Cases**:
    *   `[UNIT]` **Pull Logic - New Remote File**: Mock the GAL to return a remote file not present locally. Assert that `storageConcept.addDiagram` is called.
    *   `[UNIT]` **Pull Logic - Updated Remote File**: Mock the GAL to return a remote file with a different SHA. Assert that `storageConcept.updateDiagram` is called.
    *   `[UNIT]` **Pull Logic - Deleted Remote File**: Mock the GAL to return a file list that is missing a file present locally. Assert that `storageConcept.deleteDiagram` is called.
    *   `[UNIT]` **Push Logic**:
        *   Mock `storageConcept.getSyncQueueItems` to return items for `create`, `update`, `delete`, and `rename`.
        *   Assert that the correct `gitAbstractionConcept` action (`putContents` or `deleteContents`) is called with the correct parameters for each queue item.
    *   `[UNIT]` **Conflict Resolution - Fallback**:
        *   Mock a `syncQueue` item for an `update`.
        *   Mock the GAL's `putContents` to throw a `409 Conflict` error.
        *   Assert that the GAL's `getContents` is called twice (for BASE and REMOTE versions).
        *   Assert that the GAL's `putContents` is called again to create a new `_conflict_` file.
        *   Assert that `storageConcept.deleteSyncQueueItem` is called.

### Module D: Persistence & Queue (`storageConcept.js`)

*   **File**: `tests/concepts/storage.concept.test.js`
*   **Cases**:
    *   `[UNIT]` **Project CRUD**: Test `addProject`, `updateProject`, and `deleteProject`.
    *   `[UNIT]` **Diagram CRUD**: Test `addDiagram`, `getDiagram`, `updateDiagram`, `deleteDiagram`, and `getDiagramsByProjectId`.
    *   `[UNIT]` **SyncQueue CRUD**: Test `addSyncQueueItem`, `getSyncQueueItems`, and `deleteSyncQueueItem`.

### Module E: User Experience (`uiConcept.js`)

*   **File**: `tests/concepts/ui.concept.test.js`
*   **Cases**: (Requires a mock DOM environment, e.g., using a utility in `test-utils.js`)
    *   `[UNIT]` **Render Actions**: For each `render...` and `update...` action, assert that the corresponding mock DOM element's `innerHTML` or properties are correctly modified.
    *   `[UNIT]` **Modal Actions**: Test `show...` and `hide...` actions for all modals, asserting that the `style.display` property is correctly set.
    *   `[UNIT]` **Event Listeners**: Simulate a `click` or `input` event on a mock element and assert that the correct `ui:...'` event is emitted via the `notify` function.

### Integration Tests (`synchronizations.js`)

*   **File**: `tests/synchronizations.flows.test.js`
*   **Cases**:
    *   `[INTEGRATION]` **Connect Flow**:
        *   Trigger `ui:connectProjectClicked`.
        *   Mock `gitAbstractionConcept` and `securityConcept`.
        *   Assert that `storageConcept.addProject` is called with the correctly structured project object.
        *   Assert that `projectConcept.loadProjects` is called on success.
        *   Assert that `uiConcept.showNotification` is called on failure.
    *   `[INTEGRATION]` **Unlock Flow**:
        *   Set `projectConcept` state with an active project.
        *   Trigger `ui:unlockSessionClicked`.
        *   Mock `securityConcept.decryptToken`.
        *   Assert that `diagramConcept.loadDiagramsForProject` is called on success.
        *   Assert that the unlock modal's error element is shown on failure.
    *   `[INTEGRATION]` **Rename Flow**:
        *   Trigger `ui:renameDiagramClicked`.
        *   Assert that `diagramConcept.renameDiagram` is called.
        *   Follow through to the `diagramRenameRequested` synchronization.
        *   Assert that `storageConcept.updateDiagram` and `storageConcept.addSyncQueueItem` are both called.
        *   Assert that `diagramConcept.loadDiagramsForProject` is called to refresh the UI.

---

## 5. End-to-End (E2E) Test Scenarios

These scenarios describe high-level user workflows that validate the entire application stack. They will be documented as scripts to be executed manually in a browser environment.

*   **E2E Scenario 1: The Full Lifecycle**
    1.  **Action**: Use the "Connect Project" modal to connect a new, empty test repository.
    2.  **Verify**: The project appears in the dropdown. The sync status is successful.
    3.  **Action**: Create a new diagram named `test1.mmd`.
    4.  **Action**: Add content to the diagram and click "Save".
    5.  **Action**: Manually trigger a sync.
    6.  **Verify**: The sync completes successfully. The `test1.mmd` file now exists in the `mermaid/` directory of the remote repository with the correct content.

*   **E2E Scenario 2: Offline Editing**
    1.  **Action**: With a connected project, disconnect the computer from the network.
    2.  **Action**: Edit and save an existing diagram.
    3.  **Action**: Create a new diagram.
    4.  **Verify**: The changes are reflected locally. The sync status shows an error (or remains idle).
    5.  **Action**: Reconnect to the network and manually trigger a sync.
    6.  **Verify**: The sync completes successfully. Both the updated and the new diagram are pushed to the remote repository.

*   **E2E Scenario 3: Conflict Resolution**
    1.  **Action**: Connect a project and sync it.
    2.  **Action**: In the GitHub/GitLab web UI, manually edit a diagram file (e.g., `test1.mmd`) and commit the change.
    3.  **Action**: In the Mermaid IDE, edit the *same* diagram (`test1.mmd`) with different content and click "Save".
    4.  **Action**: Manually trigger a sync.
    5.  **Verify**:
        *   A toast notification appears, informing the user that a conflict was detected and a new file was created.
        *   The content of `test1.mmd` in the editor updates to match the version from the remote repository.
        *   A new file (e.g., `test1_conflict_167...mmd`) appears in the diagram list.
        *   The new conflict file exists on the remote repository.

## 6. Execution and Reporting

*   **Execution**: All automated tests (Unit, Integration) will be run via the `npm test` command, which invokes the `run-tests.js` script.
*   **CI/CD**: The `ci.yml` workflow will execute `npm test` on every push and pull request. A build will fail if any test process returns a non-zero exit code.
*   **Reporting**: Test results will be streamed to the console. A final summary of passed/failed files will be printed at the end of the test run. E2E test results will be recorded manually by marking the scenarios in this document as "Passed" or "Failed".