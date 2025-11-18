import { createEventBus } from '../utils/eventBus.js';

const bus = createEventBus();

// --- DOM Element References (will be populated on initialize) ---
let codeTab, diagramTab, codeView, diagramView, codeEditor, diagramContainer,
    fileInfo, splitViewBtn, projectSidebar, sidebarToggleBtn, projectSelector,
    diagramList, themeToggle, newProjectBtn, deleteProjectBtn, newDiagramBtn,
    saveDiagramBtn, deleteDiagramBtn, renameDiagramBtn, newModal, newNameInput,
    newCancelBtn, newCreateBtn, uploadInput, downloadBtn, exportMmdBtn,
    exportJsonLdBtn, importJsonLdInput, importJsonLdLabel;

let isSplitView = false;
let isInitialized = false;

function _populateElements() {
    codeTab = document.getElementById('code-tab');
    diagramTab = document.getElementById('diagram-tab');
    codeView = document.getElementById('code-view');
    diagramView = document.getElementById('diagram-view');
    codeEditor = document.getElementById('code-editor');
    diagramContainer = document.getElementById('diagram-container');
    fileInfo = document.getElementById('file-info');
    splitViewBtn = document.getElementById('split-view-btn');
    projectSidebar = document.getElementById('project-sidebar');
    sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    projectSelector = document.getElementById('project-selector');
    diagramList = document.getElementById('diagram-list');
    themeToggle = document.getElementById('theme-toggle');
    newProjectBtn = document.getElementById('new-project-btn');
    deleteProjectBtn = document.getElementById('delete-project-btn');
    newDiagramBtn = document.getElementById('new-btn');
    saveDiagramBtn = document.getElementById('save-btn');
    deleteDiagramBtn = document.getElementById('delete-btn');
    renameDiagramBtn = document.getElementById('rename-btn');
    newModal = document.getElementById('new-modal');
    newNameInput = document.getElementById('new-name');
    newCancelBtn = document.getElementById('new-cancel-btn');
    newCreateBtn = document.getElementById('new-create-btn');
    uploadInput = document.getElementById('upload-diagrams-input');
    downloadBtn = document.getElementById('download-project-btn');
    exportMmdBtn = document.getElementById('export-mmd-btn');
    exportJsonLdBtn = document.getElementById('export-btn');
    importJsonLdInput = document.getElementById('import-file-input');
    importJsonLdLabel = document.getElementById('import-label');
}

// --- Private Functions ---

function _renderProjectSelector({ projects, currentProjectId }) {
    projectSelector.innerHTML = '';
    if (projects.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'No projects yet';
        option.disabled = true;
        projectSelector.appendChild(option);
    } else {
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelector.appendChild(option);
        });
        if (currentProjectId) {
            projectSelector.value = currentProjectId;
        }
    }
}

async function _renderDiagramList({ diagrams, currentDiagramId }) {
    diagramList.innerHTML = '';
    if (diagrams.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No diagrams in this project.';
        li.classList.add('no-diagrams');
        diagramList.appendChild(li);
    } else {
        diagrams.sort((a, b) => a.name.localeCompare(b.name)).forEach(async (diagram) => {
            const li = document.createElement('li');
            li.dataset.diagramId = diagram.id;
            li.title = diagram.name;

            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'diagram-thumbnail';

            try {
                const renderId = `thumbnail-${diagram.id}-${Date.now()}`;
                const { svg } = await mermaid.render(renderId, diagram.content);
                thumbnailContainer.innerHTML = svg;
            } catch (e) {
                thumbnailContainer.innerHTML = 'Syntax Error';
                thumbnailContainer.classList.add('thumbnail-error');
            }

            const nameSpan = document.createElement('span');
            nameSpan.className = 'diagram-name';
            nameSpan.textContent = diagram.name;

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-diagram-btn';
            editBtn.innerHTML = '✏️';
            editBtn.title = 'Rename diagram';

            li.appendChild(thumbnailContainer);
            li.appendChild(nameSpan);
            li.appendChild(editBtn);

            if (diagram.id === currentDiagramId) {
                li.classList.add('active');
            }

            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                bus.notify('ui:renameDiagramClicked', { diagramId: diagram.id });
            });

            li.addEventListener('click', () => bus.notify('ui:diagramSelected', { diagramId: diagram.id }));
            diagramList.appendChild(li);
        });
    }
}

function _renderFileInfo({ projectName, diagramName }) {
    if (diagramName) {
        fileInfo.textContent = `Project: ${projectName || 'Unknown'} / Editing: ${diagramName}`;
    } else {
        fileInfo.textContent = 'New unsaved diagram.';
    }
}

function _renderEditor({ content }) {
    codeEditor.value = content;
}

async function _renderMermaidDiagram({ content }) {
    try {
        const { svg } = await mermaid.render('mermaid-graph', content);
        diagramContainer.innerHTML = svg;
    } catch (error) {
        diagramContainer.innerHTML = `<pre style="color: red;">${error.message}</pre>`;
    }
}

function _applyTheme({ theme }) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.checked = false;
        mermaid.initialize({ startOnLoad: false, theme: 'default' });
    }
}

function _initializeTheme() {
    const savedTheme = localStorage.getItem('mermaid-ide-theme') || 'light';
    _applyTheme({ theme: savedTheme });
}

function _toggleSplitView() {
    const main = document.querySelector('main');
    isSplitView = main.classList.toggle('split-view-active');
    splitViewBtn.classList.toggle('active', isSplitView);

    if (isSplitView) {
        codeView.classList.add('active');
        diagramView.classList.add('active');
        codeTab.setAttribute('disabled', 'true');
        diagramTab.setAttribute('disabled', 'true');
        bus.notify('ui:renderDiagramRequested');
    } else {
        codeTab.removeAttribute('disabled');
        diagramTab.removeAttribute('disabled');
        diagramView.classList.remove('active');
        _switchTab({ tab: 'code' });
    }
}

function _switchTab({ tab }) {
    if (isSplitView) return;

    if (tab === 'diagram') {
        codeTab.classList.remove('active');
        codeView.classList.remove('active');
        diagramTab.classList.add('active');
        diagramView.classList.add('active');
        codeTab.setAttribute('aria-selected', 'false');
        diagramTab.setAttribute('aria-selected', 'true');
        bus.notify('ui:renderDiagramRequested');
    } else {
        diagramTab.classList.remove('active');
        diagramView.classList.remove('active');
        codeTab.classList.add('active');
        codeView.classList.add('active');
        diagramTab.setAttribute('aria-selected', 'false');
        codeTab.setAttribute('aria-selected', 'true');
    }
}

function _downloadFile({ filename, content, mimeType }) {
    const blob = new Blob([content], { type: mimeType });
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
    newNameInput.value = '';
    newModal.style.display = 'flex';
    newNameInput.focus();
}

function _hideNewDiagramModal() {
    newModal.style.display = 'none';
}

function _updateButtonStates({ currentDiagram }) {
    // A diagram is considered "active" for saving/deleting/renaming only if it has an ID.
    // This keeps the buttons disabled for the initial "unsaved" diagram state.
    console.log('[UI] Updating button states based on diagram:', currentDiagram);

    const isDiagramActive = !!currentDiagram?.id;
    console.log(`[UI] Diagram has an ID? ${isDiagramActive}. Setting disabled to: ${!isDiagramActive}`);

    if (saveDiagramBtn) {
        saveDiagramBtn.disabled = !isDiagramActive;
        deleteDiagramBtn.disabled = !isDiagramActive;
        renameDiagramBtn.disabled = !isDiagramActive;
    } else {
        // This log helps catch initialization errors.
        console.error('[UI] Could not find toolbar buttons to update their state.');
    }
}

function _attachEventListeners() {
    projectSelector.addEventListener('change', (event) => {
        bus.notify('ui:projectSelected', { projectId: event.target.value });
    });

    sidebarToggleBtn.addEventListener('click', () => {
        projectSidebar.classList.toggle('sidebar-collapsed');
        sidebarToggleBtn.classList.toggle('sidebar-collapsed');
    });

    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('mermaid-ide-theme', newTheme);
        _applyTheme({ theme: newTheme });
        bus.notify('ui:themeChanged');
    });

    newProjectBtn.addEventListener('click', () => {
        const name = prompt("Enter new project name:");
        if (name && name.trim()) {
            bus.notify('ui:newProjectClicked', { name: name.trim() });
        }
    });

    deleteProjectBtn.addEventListener('click', () => {
        bus.notify('ui:deleteProjectClicked');
    });

    splitViewBtn.addEventListener('click', () => {
        bus.notify('ui:splitViewToggled');
    });

    codeTab.addEventListener('click', () => bus.notify('ui:tabSelected', { tab: 'code' }));
    diagramTab.addEventListener('click', () => bus.notify('ui:tabSelected', { tab: 'diagram' }));

    newDiagramBtn.addEventListener('click', () => {
        _showNewDiagramModal();
    });

    newCancelBtn.addEventListener('click', _hideNewDiagramModal);

    newCreateBtn.addEventListener('click', () => {
        const name = newNameInput.value.trim();
        if (name) {
            bus.notify('ui:createDiagramClicked', { name });
            _hideNewDiagramModal();
        } else {
            alert('Please enter a name for the diagram.');
        }
    });

    saveDiagramBtn.addEventListener('click', () => {
        bus.notify('ui:saveDiagramClicked');
    });

    deleteDiagramBtn.addEventListener('click', () => {
        bus.notify('ui:deleteDiagramClicked');
    });

    renameDiagramBtn.addEventListener('click', () => {
        bus.notify('ui:renameDiagramClicked');
    });

    codeEditor.addEventListener('input', () => {
        bus.notify('ui:editorContentChanged', { content: codeEditor.value });
    });

    downloadBtn.addEventListener('click', () => {
        bus.notify('ui:downloadProjectClicked');
    });

    exportMmdBtn.addEventListener('click', () => {
        bus.notify('ui:exportMmdClicked');
    });

    exportJsonLdBtn.addEventListener('click', () => {
        bus.notify('ui:exportJsonLdClicked');
    });
}

// --- Public Actions ---

const actions = {
    'renderProjectSelector': _renderProjectSelector,
    'renderDiagramList': _renderDiagramList,
    'renderFileInfo': _renderFileInfo,
    'renderEditor': _renderEditor,
    'renderMermaidDiagram': _renderMermaidDiagram,
    'applyTheme': _applyTheme,
    'toggleSplitView': _toggleSplitView,
    'switchTab': _switchTab,
    'downloadFile': _downloadFile,
    'showNewDiagramModal': _showNewDiagramModal,
    'updateButtonStates': _updateButtonStates,
    'hideNewDiagramModal': _hideNewDiagramModal,
    'initialize': () => {
        // Test-only helpers
        if (typeof window === 'undefined') { // Running in Node.js for tests
            actions.setTestElements = (elements) => {
                saveDiagramBtn = elements.saveDiagramBtn;
                deleteDiagramBtn = elements.deleteDiagramBtn;
                renameDiagramBtn = elements.renameDiagramBtn;
            };
            actions.getTestElements = () => ({ saveDiagramBtn, deleteDiagramBtn, renameDiagramBtn });
        }

        // Prevent multiple initializations
        if (isInitialized || typeof document === 'undefined') return;

        _populateElements();
        _attachEventListeners();
        _initializeTheme();
        isInitialized = true;
    },
    'reset': () => {
        isSplitView = false;
        isInitialized = false;
    }
};

export const uiConcept = {
    subscribe: bus.subscribe,
    notify: bus.notify,
    reset: actions.reset, // Expose for testing
    listen(event, payload) {
        if (actions[event]) {
            actions[event](payload);
        }
    }
};