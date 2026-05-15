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
*   **Two Storage Modes**, chosen per project:
    *   **Browser storage** (works in any browser): diagrams live in IndexedDB. Fast, no permission prompts, but can be lost if you clear site data, change browsers, or reinstall the OS.
    *   **Folder on your computer** (Chromium browsers only): diagrams are real `.mmd` files inside a folder you pick. You can open them in other tools, back them up, and they survive a browser reset.
*   **Side-Panel Navigation**: Quickly switch between diagrams within a project using a collapsible side menu with thumbnail previews.
*   **Code Editor & Diagram Viewer**: A split-pane view to write Mermaid syntax and see the rendered diagram update in real-time.
*   **Bulk Operations**:
    *   **Upload**: Add multiple `.mmd` files to a project at once.
    *   **Download**: Export an entire project as a `.zip` file containing all its diagrams.
*   **Individual File Management**:
    *   Create, save, and delete individual diagrams.
    *   Export a single diagram as a `.mmd` file.

### Storage modes — which to pick

When you create a new project, you choose where it lives. Both modes are first-class; you can have any mix of them in the same app.

**Browser storage (IndexedDB)** is the default. Diagrams are stored inside your browser's IndexedDB for `localhost` (or whatever origin you serve from). Zero permission prompts, instant access, works in every modern browser.

> **Trade-off:** the data is bound to *that browser* on *that machine*. Clearing site data, switching browsers, reinstalling the OS, or a profile reset can wipe it. If you want diagrams that survive any of those, use the on-disk mode.

**Folder on your computer (File System Access)** requires a Chromium browser (Edge, Chrome, Brave, Opera, Arc). On your first FSA project you'll pick a folder; the app creates a `MermaidIDE/` subfolder inside, and from then on every FSA-mode project is a folder there containing `.mmd` files.

> **You own these files.** Move them, back them up, edit them in VS Code, sync them via OneDrive/iCloud — they're yours. The app reads what's on disk; if you edit a `.mmd` externally and reload, the new content appears.
>
> **Cloud sync is supported and recommended for durability**, but optional. If you'd rather avoid sync (for perf), pick a folder outside `Documents/`.

The app remembers your folder choice across sessions. After a browser update or reload, it may need to re-prompt for permission — the Reconnect banner at the top of the page handles that with one click.
