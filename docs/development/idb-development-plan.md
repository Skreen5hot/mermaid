# Agentic AI Development Plan: Mermaid Git Synchronization

## 1. Objective
The overarching goal is to implement a **rigorous**, **comprehensive**, **organized**, and **maintainable** bidirectional synchronization layer between a user's local **Mermaid Project** (stored in IndexedDB) and a single designated **GitHub or GitLab repository** file path (`mermaid/`).

* **Rigor:** Defined by the strict adherence to the **detailed sync algorithm** (initial import, local push, remote detection) and **security protocols** (PBKDF2, AES-GCM token handling). This includes robust error handling for conflicts, rate limits, and token failures.
* **Comprehensive:** Encompassing the entire lifecycle from initial **Connect Flow** and directory creation, through real-time **Editing & Saving**, to proactive **Remote Change Detection** and conflict resolution (auto-merge attempt).
* **Organized:** Achieved through a clear, three-store data model (`projects`, `diagrams`, `syncQueue`) and a modular integration strategy, separating Git provider logic via adapters. Project naming is standardized to the repo name.
* **Maintainable:** Ensured by using reusable **crypto/token handling code** (from GitConnect), developing provider-agnostic core sync logic, and comprehensive unit/integration/E2E testing.

---

## 2. Core Strategy: Iterative, Thematic Development

### 2.1 Input Consolidation & Scoping

| Input Type | Extracted Detail / Concept | Scope |
| :--- | :--- | :--- |
| **Functional Requirements (FR)** | Project $\leftrightarrow$ Repo connection (GitHub/GitLab), `mermaid/` directory check/creation, Bi-directional sync, Local save (IndexedDB) $\rightarrow$ Remote push (Git API), Remote change detection & reconciliation, Project rename to Repo name. | Core |
| **Non-Functional Requirements (NFR)** | **Security:** Encrypted token storage (IDB) via Salt/IV/PBKDF2/AES-GCM, Token Scopes (`Contents: Read & Write`). **Performance:** Content-path listing vs. Tree listing. **Reliability:** Offline editing, FIFO `syncQueue` with retry/backoff. | Core |
| **Constraints** | Only **one** repo per Mermaid project. Files must be under the **flat path** `mermaid/`. Only `.mmd` files are supported. Operates on the **default branch**. | Core |
| **Roles** | **User:** Initiates connection, edits diagrams, unlocks session, handles conflict resolution. **System:** Performs sync worker background tasks, manages IndexedDB, handles encryption/decryption. | System/Agent |
| **Ontological Concepts** | **Project**, **Diagram**, **Repository**, **CommitSHA**, **SyncQueueItem**, **Conflict**. | Data Model |
| **Integration Points** | **IndexedDB API**, **Git Provider APIs** (GitHub/GitLab), **Crypto Library**, **Text Diff/Merge Utility**. | Core |

### 2.2 Thematic / Modular Iteration

| Module / Domain Cluster | Primary Focus | Dependencies |
| :--- | :--- | :--- |
| **A. Token & Security** | Encryption/Decryption, Session Management, API Authorization. | Crypto Lib, IndexedDB |
| **B. Git Abstraction Layer (GAL)** | Provider-agnostic API calls (List, Get, Create/Update/Delete Contents), Rate Limit handling, Adapter logic. | Provider APIs (GitHub/GitLab) |
| **C. Synchronization Core Agent** | Orchestrates Initial Sync/Import, Remote Change Detection (Polling/Diff), Conflict Resolution, `lastSyncSha` management. | GAL (B), Data Model (D) |
| **D. Local Persistence & Queue** | IndexedDB management, Offline editing, FIFO processing, Retry logic. | IndexedDB |
| **E. User Experience & Notifications** | Connect Flow UI, Unlock/Session Notification, Activity Indicators, Error/Conflict Reporting. | All modules |

### 2.3 Precision Modeling or Implementation

| Item/Concept | Module | Classification | Detail/Constraint |
| :--- | :--- | :--- | :--- |
| `SyncWorker` | C, D | **Agent Capability** | Processes `syncQueue` (FIFO, retry/backoff) and executes `RemoteChangeDetection`. |
| `LastSyncSha` | C | **Ontology Class** | Stored in `project.repo`. Critical for incremental diff. |
| API Tool Selection | B | **Agent Behavior** | **Tool Use Pattern:** GAL Agent uses `contents` (simple) or switches to `git/trees` (recursive) for large lists (Edge Case handling). |
| Conflict Resolution | C | **Agent Behavior** | **Reasoning Pattern:** Attempt 3-way text merge (base: last sync SHA, local: local content, remote: current remote). If clean, auto-merge; otherwise, notify. |
| Nested directories in `mermaid/` | Domain | **Constraint** | Out-of-Scope (Model assumes flat `mermaid/`). |
| `lastModifiedRemoteSha` | D | **Metrics/Data** | Used for local conflict check before pushing. |
| `PUT /contents/` | B | **Agent Behavior** | **Tool Use:** Requires `sha` parameter for updates (Optimistic Locking). |

### 2.4 Integration & Documentation
The **Synchronization Core Agent (C)** acts as the hub, coordinating:
* **Agent $\leftrightarrow$ Tools:** Calls the **Git Abstraction Layer (B)**, which uses **Provider Adapters** (GitHub/GitLab) for API execution.
* **Agent $\leftrightarrow$ Data:** Interacts with the **Local Persistence Layer (D)** for reading/writing IndexedDB data (`projects`, `diagrams`, `syncQueue`).
* **Documentation:** Focus on an **Architecture Document** detailing the Sync State Machine and an **API Adapter Specification** defining the GAL interface.

---

## 3. Execution Plan & Progress Tracker

# Phase 1: Consolidation & Scoping

| Task | Module | Status | Priority |
| :--- | :--- | :--- | :--- |
| 1.1 Finalize Data Model Schema | D | X | High |
| 1.2 Implement **Token Encryption/Decryption** (Reuse GitConnect Crypto) | A | X | High |
| 1.3 **IndexedDB Store** Setup (`projects`, `diagrams`, `syncQueue`) | D | X | High |
| 1.4 **Git Abstraction Layer (GAL)** Interface Definition | B | X | High |
| 1.5 Scaffold GitHub Adapter (`github.js`) for `contents` endpoint (List/Get/Put) | B | ◻ | High |

# Phase 2: Iterative Module / Cluster Development

| Module Name | Module A: Token & Security | Module B: GAL & Tooling | Module C: Sync Core Agent | Module D: Persistence & Queue |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Goal** | Securely manage provider authentication tokens. | Provider-agnostic API access and error handling. | Orchestrate all sync flows (initial, push, pull, conflict). | Robust local storage and background job management. |
| **1. FR Coverage** | Secure **Unlock Flow**. | **Connect Flow** (404/200 checks). **Update/Create** via API. | Initial Sync/Import logic. Local Push logic. Remote Detection logic. Conflict Resolution. | Local save. `syncQueue` population. |
| **2. Agent Behaviors** | Decrypt on unlock, destroy on log-out. | **Tool Use:** Call `contents` API, handle 404/403/401/rate limits. | **Reasoning:** Incremental diff based on SHAs. **Tool Use:** 3-way merge. | FIFO processing with retry. Offline $\rightarrow$ Queueing. |
| **3. Tests** | Unit Test: Encryption/Decryption. | Integration Test: Existing `mermaid/` import. | Integration Test: Conflict $\rightarrow$ Auto-merge/Notification. E2E Test: Offline $\rightarrow$ Sync. | Unit Test: `syncQueue` logic (FIFO, Backoff). |
| **4. Deliverables** | Crypto Utility. Token Storage Class. | `github.js` and `gitlab.js` Adapters. | `SyncWorker` Agent. Conflict Resolver Utility. | IndexedDB Access Layer. `syncQueue` processor. |

---

## 4. Integration Strategy
The system uses an **Agent-Orchestrated Hub-and-Spoke** architecture.

* **Synchronization Core Agent (Hub):** Manages state, timing, and conflict resolution.
* **Integration Flow (Push):** Local Edit $\rightarrow$ IndexedDB Write $\rightarrow$ Queue Item $\rightarrow$ Core Agent picks item $\rightarrow$ Conflict Check $\rightarrow$ Git Abstraction Layer $\rightarrow$ PUT Content API (Tool).
* **Ontologies:** The data mapping must strictly enforce that IndexedDB fields like `lastModifiedRemoteSha` correspond to the Git file's `sha` property retrieved via the API.

---

## 5. Deliverables

* **Codebase:**
    * Completed implementation of the **Synchronization Core Agent** and its state machine.
    * Full implementation of the **Git Abstraction Layer** with `github.js` and `gitlab.js` adapters.
    * Reusable **Security & Crypto module** for token handling.
    * IndexedDB persistence layer with the three defined stores.
* **Documentation:**
    * Agentic Architecture Document (Sync State Machine).
    * API Adapter Specification.
* **Testing Suite:**
    * 100% passing Unit Tests for core components.
    * Passing Integration Tests covering Connect, Push, Pull, and Conflict scenarios.
    * Passing E2E Tests for Offline and Security checks.

---

## 6. Review & Governance

| Review Cycle | Quality Check Focus | Approval Criteria |
| :--- | :--- | :--- |
| **Phase 1 Completion** | Security/Crypto implementation audit; IndexedDB schema review. | Code review sign-off that token handling is secure. Correct data model is implemented. |
| **Mid-Phase 2 (Core Sync)** | Review of **Conflict Resolution** logic; Unit/Integration test coverage of `syncQueue` and `lastModifiedRemoteSha` checks. | Successful simulation of happy path (push/pull) and basic conflict handling. |
| **Pre-Release (Phase 2 Final)** | E2E testing (offline sync, large repo edge case); UI/UX flow review (Notifications, Connect Modal). | All acceptance tests pass. No critical rate limit or token revocation failures during extended testing. Documentation is complete. 