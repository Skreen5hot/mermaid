# 📅 OntoGrade Iterative Project Plan

**Version:** 1.0
**Based on:** `agenticDevlopment.md` (Architecture) & `functionalRequirements.md` (FRD v2.1)
**Architecture Pattern:** Concepts + Synchronizations (MIT CSAIL)

---

## 🏗️ Architectural Strategy

To maintain the **Concepts + Synchronizations** pattern, OntoGrade will be decomposed into independent domain concepts. Logic will be implemented as **pure functions** within these concepts, and data flow will be managed exclusively via **declarative synchronizations**.

### Core Concepts
1.  **`mermaidLifter`**: Responsible for parsing Mermaid syntax and converting it to an in-memory RDF graph (N3/Turtle).
2.  **`bfoValidator`**: Responsible for traversing the RDF graph to verify BFO rooting and structural alignment.
3.  **`shaclValidator`**: Responsible for executing SHACL shapes against the graph to validate CCO patterns.
4.  **`logicReasoner`**: Responsible for checking logical consistency and disjointness using a lightweight reasoner.
5.  **`gradingEngine`**: Responsible for aggregating results from validators and calculating the weighted Ontological Quality Score.
6.  **`reportGenerator`**: Responsible for formatting the final output into JSON-LD.

---

## 🔄 Iteration 1: Ingestion & Lifting (Foundation)

**Goal:** Establish the module structure and enable the conversion of Mermaid diagrams into RDF triples.

### Requirements
*   **FR-1.1:** Parse Mermaid syntax in-browser.
*   **FR-1.2:** Lift Mermaid nodes/edges to RDF triples using OntoGrade conventions.

### New Components
*   **Concept:** `mermaidLifter.js`
    *   *State:* `rdfGraph` (string/object), `parseErrors` (array).
    *   *Actions:* `liftDiagram(mermaidText)`.
    *   *Events:* `diagramLifted`, `liftingFailed`.
*   **Tests:** `tests/mermaidLifter.test.js`

### Acceptance Criteria
*   [ ] `mermaidLifter` accepts a standard Mermaid string (e.g., `Person -->|is_bearer_of| Role`).
*   [ ] Pure function `mermaidToRDF` returns valid N3/Turtle triples.
*   [ ] Nodes are correctly typed (e.g., `cco:Person`, `cco:ResidentRole`).
*   [ ] Edges are correctly mapped to object properties.
*   [ ] Unit tests pass for valid and invalid Mermaid syntax.

---

## 🔄 Iteration 2: Structural Validation (BFO)

**Goal:** Implement the BFO rooting check to ensure all entities trace back to `bfo:Entity`.

### Requirements
*   **FR-2.1:** Execute pathfinding to BFO root.
*   **FR-2.2:** Detect orphan classes.

### New Components
*   **Concept:** `bfoValidator.js`
    *   *State:* `orphans` (array), `roots` (array), `complianceScore` (number).
    *   *Actions:* `validateStructure(rdfGraph)`.
    *   *Events:* `structureValidated`.
*   **Synchronization:**
    *   `WHEN mermaidLifter.diagramLifted DO bfoValidator.validateStructure`

### Acceptance Criteria
*   [ ] `bfoValidator` correctly identifies classes without a path to `bfo:Entity`.
*   [ ] Cycles in the graph do not crash the validator.
*   [ ] Synchronization triggers validation automatically when lifting completes.
*   [ ] Unit tests verify detection of both rooted and orphan entities.

---

## 🔄 Iteration 3: Pattern Validation & Reasoning

**Goal:** Implement CCO pattern validation (SHACL) and logical consistency checks.

### Requirements
*   **FR-3:** Enforce CCO patterns (Information Staircase, Role Pattern).
*   **FR-4:** Detect logical inconsistencies (disjointness, type collisions).

### New Components
*   **Concept:** `shaclValidator.js`
    *   *State:* `violations` (array), `complianceScore` (number).
    *   *Actions:* `validatePatterns(rdfGraph)`.
    *   *Events:* `patternsValidated`.
*   **Concept:** `logicReasoner.js`
    *   *State:* `inconsistencies` (array), `integrityScore` (number).
    *   *Actions:* `checkConsistency(rdfGraph)`.
    *   *Events:* `consistencyChecked`.
*   **Synchronizations:**
    *   `WHEN mermaidLifter.diagramLifted DO shaclValidator.validatePatterns`
    *   `WHEN mermaidLifter.diagramLifted DO logicReasoner.checkConsistency`

### Acceptance Criteria
*   [ ] `shaclValidator` flags violations of the Information Staircase pattern.
*   [ ] `logicReasoner` flags entities inferred as both `Process` and `Object`.
*   [ ] Both validators run independently via synchronizations.
*   [ ] Performance is acceptable (non-blocking) for medium-sized diagrams.

---

## 🔄 Iteration 4: Scoring & Reporting

**Goal:** Aggregate results from all validators, calculate the final score, and generate the JSON-LD report.

### Requirements
*   **FR-5:** Generate weighted Ontological Quality Score and JSON-LD output.

### New Components
*   **Concept:** `gradingEngine.js`
    *   *State:* `finalScore` (number), `breakdown` (object).
    *   *Actions:* `calculateScore({ bfo, shacl, logic })`.
    *   *Events:* `scoreCalculated`.
*   **Concept:** `reportGenerator.js`
    *   *State:* `latestReport` (json).
    *   *Actions:* `generate(scoreData, violations)`.
    *   *Events:* `reportReady`.
*   **Synchronizations:**
    *   *Complex Sync:* We need to wait for all 3 validators.
    *   *Strategy:* `gradingEngine` listens to `structureValidated`, `patternsValidated`, and `consistencyChecked`. It maintains internal state of "pending validations" and runs calculation only when all 3 are received for the current diagram ID.

### Acceptance Criteria
*   [ ] Score is calculated based on weights: BFO (30%), Logic (40%), CCO (30%).
*   [ ] JSON-LD report matches the format defined in FRD Section 5.
*   [ ] Partial compliance logic works (e.g., 50% of classes rooted = partial BFO score).

---

## 🔄 Iteration 5: UI Integration

**Goal:** Expose the functionality to the user via the Mermaid IDE interface.

### Requirements
*   **FR-1:** Trigger ingestion from active diagram.
*   **FR-5:** Display results to the user.

### New Components
*   **UI Component:** `OntoGradeButton` (in `/ui`).
*   **UI Component:** `OntoGradeModal` (displays JSON-LD/Score).
*   **Concept:** `ideIntegration` (Wrapper for IDE specific interactions if needed, or just use `mermaidLifter` directly from UI).

### Acceptance Criteria
*   [ ] Clicking "OntoGrade" triggers the entire pipeline.
*   [ ] Results are displayed in a modal.
*   [ ] User can download the JSON-LD report.
*   [ ] No page reload occurs; everything is client-side.

---

## 🧪 Testing Strategy (Per Iteration)

Following `agenticDevlopment.md`:

1.  **Unit Tests (`/tests/concepts/*.test.js`)**:
    *   Test pure functions (e.g., `calculateScore(inputs) -> number`).
    *   Test actions by mocking `notify`.

2.  **Synchronization Tests (`/tests/synchronizations.test.js`)**:
    *   Mock the concepts.
    *   Fire `mermaidLifter.diagramLifted`.
    *   Assert that `bfoValidator.validateStructure` was called with the correct payload.

3.  **UI Tests (using `ui-test-framework`)**:
    *   Load IDE.
    *   Enter valid Mermaid.
    *   Click "OntoGrade".
    *   Assert Modal appears with Score > 0.

---

## 📝 Developer Checklist for Iteration 1

1.  [ ] Create `/concepts/mermaidLifter.js`.
2.  [ ] Install `n3` (or similar RDF library) as a dependency.
3.  [ ] Implement pure function `liftToRDF(mermaidCode)`.
4.  [ ] Implement action `liftDiagram` and event `diagramLifted`.
5.  [ ] Create `/tests/concepts/mermaidLifter.test.js`.
6.  [ ] Verify lifting of standard node/edge patterns defined in FR-1.2.
