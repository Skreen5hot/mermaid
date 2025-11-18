import { createEventBus } from '../utils/eventBus.js';
import { tracer } from '../utils/tracer.js';

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
        'new-create-btn', 'upload-diagrams-input', 'download-project-btn', 'sidebar-resizer',
        'split-view-resizer',
        'export-mmd-btn', 'render-btn'
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

function _renderProjectSelector({ projects, currentProjectId }) {
    if (!elements['project-selector']) return;
    elements['project-selector'].innerHTML = projects
        .map(p => `<option value="${p.id}" ${p.id === currentProjectId ? 'selected' : ''}>${p.name}</option>`)
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

function _renderDiagramList({ diagrams, currentDiagramId }) {
    if (!elements['diagram-list']) return;

    if (!diagrams || diagrams.length === 0) {
        elements['diagram-list'].innerHTML = '<li class="no-diagrams">No diagrams in this project.</li>';
        return;
    }
    
    // 1. Render the list immediately with placeholders
    const listItemsHtml = diagrams.map(d => {
        const isActive = d.id === currentDiagramId ? 'active' : '';
        return `<li data-diagram-id="${d.id}" class="${isActive}">
                    <div class="diagram-thumbnail" id="thumbnail-container-${d.id}">
                        <div class="thumbnail-loader"></div>
                    </div>
                    <span class="diagram-name">${d.name}</span>
                </li>`;
    }).join('');

    elements['diagram-list'].innerHTML = listItemsHtml;

    // 2. Asynchronously render each thumbnail, allowing the UI to remain responsive.
    diagrams.forEach(d => _renderSingleThumbnail(d));

    // Log the end of the list rendering process
    tracer.logStep('UI: Finished rendering diagram list placeholders');
}

function _updateActiveDiagramSelection({ currentDiagramId }) {
    if (!elements['diagram-list']) return;

    // Remove 'active' class from the previously active item
    const currentlyActive = elements['diagram-list'].querySelector('li.active');
    if (currentlyActive) {
        currentlyActive.classList.remove('active');
    }

    // Add 'active' class to the new item
    const newActiveItem = elements['diagram-list'].querySelector(`li[data-diagram-id="${currentDiagramId}"]`);
    if (newActiveItem) {
        newActiveItem.classList.add('active');
    }
    tracer.logStep('UI: Updated active diagram selection');
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
        const listItem = e.target.closest('li[data-diagram-id]');
        if (listItem) {
            tracer.startTrace('Select Diagram');
            const diagramId = parseInt(listItem.dataset.diagramId, 10);
            bus.notify('ui:diagramSelected', { diagramId });
        }
    });

    elements['new-btn']?.addEventListener('click', () => bus.notify('ui:diagramSelected', { diagramId: null }));
    elements['save-btn']?.addEventListener('click', () => bus.notify('ui:saveDiagramClicked'));
    elements['delete-btn']?.addEventListener('click', () => bus.notify('ui:deleteDiagramClicked'));
    elements['rename-btn']?.addEventListener('click', () => bus.notify('ui:renameDiagramClicked'));
    elements['export-mmd-btn']?.addEventListener('click', () => bus.notify('ui:exportMmdClicked'));

    elements['download-project-btn']?.addEventListener('click', () => bus.notify('ui:downloadProjectClicked'));

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
        elements['split-view-resizer'].style.display = 'block';
        elements['code-view'].classList.add('active', 'split-view');
        elements['diagram-view'].classList.add('active', 'split-view');
        elements['split-view-btn'].classList.add('active');
        // Reset widths to allow resizing
        elements['code-view'].style.width = '50%';
        elements['diagram-view'].style.width = '50%';
        bus.notify('ui:renderDiagramRequested');
    } else {
        state.activeView = state.activeTab;
        // Remove the class from the parent container
        elements['split-view-resizer'].style.display = 'none';
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
    'updateActiveDiagramSelection': _updateActiveDiagramSelection,
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