# Test Coverage Plan

This document outlines a phased approach to building out the test suite for this project. The goal is to iteratively increase test coverage, starting with the foundational utilities and moving towards complex integration tests. This ensures that as the application grows, we have a reliable safety net to catch regressions and verify behavior.

## Phase 1: Foundational Unit Tests

This phase focuses on the core, isolated building blocks of the application and the test framework itself. These tests are crucial because all other components depend on their correctness.

### 1.1. `eventBus.js`

The event bus is a critical piece of the reactive architecture.

-   **`eventBus.test.js`**
    -   `[ ]` **Creation**: `createEventBus()` should return an object with `subscribe` and `notify` methods.
    -   `[ ]` **Subscription**: `subscribe(fn)` should successfully register a callback function.
    -   `[ ]` **Notification**: `notify(event, payload)` should call the subscribed callback with the correct `event` and `payload`.
    -   `[ ]` **Multiple Subscribers**: `notify` should call all registered subscribers.
    -   `[ ]` **Isolation**: Events from one bus instance should not trigger subscribers on a different bus instance.

### 1.2. `assert.js` (Test Utility)

Testing our test utilities ensures that test failures are accurate.

-   **`assert.test.js`**
    -   `[ ]` **`assert.ok`**: Should pass for truthy values and throw for falsy values.
    -   `[ ]` **`assert.strictEqual`**: Should pass for strictly equal values (`===`) and throw for unequal values.
    -   `[ ]` **`assert.fail`**: Should always throw an error with the provided message.

---

## Phase 2: Concept Unit Tests

This phase involves testing each "concept" in isolation. The goal is to verify that each concept correctly manages its own state and emits the expected events in response to inputs. This will require mocking or stubbing their dependencies (e.g., a concept's `listen` method can be called directly to simulate an incoming event).

### 2.1. `projectConcept.js`

-   **`concepts/projectConcept.test.js`**
    -   `[ ]` **Initial State**: Should initialize with a default state (e.g., `projects: []`, `currentProjectId: null`).
    -   `[ ]` **State Mutations**:
        -   `listen('setProjects', ...)`: Should correctly update the `projects` array.
        -   `listen('setCurrentProject', ...)`: Should update `currentProjectId` and emit a `projectChanged` event.
        -   `listen('createProject', ...)`: Should emit a `do:createProject` event.
        -   `listen('deleteProject', ...)`: Should emit a `do:deleteProject` event.
    -   `[ ]` **Event Emission**: Verify that state changes correctly trigger notification events (e.g., `projectsUpdated`, `projectChanged`).

### 2.2. `diagramConcept.js`

-   **`concepts/diagramConcept.test.js`**
    -   `[ ]` **Initial State**: Should initialize with a default state (e.g., `diagrams: []`, `currentDiagram: null`).
    -   `[ ]` **State Mutations**:
        -   `listen('setDiagrams', ...)`: Should update the `diagrams` array.
        -   `listen('setCurrentDiagram', ...)`: Should emit a `do:loadDiagram` event.
        -   `listen('handleDiagramLoaded', ...)`: Should update `currentDiagram` and emit `diagramContentLoaded`.
        -   `listen('debouncedUpdateCurrentDiagramContent', ...)`: Should update content on the `currentDiagram` state.
        -   `listen('saveCurrentDiagram')`: Should emit a `do:saveDiagram` event with the correct data.
    -   `[ ]` **Event Emission**: Verify that state changes correctly trigger `diagramsUpdated` and `diagramContentChanged` events.

### 2.3. `storageConcept.js`

-   **`concepts/storageConcept.test.js`**
    -   `[ ]` **Event Handling**:
        -   `listen('do:open')`: Should attempt to open the database and emit `databaseOpened` on success.
        -   `listen('do:listProjects')`: Should emit `projectsListed` with data from the mock database.
        -   `listen('do:createProject')`: Should add a project to the mock database and emit `projectCreated`.
        -   `listen('do:loadDiagram')`: Should emit `diagramLoaded` with the correct diagram.
    -   **Note**: These tests will require mocking `IndexedDB` or the underlying storage mechanism to run in a Node.js environment.

### 2.4. `uiConcept.js`

-   **`concepts/uiConcept.test.js`**
    -   `[ ]` **Event Handling**:
        -   `listen('renderProjectSelector', ...)`: Should emit an event or update state indicating a re-render is needed.
        -   `listen('renderEditor', ...)`: Should correctly set editor-related state.
        -   `listen('toggleSplitView')`: Should toggle a boolean `isSplitView` flag in its state.
    -   `[ ]` **User Interaction Simulation**:
        -   Simulate a UI event like `ui:projectSelected` and verify it calls `notify` with the correct parameters.

---

## Phase 3: Integration Tests

This final phase tests the "wiring" between concepts as defined in `synchronizations.js`. The goal is to ensure that an event triggered in one concept correctly propagates through the system and causes the expected side effects in other concepts.

### 3.1. `synchronizations.js`

-   **`synchronizations.test.js`**
    -   `[ ]` **Storage -> Project**:
        -   When `storageConcept` notifies `projectsListed`, verify `projectConcept.listen('setProjects', ...)` is called.
    -   `[ ]` **Project -> UI**:
        -   When `projectConcept` notifies `projectsUpdated`, verify `uiConcept.listen('renderProjectSelector', ...)` is called.
    -   `[ ]` **Project -> Diagram**:
        -   When `projectConcept` notifies `projectChanged`, verify `diagramConcept.listen('loadDiagrams', ...)` is called.
    -   `[ ]` **UI -> Project/Diagram**:
        -   When `uiConcept` notifies `ui:projectSelected`, verify `projectConcept.listen('setCurrentProject', ...)` is called.
        -   When `uiConcept` notifies `ui:newProjectClicked`, verify `projectConcept.listen('createProject', ...)` is called.
        -   `[x]` When `uiConcept` notifies `ui:uploadMmdClicked`, verify `diagramConcept.listen('createDiagram', ...)` is called for each file.
    -   `[ ]` **Full End-to-End Flow**:
        -   Test a complete user story, e.g., "Creating a new project".
        -   Simulate `uiConcept.notify('ui:newProjectClicked', { name: 'Test Project' })`.
        -   Verify this triggers `projectConcept`, which triggers `storageConcept`.
        -   Verify `storageConcept` notifies `projectCreated`, which triggers `projectConcept` to reload, which finally triggers `uiConcept` to re-render the list.

By completing these phases, we will have a comprehensive test suite that validates the application's core logic, individual components, and the critical interactions between them.