/**
 * @module uiConcept
 * @description Manages all direct DOM manipulations and UI state.
 * It listens to DOM events and notifies the system. It also exposes actions
 * for other concepts to trigger UI updates via the synchronization layer.
 *
 * ARCHITECTURAL NOTE: This concept imports projectConcept and securityConcept for
 * READ-ONLY state access to make UI decisions (e.g., showing/hiding elements based
 * on session state). This is acceptable for presentation logic, but the concept never
 * calls actions on other concepts - all mutations flow through synchronizations.js.
 */

import { projectConcept } from './projectConcept.js';
import { securityConcept } from './securityConcept.js';

let mermaid = globalThis.mermaid;

const subscribers = new Set();

const initialState = {
    projects: [],
    diagrams: [],
    activeProjectId: null, // This is UI state, but driven by projectConcept
    activeDiagram: null,
    theme: 'light',
    isSidebarOpen: true,
    activeView: 'code', // 'code', 'diagram', or 'split'
    activeTab: 'code', // 'code' or 'diagram'
    activeSettingsProject: null, // The project being viewed in the settings modal
    isFullscreen: false,
};

let state = { ...initialState };

let elements = {};

/**
 * Notifies all subscribed listeners of an event.
 * @param {string} event - The name of the event.
 * @param {*} payload - The data associated with the event.
 */
function notify(event, payload) {
    for (const subscriber of subscribers) subscriber(event, payload);
}

function _cacheElements() {
    const ids = [
        'code-tab', 'diagram-tab', 'code-view', 'diagram-view', 'code-editor',
        'diagram-container', 'file-info', 'split-view-btn', 'project-sidebar', 'project-selector', 'diagram-list', 'theme-toggle',
        'new-project-btn', 'delete-project-btn', 'new-btn', 'save-btn',
        'delete-btn', 'rename-btn', 'fullscreen-btn', 'new-modal', 'new-name', 'new-cancel-btn',
        'new-create-btn', 'upload-diagrams-input', 'download-project-btn', 'sidebar-resizer',
        'split-view-resizer', 'connect-project-modal', 'connect-provider',
        'connect-repo-path', 'connect-token', 'connect-password',
        'connect-password-confirm', 'connect-password-error',
        'connect-cancel-btn', 'connect-submit-btn', 'unlock-session-modal',
        'connect-password-single', // New single password input
        'connect-password-creation-group', // New group for create/confirm
        // New elements for local project creation
        'project-settings-btn', // New button
        'project-settings-modal', 'settings-project-name-display',
        'settings-project-provider-display', 'settings-repo-path-group', 'settings-repo-path-display',
        'settings-rename-input', 'settings-rename-btn', 'settings-disconnect-btn',
        'settings-delete-btn', 'settings-close-btn', // New modal elements
        // Elements for connecting a local project to Git
        'settings-connect-to-git-section', 'settings-connect-provider', 'settings-connect-repo-path',
        'settings-connect-token', 'settings-connect-password', 'settings-connect-password-confirm',
        'settings-connect-password-error', 'settings-connect-submit-btn',
        'connect-local-project-name', 'connect-local-project-name-group',
        'connect-git-fields-group', 'connect-master-password-group',
        // Existing elements
        'unlock-project-name', 'unlock-password', 'unlock-error',
        'unlock-cancel-btn', 'unlock-submit-btn', 'toast-container',
        'export-mmd-btn', 'render-btn', 'ontograde-btn', 'pattern-library-btn',
        'sync-status', 'sync-status-icon', 'sync-status-text'
    ];
    ids.forEach(id => elements[id] = document.getElementById(id));
}

function _initialize() {
    _cacheElements();
    _attachEventListeners();
    _initResizers();
}

function _initResizers() {
    const sidebarResizer = elements['sidebar-resizer'];
    const splitViewResizer = elements['split-view-resizer'];
    const sidebar = elements['project-sidebar'];
    const codeView = elements['code-view'];
    const diagramView = elements['diagram-view'];

    const createResizer = (resizer, leftPane, rightPane) => {
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            const onMouseMove = (moveEvent) => {
                if (!isResizing) return;
                const totalWidth = leftPane.offsetWidth + rightPane.offsetWidth;
                const newLeftWidth = moveEvent.clientX - leftPane.getBoundingClientRect().left;
                const newRightWidth = totalWidth - newLeftWidth;

                leftPane.style.width = `${newLeftWidth}px`;
                rightPane.style.width = `${newRightWidth}px`;
            };

            const onMouseUp = () => {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    };

    createResizer(sidebarResizer, sidebar, document.getElementById('main-content'));
    createResizer(splitViewResizer, codeView, diagramView);
}

async function _renderMermaidDiagram({ content }) {
    if (!elements['diagram-container']) return;

    const diagramContent = content || 'graph TD\n  A["No diagram content"]';

    try {
        // First, validate the syntax. This will throw an error on failure.
        await mermaid.parse(diagramContent);

        // If parsing is successful, then render the diagram.
        const { svg } = await mermaid.render(`mermaid-svg-${Date.now()}`, diagramContent);
        elements['diagram-container'].innerHTML = svg;
    } catch (error) {
        console.error("Mermaid syntax or rendering error:", error);
        // Display a clean, contained error message instead of letting Mermaid break the UI.
        // We use .toString() because the error from mermaid.parse() is not a standard Error object.
        const errorMessage = (error.str || error.message || error.toString()).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const errorStyle = `
            height: 100%; 
            overflow-y: auto; 
            white-space: pre-wrap; 
            word-break: break-all;
        `;
        elements['diagram-container'].innerHTML = `<pre class="mermaid-error" style="${errorStyle}"><strong>Syntax Error:</strong>\n${errorMessage}</pre>`;
    }
}

function _renderProjectSelector({ projects, activeProjectId }) {
    if (!elements['project-selector']) return;
    elements['project-selector'].innerHTML = projects
        .map(p => `<option value="${p.id}" ${p.id === activeProjectId ? 'selected' : ''}>${p.name}</option>`)
        .join('');
}
async function _renderSingleThumbnail(diagram) {
    const thumbnailContainer = document.getElementById(`thumbnail-container-${diagram.id}`);
    if (!thumbnailContainer) return;

    let thumbnailSvg = '';
    try {
        await mermaid.parse(diagram.content || 'graph TD; A(( ))');
        const { svg } = await mermaid.render(`thumbnail-${diagram.id}-${Date.now()}`, diagram.content || 'graph TD; A(( ))');
        thumbnailSvg = svg;
    } catch (e) {
        thumbnailSvg = '<div class="thumbnail-error">Invalid Syntax</div>';
    }
    thumbnailContainer.innerHTML = thumbnailSvg;
}

function _renderDiagramList({ diagrams, activeDiagramId }) {
    if (!elements['diagram-list']) return;

    if (!diagrams || diagrams.length === 0) {
        elements['diagram-list'].innerHTML = '<li class="no-diagrams">No diagrams in this project.</li>';
        return;
    }
    
    // 1. Render the list immediately with placeholders
    const listItemsHtml = diagrams.map(d => {
        const isActive = d.id === activeDiagramId ? 'active' : '';
        return `<li data-diagram-id="${d.id}" class="${isActive}">
                    <div class="diagram-thumbnail" id="thumbnail-container-${d.id}">
                        <div class="thumbnail-loader"></div>
                    </div>
                    <span class="diagram-name">${d.title}</span>
                </li>`;
    }).join('');

    elements['diagram-list'].innerHTML = listItemsHtml;

    // 2. Asynchronously render each thumbnail, allowing the UI to remain responsive.
    diagrams.forEach(d => _renderSingleThumbnail(d));
}

function _updateActiveDiagramSelection({ activeDiagramId }) {
    if (!elements['diagram-list']) return;

    // Remove 'active' class from the previously active item
    const currentlyActive = elements['diagram-list'].querySelector('li.active');
    if (currentlyActive) {
        currentlyActive.classList.remove('active');
    }

    // Add 'active' class to the new item
    const newActiveItem = elements['diagram-list'].querySelector(`li[data-diagram-id="${activeDiagramId}"]`);
    if (newActiveItem) {
        newActiveItem.classList.add('active');
    }
}

function _renderEditor({ content }) {
    if (elements['code-editor'] && elements['code-editor'].value !== content) {
        elements['code-editor'].value = content;
        elements['code-editor'].focus(); // Set focus on the editor
    }
}

function _renderFileInfo({ project, diagram }) {
    if (!elements['file-info']) return;
    state.activeDiagram = diagram; // Store the active diagram in UI state
    const projectName = project ? project.name : 'No Project';
    const diagramName = diagram ? diagram.title : 'Unsaved Diagram';
    elements['file-info'].textContent = `${projectName} / ${diagramName}`;
}

function _updateButtonStates({ diagram }) {
    const isSaved = !!(diagram && diagram.id);
    if (elements['save-btn']) elements['save-btn'].disabled = !diagram;
    if (elements['delete-btn']) elements['delete-btn'].disabled = !isSaved;
    if (elements['rename-btn']) elements['rename-btn'].disabled = !isSaved;
    if (elements['export-mmd-btn']) elements['export-mmd-btn'].disabled = !isSaved;
}

/**
 * Displays a toast notification.
 * @param {{message: string, type?: 'info'|'success'|'error', duration?: number}} options
 */
function _showNotification({ message, type = 'info', duration = 5000 }) {
    const container = elements['toast-container'];
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Set timeout to hide and then remove the toast
    setTimeout(() => {
        toast.classList.remove('show');
        // Remove the element after the fade-out animation completes
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, duration);
}

function _updateSyncStatus({ status, message }) {
    const statusEl = elements['sync-status'];
    const iconEl = elements['sync-status-icon'];
    const textEl = elements['sync-status-text'];

    if (!statusEl || !iconEl || !textEl) return;

    // Clear previous status classes
    statusEl.classList.remove('syncing', 'error', 'success');
    textEl.textContent = message || '';

    switch (status) {
        case 'syncing':
            statusEl.classList.add('syncing');
            iconEl.textContent = '🔄';
            break;
        case 'success':
            statusEl.classList.add('success');
            iconEl.textContent = '✅';
            break;
        case 'error':
            statusEl.classList.add('error');
            iconEl.textContent = '❌';
            break;
        case 'idle':
        default:
            iconEl.textContent = '';
            break;
    }
}

function _downloadFile({ filename, content, mimeType }) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function _showNewDiagramModal() {
    if (elements['new-modal']) {
        elements['new-modal'].style.display = 'flex';
        elements['new-name'].value = '';
        elements['new-create-btn'].disabled = true; // Disable create button initially
        elements['new-name'].focus();
    }
}

function _hideNewDiagramModal() {
    if (elements['new-modal']) {
        elements['new-modal'].style.display = 'none';
    }
}

function _showConnectProjectModal() {
    if (elements['connect-project-modal']) {
        elements['connect-project-modal'].style.display = 'flex';
        // Reset form fields
        elements['connect-provider'].value = 'github'; // Default to GitHub
        
        // --- TDD FIX: Handle all password field visibility states ---
        const masterPasswordGroup = elements['connect-master-password-group'];
        const singlePasswordField = elements['connect-password-single'];
        const creationPasswordFieldGroup = elements['connect-password-creation-group'];

        const sessionPasswordExists = securityConcept.state.sessionPassword;
        const anyGitProjectsExist = projectConcept.state.projects.some(p => p.gitProvider !== 'local');

        if (sessionPasswordExists) { // State 2: Subsequent (Unlocked)
            masterPasswordGroup.style.display = 'none';
        } else if (anyGitProjectsExist) { // State 1.5: Unlock for New
            masterPasswordGroup.style.display = 'block';
            singlePasswordField.style.display = 'block';
            creationPasswordFieldGroup.style.display = 'none';
        } else { // State 1: Initial Creation
            masterPasswordGroup.style.display = 'block';
            singlePasswordField.style.display = 'none';
            creationPasswordFieldGroup.style.display = 'block';
        }

        ['connect-repo-path', 'connect-token', 'connect-password', 'connect-password-confirm'].forEach(id => elements[id].value = '');
        elements['connect-submit-btn'].disabled = true;

        // --- FIX: Explicitly update the view to match the default provider ---
        // This ensures the modal resets correctly if it was previously on "Local".
        _updateConnectModalVisibility();
    }
}

function _hideConnectProjectModal() {
    if (elements['connect-project-modal']) {
        elements['connect-project-modal'].style.display = 'none';
    }
}

function _showUnlockSessionModal({ projectName }) {
    if (elements['unlock-session-modal']) {
        elements['unlock-project-name'].textContent = projectName;
        elements['unlock-password'].value = '';
        elements['unlock-error'].style.display = 'none';
        elements['unlock-session-modal'].style.display = 'flex';
        elements['unlock-password'].focus();
    }
}

function _hideUnlockSessionModal() {
    if (elements['unlock-session-modal']) {
        elements['unlock-session-modal'].style.display = 'none';
    }
}

function _showProjectSettingsModal({ project }) {
    if (elements['project-settings-modal']) {
        if (!project) {
            console.error('[UI] showProjectSettingsModal called without a project.');
            return;
        }
        state.activeSettingsProject = project; // Store the project being configured

        // Populate the modal with the project's details
        elements['settings-project-name-display'].textContent = project.name;
        elements['settings-project-provider-display'].textContent = project.gitProvider;
        elements['settings-rename-input'].value = project.name; // Pre-fill the rename input

        // Conditionally show the repository path for Git-connected projects
        const repoPathGroup = elements['settings-repo-path-group'];
        repoPathGroup.style.display = (project.gitProvider !== 'local' && project.repositoryPath) ? 'block' : 'none';
        elements['settings-repo-path-display'].textContent = project.repositoryPath || '';

        // Conditionally show the disconnect button
        const disconnectBtn = elements['settings-disconnect-btn'];
        disconnectBtn.style.display = (project.gitProvider !== 'local') ? 'block' : 'none';

        // Conditionally show the "Connect to Git" section for local projects
        const connectToGitSection = elements['settings-connect-to-git-section'];
        connectToGitSection.style.display = (project.gitProvider === 'local') ? 'block' : 'none';
        
        // --- FIX: Hide password fields if a session password is already set ---
        const settingsPasswordGroup = document.getElementById('settings-connect-master-password-group'); // Get this element directly
        if (settingsPasswordGroup) {
            settingsPasswordGroup.style.display = securityConcept.state.sessionPassword ? 'none' : 'block';
        }

        elements['project-settings-modal'].style.display = 'flex';
    }
}

function _hideProjectSettingsModal() {
    if (elements['project-settings-modal']) {
        elements['project-settings-modal'].style.display = 'none';
        state.activeSettingsProject = null; // Clear the project on hide
    }
}


function _attachEventListeners() {
    elements['project-selector']?.addEventListener('change', (e) => {
        const selectedId = parseInt(e.target.value, 10);
        console.log(`[UI] Project selector changed. Notifying with new project ID: ${selectedId}`);
        notify('ui:projectSelected', { projectId: selectedId });
    });
    elements['new-project-btn']?.addEventListener('click', () => {
        console.log('[UI] "New Project" button clicked. Showing connect modal.');
        _showConnectProjectModal();
    });
    elements['project-settings-btn']?.addEventListener('click', () => {
        console.log('[UI] "Project Settings" button clicked. Showing settings modal.');
        notify('ui:projectSettingsClicked');
    });

    elements['diagram-list']?.addEventListener('click', (e) => {
        const listItem = e.target.closest('li[data-diagram-id]');
        if (listItem) {
            const diagramId = parseInt(listItem.dataset.diagramId, 10);
            notify('ui:diagramSelected', { diagramId });
        }
    });

    // --- NEW "NEW" BUTTON FLOW ---
    // When the user clicks "New", immediately show the modal to get a name.
    elements['new-btn']?.addEventListener('click', () => {
        console.log('[UI] "New Diagram" button clicked.');
        _showNewDiagramModal();
    });
    elements['save-btn']?.addEventListener('click', () => {
        console.log('[UI] "Save Diagram" button clicked.');
        notify('ui:saveDiagramClicked');
    });
    elements['delete-btn']?.addEventListener('click', () => {
        console.log('[UI] "Delete Diagram" button clicked.');
        notify('ui:deleteDiagramClicked');
    });
    elements['rename-btn']?.addEventListener('click', () => {
        const diagram = state.activeDiagram; // Use internal UI state
        if (diagram) {
            const newTitle = prompt('Enter new diagram name:', diagram.title);
            if (newTitle && newTitle.trim() !== '' && newTitle !== diagram.title) {
                notify('ui:renameDiagramClicked', { diagramId: diagram.id, newTitle: newTitle.trim() });
            }
        }
    });
    elements['export-mmd-btn']?.addEventListener('click', () => notify('ui:exportMmdClicked'));
    elements['ontograde-btn']?.addEventListener('click', () => {
        console.log('[UI] OntoGrade button clicked');
        notify('ontoGradeRequested');
    });
    elements['pattern-library-btn']?.addEventListener('click', () => {
        console.log('[UI] Pattern Library button clicked');
        notify('patternLibraryRequested');
    });
    elements['download-project-btn']?.addEventListener('click', () => notify('ui:downloadProjectClicked'));
    elements['code-editor']?.addEventListener('input', (e) => notify('ui:editorContentChanged', { content: e.target.value }));

    // Add validation to the new diagram modal input
    elements['new-name']?.addEventListener('input', (e) => {
        elements['new-create-btn'].disabled = e.target.value.trim() === '';
    });

    elements['new-create-btn']?.addEventListener('click', () => {
        const name = elements['new-name'].value.trim();
        console.log(`[UI] "Create Diagram" in modal clicked. Name: "${name}"`);
        if (name) {
            notify('ui:createDiagramClicked', { name });
            _hideNewDiagramModal();
        }
    });
    elements['new-cancel-btn']?.addEventListener('click', _hideNewDiagramModal);
    elements['render-btn']?.addEventListener('click', () => notify('ui:renderDiagramRequested'));

    elements['connect-cancel-btn']?.addEventListener('click', _hideConnectProjectModal);

    // --- Declare Connect Project Modal elements before use ---
    const connectProviderSelect = elements['connect-provider'];
    const connectLocalProjectNameInput = elements['connect-local-project-name'];
    const connectLocalProjectNameGroup = elements['connect-local-project-name-group'];
    const connectGitFieldsGroup = elements['connect-git-fields-group'];
    const connectMasterPasswordGroup = elements['connect-master-password-group'];
    const connectRepoPathInput = elements['connect-repo-path'];
    const connectTokenInput = elements['connect-token'];
    const connectPasswordInput = elements['connect-password'];
    const connectPasswordConfirmInput = elements['connect-password-confirm'];
    const connectPasswordError = elements['connect-password-error'];

    elements['connect-submit-btn']?.addEventListener('click', (e) => {
        console.log('[UI] "Encrypt & Connect" button clicked.');
        const gitProvider = connectProviderSelect.value;
        let payload;

        if (gitProvider === 'local') {
            payload = {
                gitProvider: 'local',
                name: connectLocalProjectNameInput.value.trim(),
            };
        } else {
            payload = {
                gitProvider: gitProvider,
                name: connectRepoPathInput.value.trim(), // Use repo path as default name for Git projects
                repositoryPath: connectRepoPathInput.value.trim(),
                token: connectTokenInput.value.trim(),
                // Use the correct password field based on visibility
                password: elements['connect-password-single'].style.display !== 'none'
                    ? elements['connect-password-single'].value
                    : elements['connect-password'].value,
            };
        }


        // Basic validation check before notifying
        // The button should only be enabled if all fields are filled and passwords match (if applicable).
        // So, if we reach here, we can assume validation passed.
        notify('ui:connectProjectClicked', payload);
        _hideConnectProjectModal();
    });

    // --- Unlock Session Modal Listeners ---
    elements['unlock-cancel-btn']?.addEventListener('click', _hideUnlockSessionModal);
    elements['unlock-submit-btn']?.addEventListener('click', () => {
        const password = elements['unlock-password'].value;
        if (password) {
            notify('ui:unlockSessionClicked', { password });
        }
    });
    elements['unlock-password']?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') elements['unlock-submit-btn'].click();
    });



    // Tabs
    elements['code-tab']?.addEventListener('click', () => _switchTab('code'));
    elements['diagram-tab']?.addEventListener('click', () => _switchTab('diagram'));
    elements['split-view-btn']?.addEventListener('click', () => _toggleSplitView());

    // Fullscreen toggle
    elements['fullscreen-btn']?.addEventListener('click', () => _toggleFullscreen());

    // --- Connect Project Modal Listeners (elements already declared above) ---
    const connectPasswordSingle = elements['connect-password-single'];
    const connectSubmitBtn = elements['connect-submit-btn'];

    const updateConnectModalVisibility = () => {
        const isLocal = connectProviderSelect.value === 'local';
        connectLocalProjectNameGroup.style.display = isLocal ? 'block' : 'none';
        connectGitFieldsGroup.style.display = isLocal ? 'none' : 'block';
        // Master password group is only for Git providers
        connectMasterPasswordGroup.style.display = isLocal ? 'none' : 'block';
        _updateConnectButtonState();
    };

    const _updateConnectButtonState = () => {
        const isLocal = connectProviderSelect.value === 'local';
        let allFilled;
        let passwordsMatch = true;

        if (isLocal) {
            allFilled = connectLocalProjectNameInput.value.trim() !== '';
        } else {
            const sessionPasswordExists = securityConcept.state.sessionPassword;
            const anyGitProjectsExist = projectConcept.state.projects.some(p => p.gitProvider !== 'local');

            const singlePasswordRequired = !sessionPasswordExists && anyGitProjectsExist;
            const creationPasswordsRequired = !sessionPasswordExists && !anyGitProjectsExist;

            allFilled = connectRepoPathInput.value.trim() !== '' && connectTokenInput.value.trim() !== '' &&
                        (!singlePasswordRequired || connectPasswordSingle.value) &&
                        (!creationPasswordsRequired || (connectPasswordInput.value && connectPasswordConfirmInput.value));

            if (creationPasswordsRequired) {
                passwordsMatch = connectPasswordInput.value === connectPasswordConfirmInput.value;
                connectPasswordError.style.display = (connectPasswordInput.value && connectPasswordConfirmInput.value && !passwordsMatch) ? 'block' : 'none';
            }
        }
        connectSubmitBtn.disabled = !(allFilled && passwordsMatch);
    };

    connectProviderSelect?.addEventListener('change', updateConnectModalVisibility);
    connectLocalProjectNameInput?.addEventListener('input', _updateConnectButtonState);
    [connectRepoPathInput, connectTokenInput, connectPasswordInput, connectPasswordConfirmInput, connectPasswordSingle].forEach(el => el?.addEventListener('input', _updateConnectButtonState));

    // Initial call to set correct visibility and button state
    updateConnectModalVisibility();

    elements['upload-diagrams-input']?.addEventListener('change', (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      console.log(`[UI] ${files.length} file(s) selected for upload.`);

      const fileReadPromises = Array.from(files).map(file => {
          return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (event) => resolve({ name: file.name, content: event.target.result });
              reader.onerror = (error) => reject(error);
              reader.readAsText(file);
          });
      });

      Promise.all(fileReadPromises)
          .then(diagrams => {
              console.log('[UI] Files read successfully. Notifying with diagram data:', diagrams);
              notify('ui:diagramsUploaded', { diagrams });
          })
          .catch(error => {
              console.error('[UI] Error reading uploaded files:', error);
              _showNotification({ message: 'Error reading uploaded files.', type: 'error' });
          });

      // Reset the input so the user can upload the same file again if they wish
      e.target.value = '';
  });

  elements['settings-rename-btn']?.addEventListener('click', () => {
    const project = state.activeSettingsProject;
    const newName = elements['settings-rename-input'].value.trim();

    if (!project) {
        return console.error('[UI] Rename clicked, but no project is active in settings.');
    }
    if (!newName) {
        return uiConcept.actions.showNotification({ message: 'Project name cannot be empty.', type: 'error' });
    }
    if (newName === project.name) {
        return uiConcept.actions.showNotification({ message: 'New name is the same as the current name.', type: 'info' });
    }

    console.log(`[UI] Rename confirmed for project ${project.id} to "${newName}".`);
    notify('ui:renameProjectConfirmed', { projectId: project.id, newName });
  });

  elements['settings-disconnect-btn']?.addEventListener('click', () => {
    const project = state.activeSettingsProject;
    if (!project) {
        return console.error('[UI] Disconnect clicked, but no project is active in settings.');
    }

    if (confirm(`Are you sure you want to disconnect the project "${project.name}" from its Git repository?\n\nThis will turn it into a local-only project. It will NOT affect your remote Git repository.`)) {
        console.log(`[UI] Disconnect confirmed for project ${project.id}.`);
        notify('ui:disconnectProjectConfirmed', { projectId: project.id });
    }
  });

  // --- Project Settings -> Connect to Git Listeners ---
  const settingsConnectInputs = ['settings-connect-repo-path', 'settings-connect-token', 'settings-connect-password', 'settings-connect-password-confirm'];
  const settingsConnectSubmitBtn = elements['settings-connect-submit-btn'];
  const settingsConnectPasswordError = elements['settings-connect-password-error'];

  const _updateSettingsConnectButtonState = () => {
    const allFilled = settingsConnectInputs.every(id => elements[id].value.trim() !== '');
    const passwordsMatch = elements['settings-connect-password'].value === elements['settings-connect-password-confirm'].value;

    settingsConnectPasswordError.style.display = (elements['settings-connect-password'].value && elements['settings-connect-password-confirm'].value && !passwordsMatch) ? 'block' : 'none';
    settingsConnectSubmitBtn.disabled = !(allFilled && passwordsMatch);
  };

  settingsConnectInputs.forEach(id => elements[id]?.addEventListener('input', _updateSettingsConnectButtonState));

  settingsConnectSubmitBtn?.addEventListener('click', () => {
    const project = state.activeSettingsProject;
    if (!project) {
      return console.error('[UI] Save Connection clicked, but no project is active in settings.');
    }

    const payload = {
      projectId: project.id,
      gitProvider: elements['settings-connect-provider'].value,
      repositoryPath: elements['settings-connect-repo-path'].value.trim(),
      token: elements['settings-connect-token'].value.trim(),
      password: elements['settings-connect-password'].value,
    };

    console.log(`[UI] Connecting existing project ${project.id} to Git.`);
    notify('ui:connectExistingLocalProjectConfirmed', payload);
  });

  // Initialize the button state
  if (settingsConnectSubmitBtn) _updateSettingsConnectButtonState();


  elements['settings-delete-btn']?.addEventListener('click', () => {
    const project = state.activeSettingsProject;
    if (!project) {
        return console.error('[UI] Delete clicked, but no project is active in settings.');
    }

    if (confirm(`Are you sure you want to delete the project "${project.name}" locally?\n\nThis will remove the project and all its diagrams from this browser. It will NOT affect your remote Git repository.`)) {
        console.log(`[UI] Delete confirmed for project ${project.id}.`);
        notify('ui:deleteLocalProjectConfirmed', { projectId: project.id });
    }
  });

  elements['settings-close-btn']?.addEventListener('click', _hideProjectSettingsModal);
}

/**
 * A helper function to manage the visibility of sections within the Connect Project modal
 * based on the selected provider.
 */
function _updateConnectModalVisibility() {
    const isLocal = elements['connect-provider'].value === 'local';
    elements['connect-local-project-name-group'].style.display = isLocal ? 'block' : 'none';
    elements['connect-git-fields-group'].style.display = isLocal ? 'none' : 'block';
}

function _switchTab(tabName) {
    state.activeTab = tabName;
    const isSplit = state.activeView === 'split';

    if (!isSplit) {
        elements['code-tab'].classList.toggle('active', tabName === 'code');
        elements['diagram-tab'].classList.toggle('active', tabName === 'diagram');
        elements['code-view'].classList.toggle('active', tabName === 'code');
        elements['diagram-view'].classList.toggle('active', tabName === 'diagram');
    }

    if (tabName === 'diagram' || isSplit) {
        notify('ui:renderDiagramRequested');
    }
}

function _toggleSplitView() {
    if (state.activeView !== 'split') {
        state.activeView = 'split';
        // Add a class to the parent container to enable flexbox layout
        document.getElementById('content-area').classList.add('split-view-active');
        elements['split-view-resizer'].style.display = 'block';
        elements['code-view'].classList.add('active', 'split-view');
        elements['diagram-view'].classList.add('active', 'split-view');
        elements['split-view-btn'].classList.add('active');
        // Gray out Code and Diagram tabs
        elements['code-tab'].classList.add('split-active-tab');
        elements['diagram-tab'].classList.add('split-active-tab');
        // Reset widths to allow resizing
        elements['code-view'].style.width = '50%';
        elements['diagram-view'].style.width = '50%';
        notify('ui:renderDiagramRequested');

    } else {
        state.activeView = state.activeTab;
        // Remove the class from the parent container
        elements['split-view-resizer'].style.display = 'none';
        document.getElementById('content-area').classList.remove('split-view-active');
        elements['code-view'].classList.remove('split-view');
        elements['diagram-view'].classList.remove('split-view');
        elements['split-view-btn'].classList.remove('active');
        // Restore Code and Diagram tabs
        elements['code-tab'].classList.remove('split-active-tab');
        elements['diagram-tab'].classList.remove('split-active-tab');
        _switchTab(state.activeTab); // Re-apply single-tab view
    }
}

function _toggleFullscreen() {
    state.isFullscreen = !state.isFullscreen;
    document.body.classList.toggle('fullscreen-active', state.isFullscreen);

    const btn = elements['fullscreen-btn'];
    if (btn) {
        if (state.isFullscreen) {
            btn.textContent = '⛶';
        } else {
            btn.textContent = '⇱';
        }
    }
}

function _reset() {
    state = { ...initialState };
    elements = {};
}

/**
 * Injects a mermaid library instance, primarily for testing purposes.
 * @param {object} mockMermaid - The mock mermaid object.
 */
function _setMermaid(mockMermaid) {
    mermaid = mockMermaid;
}

export const uiConcept = {
    subscribe(fn) { subscribers.add(fn); },
    unsubscribe(fn) { subscribers.delete(fn); },
    notify,
    getState: () => ({ ...state }),
    reset: _reset,
    setMermaid: _setMermaid,
    actions: {
        initialize: _initialize,
        renderMermaidDiagram: _renderMermaidDiagram,
        renderProjectSelector: _renderProjectSelector,
        renderDiagramList: _renderDiagramList,
        updateActiveDiagramSelection: _updateActiveDiagramSelection,
        renderEditor: _renderEditor,
        renderFileInfo: _renderFileInfo,
        updateButtonStates: _updateButtonStates,
        downloadFile: _downloadFile,
        showNotification: _showNotification,
        updateSyncStatus: _updateSyncStatus,
        showNewDiagramModal: _showNewDiagramModal,
        showConnectProjectModal: _showConnectProjectModal,
        hideConnectProjectModal: _hideConnectProjectModal,
        showProjectSettingsModal: _showProjectSettingsModal,
        hideProjectSettingsModal: _hideProjectSettingsModal,
        showUnlockSessionModal: _showUnlockSessionModal,
        hideUnlockSessionModal: _hideUnlockSessionModal,
        switchTab: _switchTab,
        toggleSplitView: _toggleSplitView,
    }
};