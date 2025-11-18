import { createEventBus } from '../utils/eventBus.js';

const bus = createEventBus();

const initialState = {
    theme: 'light',
    isSidebarOpen: true,
    activeView: 'code', // 'code', 'diagram', or 'split'
    activeTab: 'code', // 'code' or 'diagram'
};

let state = { ...initialState };

let elements = {};

function _cacheElements() {
    const ids = [
        'code-tab', 'diagram-tab', 'code-view', 'diagram-view', 'code-editor',
        'diagram-container', 'file-info', 'split-view-btn', 'project-sidebar',
        'sidebar-toggle-btn', 'project-selector', 'diagram-list', 'theme-toggle',
        'new-project-btn', 'delete-project-btn', 'new-btn', 'save-btn',
        'delete-btn', 'rename-btn', 'new-modal', 'new-name', 'new-cancel-btn',
        'new-create-btn', 'upload-diagrams-input', 'download-project-btn',
        'export-mmd-btn', 'render-btn'
    ];
    ids.forEach(id => elements[id] = document.getElementById(id));
}

function _initialize() {
    _cacheElements();
    _attachEventListeners();
    // Other initialization logic...
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

function _renderProjectSelector({ projects, currentProjectId }) {
    if (!elements['project-selector']) return;
    elements['project-selector'].innerHTML = projects
        .map(p => `<option value="${p.id}" ${p.id === currentProjectId ? 'selected' : ''}>${p.name}</option>`)
        .join('');
}

async function _renderDiagramList({ diagrams, currentDiagramId }) {
    if (!elements['diagram-list']) return;

    if (!diagrams || diagrams.length === 0) {
        elements['diagram-list'].innerHTML = '<li class="no-diagrams">No diagrams in this project.</li>';
        return;
    }

    const listItemsHtml = await Promise.all(diagrams.map(async (d) => {
        let thumbnailSvg = '';
        try {
            // Ensure valid syntax before rendering to avoid errors
            await mermaid.parse(d.content || 'graph TD; A(( ))');
            const { svg } = await mermaid.render(`thumbnail-${d.id}-${Date.now()}`, d.content || 'graph TD; A(( ))');
            thumbnailSvg = svg;
        } catch (e) {
            thumbnailSvg = '<div class="thumbnail-error">Invalid Syntax</div>';
        }

        return `<li data-diagram-id="${d.id}" class="${d.id === currentDiagramId ? 'active' : ''}">
                    <div class="diagram-thumbnail">${thumbnailSvg}</div>
                    <span class="diagram-name">${d.name}</span>
                </li>`;
    }));

    elements['diagram-list'].innerHTML = listItemsHtml.join('');
}

function _renderEditor({ content }) {
    if (elements['code-editor'] && elements['code-editor'].value !== content) {
        elements['code-editor'].value = content;
    }
}

function _renderFileInfo({ projectName, diagramName }) {
    if (!elements['file-info']) return;
    elements['file-info'].textContent = `${projectName || 'No Project'} / ${diagramName || 'Unsaved Diagram'}`;
}

function _updateButtonStates({ currentDiagram }) {
    const diagramExists = !!currentDiagram;
    const isSaved = diagramExists && currentDiagram.id !== null;

    if (elements['save-btn']) elements['save-btn'].disabled = !diagramExists;
    if (elements['delete-btn']) elements['delete-btn'].disabled = !isSaved;
    if (elements['rename-btn']) elements['rename-btn'].disabled = !isSaved;
    if (elements['export-mmd-btn']) elements['export-mmd-btn'].disabled = !isSaved;
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
        elements['new-name'].focus();
    }
}

function _hideNewDiagramModal() {
    if (elements['new-modal']) {
        elements['new-modal'].style.display = 'none';
    }
}

function _attachEventListeners() {
    elements['project-selector']?.addEventListener('change', (e) => bus.notify('ui:projectSelected', { projectId: e.target.value }));
    elements['new-project-btn']?.addEventListener('click', () => {
        const name = prompt('Enter new project name:');
        if (name) bus.notify('ui:newProjectClicked', { name });
    });
    elements['delete-project-btn']?.addEventListener('click', () => bus.notify('ui:deleteProjectClicked'));

    elements['diagram-list']?.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            bus.notify('ui:diagramSelected', { diagramId: parseInt(e.target.dataset.diagramId, 10) });
        }
    });

    elements['new-btn']?.addEventListener('click', () => bus.notify('ui:diagramSelected', { diagramId: null }));
    elements['save-btn']?.addEventListener('click', () => bus.notify('ui:saveDiagramClicked'));
    elements['delete-btn']?.addEventListener('click', () => bus.notify('ui:deleteDiagramClicked'));
    elements['rename-btn']?.addEventListener('click', () => bus.notify('ui:renameDiagramClicked'));
    elements['export-mmd-btn']?.addEventListener('click', () => bus.notify('ui:exportMmdClicked'));

    elements['code-editor']?.addEventListener('input', (e) => bus.notify('ui:editorContentChanged', { content: e.target.value }));

    elements['new-create-btn']?.addEventListener('click', () => {
        const name = elements['new-name'].value.trim();
        if (name) {
            bus.notify('ui:createDiagramClicked', { name });
            _hideNewDiagramModal();
        }
    });
    elements['new-cancel-btn']?.addEventListener('click', _hideNewDiagramModal);

    elements['render-btn']?.addEventListener('click', () => bus.notify('ui:renderDiagramRequested'));

    // Sidebar toggle
    elements['sidebar-toggle-btn']?.addEventListener('click', () => {
        elements['project-sidebar'].classList.toggle('closed');
        elements['sidebar-toggle-btn'].classList.toggle('closed');
    });

    // Tabs
    elements['code-tab']?.addEventListener('click', () => _switchTab('code'));
    elements['diagram-tab']?.addEventListener('click', () => _switchTab('diagram'));
    elements['split-view-btn']?.addEventListener('click', () => _toggleSplitView());
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
        bus.notify('ui:renderDiagramRequested');
    }
}

function _toggleSplitView() {
    if (state.activeView !== 'split') {
        state.activeView = 'split';
        // Add a class to the parent container to enable flexbox layout
        document.getElementById('content-area').classList.add('split-view-active');
        elements['code-view'].classList.add('active', 'split-view');
        elements['diagram-view'].classList.add('active', 'split-view');
        elements['split-view-btn'].classList.add('active');
        bus.notify('ui:renderDiagramRequested');
    } else {
        state.activeView = state.activeTab;
        // Remove the class from the parent container
        document.getElementById('content-area').classList.remove('split-view-active');
        elements['code-view'].classList.remove('split-view');
        elements['diagram-view'].classList.remove('split-view');
        elements['split-view-btn'].classList.remove('active');
        _switchTab(state.activeTab); // Re-apply single-tab view
    }
}

function _reset() {
    state = { ...initialState };
    elements = {};
}

const actions = {
    'initialize': _initialize,
    'renderMermaidDiagram': _renderMermaidDiagram,
    'renderProjectSelector': _renderProjectSelector,
    'renderDiagramList': _renderDiagramList,
    'renderEditor': _renderEditor,
    'renderFileInfo': _renderFileInfo,
    'updateButtonStates': _updateButtonStates,
    'downloadFile': _downloadFile,
    'showNewDiagramModal': _showNewDiagramModal,
    'switchTab': _switchTab,
    'toggleSplitView': _toggleSplitView,
};

export const uiConcept = {
    subscribe: bus.subscribe,
    notify: bus.notify,
    getState: () => ({ ...state }),
    reset: _reset,
    listen(event, payload) {
        if (actions[event]) {
            actions[event](payload);
        }
    }
};