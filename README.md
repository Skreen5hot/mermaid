# mermaid

## Mermaid Project IDE

A lightweight, browser-based IDE for creating, organizing, and managing Mermaid diagrams within projects. It allows users to switch between Mermaid code and rendered diagram views, and persist models in IndexedDB.

This project is built using the **Concepts and Synchronizations** architecture, which promotes modular, testable, and maintainable code by separating application logic into independent "Concepts" and defining their interactions declaratively.

### Core Architecture

*   `/src/concepts`: Contains the core logic modules. Each concept manages its own state and is completely independent of the others.
    *   `projectConcept.js`: Manages the list of projects and the currently selected project.
    *   `diagramConcept.js`: Manages diagrams for the current project, including the active diagram's content.
    *   `storageConcept.js`: Handles all interactions with the browser's IndexedDB for persistence.
    *   `uiConcept.js`: Manages all direct DOM manipulations and UI state.
*   `/src/synchronizations.js`: The "wiring" layer of the application. It listens for events from concepts and triggers actions in other concepts, defining all cross-concept interactions.
*   `/tests`: Contains unit and integration tests for the concepts and their synchronizations.
*   `index.html`: The main HTML file and application entry point.

### How to Use

Because this application uses modern JavaScript Modules (`import`/`export`), it must be run from a local web server for security reasons. You cannot simply open `index.html` from your file system.

**Method 1: VS Code Live Server**
1.  Open the project folder in Visual Studio Code.
2.  Install the Live Server extension.
3.  Right-click on `index.html` and select "Open with Live Server".

**Method 2: Command Line**
1.  Make sure you have Node.js installed.
2.  Open your terminal or command prompt in the project directory.
3.  Run the command: `npx serve`
4.  Open your browser and navigate to the local address provided by the command (usually `http://localhost:3000`).

### Features

*   **Project-Based Organization**: Group your diagrams into distinct projects for better management.
*   **Side-Panel Navigation**: Quickly switch between diagrams within a project using a collapsible side menu with thumbnail previews.
*   **Code Editor & Diagram Viewer**: A split-pane view to write Mermaid syntax and see the rendered diagram update in real-time.
*   **Bulk Operations**:
    *   **Upload**: Add multiple `.mmd` files to a project at once.
    *   **Download**: Export an entire project as a `.zip` file containing all its diagrams.
*   **Local Storage**: All projects and diagrams are saved securely in your browser's IndexedDB. No cloud account needed.
*   **Individual File Management**:
    *   Create, save, and delete individual diagrams.
    *   Export a single diagram as a `.mmd` file.
