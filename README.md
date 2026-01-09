# Mermaid Ontology IDE

## Overview

A lightweight, browser-based IDE for creating, organizing, and managing Mermaid diagrams within projects, with integrated **OntoGrade** ontology validation for Common Core Ontologies (CCO) and Basic Formal Ontology (BFO).

This IDE enables users to:
- Create and manage Mermaid diagrams organized into projects
- Validate ontology diagrams against BFO/CCO standards
- Receive quality scores and detailed feedback on ontology design
- Persist all work locally in browser storage (no cloud required)

Built using the **Concepts and Synchronizations** architecture for modular, testable, and maintainable code.

### Core Architecture

**Application Concepts** (`/src/concepts`):
Each concept manages its own state and is completely independent of the others.
- `projectConcept.js` - Manages projects and the currently selected project
- `diagramConcept.js` - Manages diagrams for the current project, including active diagram content
- `storageConcept.js` - Handles all interactions with browser's IndexedDB for persistence
- `uiConcept.js` - Manages all direct DOM manipulations and UI state
- `gitAbstractionConcept.js` - Provides GitHub/GitLab integration for remote storage
- `securityConcept.js` - Manages encryption and secure credential storage

**OntoGrade Concepts** (`/src/concepts/ontograde`):
Integrated ontology validation system for CCO/BFO diagrams.
- `mermaidLifter.js` - Converts Mermaid diagrams to RDF triples
- `bfoValidator.js` - Validates that classes are properly rooted in BFO Entity hierarchy
- `shaclValidator.js` - Validates CCO design patterns (roles, information staircase, etc.)
- `logicReasoner.js` - Checks for logical inconsistencies and disjointness violations
- `gradingEngine.js` - Calculates weighted quality scores (0-5.0 scale)
- `reportGenerator.js` - Produces JSON-LD reports with violations and recommendations
- `reportViewer.js` - Modal UI for displaying validation reports

**Synchronizations** (`/src/synchronizations.js`):
The "wiring" layer that defines all cross-concept interactions declaratively.

**Documentation** (`/docs`):
- `/docs/ontograde` - OntoGrade feature documentation and iteration summaries
- `/docs/development` - Development guides, architecture, and testing strategies
- `/docs/git` - Git workflow documentation
- `/docs/meta` - Repository maintenance and reorganization docs

**Tests**:
- `/unit-tests` - 19 unit tests for concepts and synchronizations (100% passing)
- `/examples/ontograde` - Example validation tests demonstrating OntoGrade capabilities

## Getting Started

### Prerequisites
- Node.js (for running tests and build scripts)
- Modern web browser with ES6 module support
- Local web server (see setup options below)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd mermaid
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application using one of these methods:

   **Option 1: VS Code Live Server**
   - Open the project in Visual Studio Code
   - Install the Live Server extension
   - Right-click on `index.html` and select "Open with Live Server"

   **Option 2: Command Line**
   ```bash
   npx serve
   ```
   Then navigate to `http://localhost:3000`

**Note:** This application uses modern JavaScript Modules (`import`/`export`), so it must be run from a local web server for security reasons. You cannot simply open `index.html` from your file system.

### Running Tests

```bash
# Run all unit tests (19 tests)
npm test

# Run OntoGrade validation tests
npm run test:ontograde

# Run pattern validation tests
npm run test:ontograde:patterns

# Run logic consistency tests
npm run test:ontograde:logic

# Build for deployment
npm run build
```

## Features

### Diagram Management
- **Project-Based Organization** - Group diagrams into distinct projects for better management
- **Side-Panel Navigation** - Quickly switch between diagrams with thumbnail previews
- **Code Editor & Diagram Viewer** - Split-pane view with real-time diagram rendering
- **Bulk Operations**:
  - Upload multiple `.mmd` files to a project at once
  - Download entire project as a `.zip` file
- **Individual File Management**:
  - Create, save, rename, and delete diagrams
  - Export individual diagrams as `.mmd` files
- **Local Storage** - All projects and diagrams saved securely in browser's IndexedDB (no cloud required)

### OntoGrade: Ontology Validation (New!)

**What is OntoGrade?**
An integrated validation system that analyzes your Mermaid ontology diagrams against BFO (Basic Formal Ontology) and CCO (Common Core Ontologies) standards, providing quality scores and actionable feedback.

**Key Features:**
- **Automated Quality Scoring** - Receive a 0-5.0 grade based on three validation criteria
- **BFO Rooting Validation** - Ensures all classes are properly connected to BFO Entity hierarchy
- **Pattern Adherence Checking** - Validates CCO design patterns:
  - Role pattern (bearer → role ← process realization)
  - Information staircase (ICE → concretization → IBE → text value)
  - Designation pattern (entity ↔ designative ICE)
- **Logic Consistency Checking** - Detects contradictory type assignments and disjointness violations
- **Rich Feedback** - Visual modal with:
  - Color-coded score display (Excellent/Good/Fair/Poor)
  - Detailed violation breakdown with severity levels
  - Actionable recommendations for improvement
  - JSON-LD export capability

**How to Use OntoGrade:**
1. Create a Mermaid diagram with ontology relationships
2. Click the "🎓 Validate OntoGrade" button
3. Review your quality report in the modal
4. Address violations based on recommendations
5. Re-validate to see improvements

**Example Validation Report:**
```
Final Score: 4.2/5.0 (Good Ontology)

✅ BFO Rooting: 100% (All 5 classes rooted in bfo:Entity)
⚠️  Pattern Adherence: 67% (2 violations)
✅ Logic Consistency: 100% (No inconsistencies)

Recommendations:
• Add realizes relationship from Process to EmployeeRole
• Add is_concretized_by from PersonName ICE to name bearer
```

**Documentation:**
- Full documentation: [docs/ontograde/](docs/ontograde/)
- Project plan: [docs/ontograde/project-plan.md](docs/ontograde/project-plan.md)
- Testing guide: [docs/ontograde/testing-guide.md](docs/ontograde/testing-guide.md)

### Git Integration
- **GitHub/GitLab Support** - Sync projects with remote repositories
- **Secure Credentials** - Encrypted token storage in IndexedDB
- **Bulk Sync** - Push/pull entire projects with conflict detection

## Repository Structure

```
mermaid/
├── docs/                       # All documentation
│   ├── ontograde/             # OntoGrade feature docs (19 files)
│   ├── development/           # Development guides (7 files)
│   ├── git/                   # Git workflow docs
│   └── meta/                  # Repository maintenance
├── src/                        # Application source code
│   ├── concepts/              # Core application concepts
│   │   └── ontograde/        # OntoGrade validation system
│   ├── synchronizations.js   # Event wiring layer
│   └── utils/                # Shared utilities
├── examples/                   # Example code and tests
│   ├── ontograde/            # OntoGrade validation examples
│   └── diagrams/             # Example Mermaid diagrams
├── tests/                      # Test infrastructure
│   └── run-tests.js          # Test runner
├── unit-tests/                # Unit tests (19 tests, 100% passing)
├── scripts/                    # Build scripts
│   └── build.js              # Deployment build script
├── styles/                     # CSS stylesheets
├── index.html                 # Application entry point
└── package.json               # Dependencies and scripts
```

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Diagram Rendering**: Mermaid.js (via CDN)
- **RDF Processing**: N3.js (for OntoGrade RDF triple management)
- **Storage**: IndexedDB (via browser API)
- **Testing**: Node.js native test runner
- **Architecture**: Concepts and Synchronizations pattern

## Contributing

This project follows a modular architecture pattern. When contributing:

1. **Concepts are independent** - Each concept in `src/concepts/` should manage its own state and not directly call other concepts
2. **Synchronizations define interactions** - Cross-concept communication happens via events defined in `src/synchronizations.js`
3. **Write tests** - All new features should include unit tests in `unit-tests/`
4. **Update documentation** - Add documentation to appropriate `docs/` subdirectory

For more details:
- Architecture guide: [docs/development/agentic-development.md](docs/development/agentic-development.md)
- Testing strategy: [docs/development/test-strategy.md](docs/development/test-strategy.md)
- Git workflow: [docs/git/git-workflow.md](docs/git/git-workflow.md)

## Development

### Project Status
✅ **Phase 1:** Core IDE functionality - Complete
✅ **Phase 2:** Git integration - Complete
✅ **Phase 3:** OntoGrade validation system - Complete (Iterations 1-5)
🚀 **Current:** Deployment and refinement

### Recent Updates
- **Repository Reorganization** (2026-01-09): Cleaned up root directory, organized all documentation in `/docs`, moved examples to `/examples`, updated build scripts
- **Iteration 5: UI Integration** (2026-01-09): Added modal UI for OntoGrade reports with color-coded scores, violation details, and recommendations
- **Iteration 4: Scoring & Reporting** (2026-01-08): Implemented weighted scoring (0-5.0 scale) and JSON-LD report generation
- **Iteration 3: Logic Reasoning** (2026-01-08): Added disjointness violation detection and type collision checking

## License

ISC

## Acknowledgments

- Built with the Concepts and Synchronizations architecture
- Ontology validation based on BFO (Basic Formal Ontology) and CCO (Common Core Ontologies) standards
- Diagram rendering powered by Mermaid.js

---

**For detailed documentation, see [docs/](docs/)** • **For OntoGrade documentation, see [docs/ontograde/](docs/ontograde/)**
