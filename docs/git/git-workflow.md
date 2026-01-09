# Mermaid Project IDE

A secure, serverless, browser-based IDE for creating, organizing, and synchronizing Mermaid diagrams with a remote Git repository.

## Description

This application is a powerful, client-side-only tool for managing Mermaid diagrams. It provides a full-featured editing experience with local-first persistence in IndexedDB and bi-directional synchronization with a GitHub or GitLab repository.

Its entire architecture is **100% serverless**. To achieve security without a backend, it uses the native `window.crypto` API to encrypt your Git provider token with a master password that is **never stored**, ensuring your credentials remain secure within your browser.

## Core Architecture: Concepts & Synchronizations

This project is built using the **Concepts and Synchronizations** architecture, which promotes modular, testable, and maintainable code by separating application logic into independent "Concepts" and defining their interactions declaratively.

*   **/src/concepts**: Contains the core logic modules. Each concept manages its own state and is completely independent of the others.
    *   `projectConcept.js`: Manages the list of projects and the currently selected project.
    *   `diagramConcept.js`: Manages diagrams for the current project, including the active diagram's content.
    *   `storageConcept.js`: Handles all interactions with the browser's IndexedDB for persistence.
    *   `securityConcept.js`: Manages all cryptographic operations for token encryption and decryption.
    *   `uiConcept.js`: Manages all direct DOM manipulations and UI state.
    *   `gitAbstractionConcept.js`: Defines a provider-agnostic interface for all Git operations (the "GAL").
    *   `syncConcept.js`: The core agent that orchestrates the bi-directional synchronization logic.
*   **/src/adapters**: Contains provider-specific implementations of the GAL interface.
    *   `github.js`: Adapter for the GitHub REST API.
    *   `gitlab.js`: Adapter for the GitLab REST API.
*   **/src/synchronizations.js**: The "wiring" layer of the application. It listens for events from concepts and triggers actions in other concepts, making all cross-concept interactions explicit and easy to trace.

## ✨ Features

*   **Serverless & Client-Side Only:** No backend required. Runs entirely in the browser.
*   **Local-First Persistence:** All projects and diagrams are saved in your browser's IndexedDB, allowing for fast, offline access.
*   **Multi-Provider Git Sync:** Bi-directional synchronization with both **GitHub** and **GitLab** repositories.
*   **Offline Support:** Create, edit, and delete diagrams while offline. Changes are queued and synced automatically when you reconnect.
*   **Conflict Resolution:** Intelligently handles sync conflicts. If an auto-merge isn't possible, your local changes are saved to a new `_conflict` file, ensuring no data is lost.
*   **Secure Credential Storage:** Uses the native `window.crypto` API (AES-GCM & PBKDF2) to encrypt your access token with a master password.
*   **Project-Based Organization:** Group your diagrams into distinct projects for better management.
*   **Full Diagram Lifecycle:** Create, rename, edit, save, and delete diagrams through a clean UI.
*   **Modern UI:**
    *   Responsive layout with resizable panels.
    *   Split view for code and diagram previews.
    *   Non-blocking "toast" notifications for feedback.
    *   Modals for connecting new projects and unlocking sessions.

## 🔒 Security Model

This app's security model is designed to protect your Personal Access Token (PAT) on the client side.

1.  **User-Provided Token:** You must generate a token from your Git provider with read/write permissions for the repository contents.
2.  **Client-Side Encryption:** When you provide the token and create a master password, the app:
    *   Generates a random `salt` and `iv` (initialization vector).
    *   Uses `PBKDF2` to stretch your password into a strong cryptographic key.
    *   Uses `AES-GCM` to encrypt the token using this key.
    *   Stores the `ciphertext`, `salt`, and `iv` in `IndexedDB`.
3.  **Your password is never stored.**
4.  **In-Memory Session:** When you unlock a project, your password is used to derive the key, decrypt the token, and store the *plaintext token* in a JavaScript variable. This token exists **only in memory** and is gone the moment you close the tab or lock the session.

An attacker would need to exploit an XSS vulnerability *and* capture your password *as you type it* to compromise your token.

## 🚀 How to Use

1.  **Generate an Access Token:**
    *   **For GitHub:** Go to Settings > Developer settings > Fine-grained tokens.
        *   **Repository access:** Select "Only select repositories" and choose your target repo.
        *   **Permissions:** Under "Repository permissions," set **"Contents"** to **"Read & Write"**.
        *   Copy the `ghp_...` token.
    *   **For GitLab:** Go to your Project > Settings > Access Tokens.
        *   Create a **Project Access Token**.
        *   Give it the **"Editor"** role.
        *   Check the `api` scope.
        *   Copy the `glpat_...` token.
2.  **Connect a Project:**
    *   Open the app and click the `+` button in the sidebar.
    *   In the "Connect New Project" modal, select your Git Provider.
    *   Enter your **Repository Path** (e.g., `owner/repo-name`).
    *   Paste your **Personal Access Token**.
    *   Create and confirm a **Master Password**. This password encrypts your token in the browser.
    *   Click "Encrypt & Connect".
3.  **Daily Use:**
    *   Select your project from the dropdown.
    *   The "Unlock Project" modal will appear.
    *   Enter the master password you created for that project.
    *   The session is now unlocked, and synchronization will begin automatically.

## 💻 How to Run Locally

Because this application uses modern JavaScript Modules (`import`/`export`), it must be run from a local web server. You cannot simply open `index.html` from your file system.

1.  **Prerequisites:** Make sure you have Node.js installed.
2.  **Open a Terminal:** Open your terminal or command prompt in the project's root directory.
3.  **Run the Server:**
    ```bash
    npx serve
    ```
4.  **Open the App:** Open your browser and navigate to the local address provided by the command (usually `http://localhost:3000`).

## 🧪 How to Test

This project includes a comprehensive suite of unit and integration tests built with a zero-dependency test runner.

1.  **Prerequisites:** Make sure you have Node.js installed.
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Run Tests:**
    ```bash
    npm test
    ```
    This command will execute all `*.test.js` files within the `/tests` directory, each in its own isolated process.

## 🛠️ Technology

*   **Vanilla JavaScript (ESM):** No frameworks or large libraries.
*   **HTML5 / CSS3**
*   **`IndexedDB`:** For all client-side persistence.
*   **`window.crypto`:** For native, high-performance encryption (AES-GCM & PBKDF2).
*   **`fetch` API:** For all communication with Git provider APIs.
*   **Node.js:** For the testing environment.