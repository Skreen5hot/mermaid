import { createEventBus } from '../utils/eventBus.js';
import { tracer } from '../utils/tracer.js';

let mermaid = globalThis.mermaid;

const bus = createEventBus();

const initialState = {
    theme: 'light',
    isSidebarOpen: true,
    activeView: 'code', // 'code', 'diagram', or 'split'
    activeTab: 'code', // 'code' or 'diagram'
    isFullscreen: false,
};

let state = { ...initialState };

let elements = {};

function _cacheElements() {
    const ids = [
        'code-tab', 'diagram-tab', 'code-view', 'diagram-view', 'code-editor',
        'diagram-container', 'file-info', 'split-view-btn', 'project-sidebar', 'project-selector', 'diagram-list', 'theme-toggle',
        'new-project-btn', 'delete-project-btn', 'new-btn', 'save-btn',
        'delete-btn', 'rename-btn', 'fullscreen-btn', 'new-modal', 'new-name', 'new-cancel-btn',
        'new-create-btn', 'upload-diagrams-input', 'download-project-btn', 'sidebar-resizer',
        'split-view-resizer',
        'export-mmd-btn', 'render-btn',
        // 1.5 additions: FSA UI surface.
        'reconnect-banner', 'reconnect-btn', 'persistent-note',
        'new-project-modal', 'new-project-name', 'new-project-cancel-btn', 'new-project-create-btn',
        'new-project-mode-fsa-label',
        'foreign-folder-modal', 'foreign-folder-nest-btn', 'foreign-folder-repick-btn',
        'sync-info-modal', 'sync-info-ok-btn', 'sync-info-repick-btn',
        // Phase 2 additions: IDB → FSA export.
        'export-project-btn', 'export-project-modal', 'export-source-name',
        'export-diagram-count', 'export-dest-name', 'export-cancel-btn', 'export-confirm-btn',
    ];
    ids.forEach(id => elements[id] = document.getElementById(id));
}

// FSA flow state held in the UI concept. The synchronization layer reads it
// off the events we emit (ui:syncInfoAcknowledged, ui:foreignFolderNest)
// rather than introspecting this module.
let _pendingFsaProjectName = null;
function _setPendingFsa(name) { _pendingFsaProjectName = name; }
function _clearPendingFsa() { _pendingFsaProjectName = null; }
function _isChromiumFsa() { return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'; }

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

// Parses an SVG string from mermaid.render and returns the <svg> element,
// or null if parsing failed. Replaces `container.innerHTML = svg`, which
// is the canonical Trusted-Types-incompatible sink.
function _svgFromString(svgString) {
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    if (doc.documentElement.tagName === 'parsererror' || doc.documentElement.namespaceURI !== 'http://www.w3.org/2000/svg') {
        return null;
    }
    return doc.documentElement;
}

function _renderMermaidErrorInto(container, error) {
    console.error('Mermaid syntax or rendering error:', error);
    // Mermaid's parse errors aren't always Error objects — fall back through
    // a few shapes. The text goes through textContent so the user's diagram
    // body can't escape the error pane.
    const errorMessage = error.str || error.message || error.toString();

    const pre = document.createElement('pre');
    pre.className = 'mermaid-error';
    pre.style.cssText = 'height: 100%; overflow-y: auto; white-space: pre-wrap; word-break: break-all;';

    const heading = document.createElement('strong');
    heading.textContent = 'Syntax Error:';
    pre.appendChild(heading);
    pre.appendChild(document.createTextNode('\n' + errorMessage));

    container.replaceChildren(pre);
}

async function _renderMermaidDiagram({ content }) {
    const container = elements['diagram-container'];
    if (!container) return;

    const diagramContent = content || 'graph TD\n  A["No diagram content"]';

    try {
        await mermaid.parse(diagramContent);
        const { svg } = await mermaid.render(`mermaid-svg-${Date.now()}`, diagramContent);
        const svgEl = _svgFromString(svg);
        if (!svgEl) throw new Error('Mermaid produced unparseable SVG');
        container.replaceChildren(svgEl);
    } catch (error) {
        _renderMermaidErrorInto(container, error);
    }
}

function _renderProjectSelector({ projects, currentProjectId }) {
    const selector = elements['project-selector'];
    if (!selector) return;
    const options = projects.map((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === currentProjectId) opt.selected = true;
        return opt;
    });
    selector.replaceChildren(...options);
}

// Mermaid uses the SVG id as a CSS selector internally; our compound ids
// ("idb:N", "fsa:folder/name") contain ":" and "/" which are illegal there.
// Replace with underscores to produce a safe-for-CSS id without losing
// uniqueness against other diagrams.
function _safeIdForMermaid(id) {
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function _thumbnailErrorNode(message) {
    const errEl = document.createElement('div');
    errEl.className = 'thumbnail-error';
    errEl.textContent = message;
    return errEl;
}

async function _renderSingleThumbnail(diagram) {
    const thumbnailContainer = document.getElementById(`thumbnail-container-${diagram.id}`);
    if (!thumbnailContainer) return;

    const safeId = _safeIdForMermaid(diagram.id);
    const source = diagram.content || 'graph TD; A(( ))';
    try {
        await mermaid.parse(source);
        const { svg } = await mermaid.render(`thumbnail-${safeId}-${Date.now()}`, source);
        const svgEl = _svgFromString(svg);
        if (!svgEl) throw new Error('Mermaid produced unparseable SVG');
        thumbnailContainer.replaceChildren(svgEl);
    } catch (e) {
        thumbnailContainer.replaceChildren(_thumbnailErrorNode('Invalid Syntax'));
    }
}

function _buildDiagramListItem(diagram, currentDiagramId) {
    const li = document.createElement('li');
    li.dataset.diagramId = diagram.id;
    if (diagram.id === currentDiagramId) li.classList.add('active');

    const thumbnail = document.createElement('div');
    thumbnail.className = 'diagram-thumbnail';
    thumbnail.id = `thumbnail-container-${diagram.id}`;

    const loader = document.createElement('div');
    loader.className = 'thumbnail-loader';
    thumbnail.appendChild(loader);

    const name = document.createElement('span');
    name.className = 'diagram-name';
    name.textContent = diagram.name;

    li.appendChild(thumbnail);
    li.appendChild(name);
    return li;
}

function _renderDiagramList({ diagrams, currentDiagramId }) {
    const list = elements['diagram-list'];
    if (!list) return;

    if (!diagrams || diagrams.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'no-diagrams';
        empty.textContent = 'No diagrams in this project.';
        list.replaceChildren(empty);
        return;
    }

    // 1. Render the list immediately with placeholders.
    const items = diagrams.map((d) => _buildDiagramListItem(d, currentDiagramId));
    list.replaceChildren(...items);

    // 2. Asynchronously render each thumbnail; UI stays responsive.
    diagrams.forEach((d) => _renderSingleThumbnail(d));

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
        elements['code-editor'].focus(); // Set focus on the editor
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
        elements['new-create-btn'].disabled = true; // Disable create button initially
        elements['new-name'].focus();
    }
}

function _hideNewDiagramModal() {
    if (elements['new-modal']) {
        elements['new-modal'].style.display = 'none';
    }
}

// --- New Project modal ---

function _showNewProjectModal() {
    if (!elements['new-project-modal']) return;
    // Reset form state every time we open.
    if (elements['new-project-name']) elements['new-project-name'].value = '';
    const idbRadio = document.querySelector?.('input[name="new-project-mode"][value="idb"]');
    if (idbRadio) idbRadio.checked = true;

    // Disable FSA radio on non-Chromium and visually mark the option.
    const fsaRadio = document.querySelector?.('input[name="new-project-mode"][value="fsa"]');
    const fsaLabel = elements['new-project-mode-fsa-label'];
    if (fsaRadio && fsaLabel) {
        const ok = _isChromiumFsa();
        fsaRadio.disabled = !ok;
        if (ok) {
            fsaLabel.classList.remove('disabled');
            fsaLabel.title = '';
        } else {
            fsaLabel.classList.add('disabled');
            fsaLabel.title = 'Requires Chrome, Edge, or another Chromium browser.';
        }
    }

    _updateNewProjectCreateBtn();
    elements['new-project-modal'].style.display = 'flex';
    elements['new-project-name']?.focus();
}

function _hideNewProjectModal() {
    if (elements['new-project-modal']) {
        elements['new-project-modal'].style.display = 'none';
    }
}

function _getSelectedNewProjectMode() {
    const checked = document.querySelector?.('input[name="new-project-mode"]:checked');
    return checked ? checked.value : null;
}

function _updateNewProjectCreateBtn() {
    const btn = elements['new-project-create-btn'];
    if (!btn) return;
    const name = elements['new-project-name']?.value.trim() || '';
    const mode = _getSelectedNewProjectMode();
    const fsaUnavailable = mode === 'fsa' && !_isChromiumFsa();
    btn.disabled = name.length === 0 || !mode || fsaUnavailable;
}

// --- Foreign folder modal ---

function _showForeignFolderModal() {
    if (elements['foreign-folder-modal']) elements['foreign-folder-modal'].style.display = 'flex';
}

function _hideForeignFolderModal() {
    if (elements['foreign-folder-modal']) elements['foreign-folder-modal'].style.display = 'none';
}

// --- Sync info modal ---

function _showSyncInfoModal() {
    if (elements['sync-info-modal']) elements['sync-info-modal'].style.display = 'flex';
}

function _hideSyncInfoModal() {
    if (elements['sync-info-modal']) elements['sync-info-modal'].style.display = 'none';
}

// --- Export Project modal (Phase 2) ---

let _pendingExport = null; // { sourceProjectId, sourceName }

function _showExportProjectModal({ sourceProjectId, sourceName, diagramCount, defaultDestName } = {}) {
    _pendingExport = { sourceProjectId, sourceName };
    if (elements['export-source-name']) elements['export-source-name'].textContent = sourceName || '';
    if (elements['export-diagram-count']) elements['export-diagram-count'].textContent = String(diagramCount ?? 0);
    if (elements['export-dest-name']) elements['export-dest-name'].value = defaultDestName || sourceName || '';
    if (elements['export-confirm-btn']) elements['export-confirm-btn'].disabled = false;
    if (elements['export-project-modal']) elements['export-project-modal'].style.display = 'flex';
    elements['export-dest-name']?.focus();
}

function _hideExportProjectModal() {
    if (elements['export-project-modal']) elements['export-project-modal'].style.display = 'none';
}

function _setExportButtonVisible(visible) {
    const btn = elements['export-project-btn'];
    if (!btn) return;
    btn.style.display = visible ? '' : 'none';
}

// --- Reconnect banner ---

function _showReconnectBanner({ persistent = false } = {}) {
    const banner = elements['reconnect-banner'];
    const note = elements['persistent-note'];
    if (banner) banner.classList.add('visible');
    if (note) note.classList.toggle('visible', !!persistent);
}

function _hideReconnectBanner() {
    const banner = elements['reconnect-banner'];
    if (banner) banner.classList.remove('visible');
}

function _attachEventListeners() {
    elements['project-selector']?.addEventListener('change', (e) => bus.notify('ui:projectSelected', { projectId: e.target.value }));
    elements['new-project-btn']?.addEventListener('click', () => _showNewProjectModal());
    elements['delete-project-btn']?.addEventListener('click', () => bus.notify('ui:deleteProjectClicked'));

    // --- New Project Modal listeners ---
    elements['new-project-name']?.addEventListener('input', () => _updateNewProjectCreateBtn());
    elements['new-project-cancel-btn']?.addEventListener('click', () => _hideNewProjectModal());
    elements['new-project-create-btn']?.addEventListener('click', () => {
        const name = elements['new-project-name']?.value.trim();
        const mode = _getSelectedNewProjectMode();
        if (!name || !mode) return;
        // For FSA without a root, the sync layer will pick first; remember the name.
        if (mode === 'fsa') _setPendingFsa(name);
        _hideNewProjectModal();
        bus.notify('ui:newProjectClicked', { name, mode });
    });
    // Radios: update create-btn enable state when mode changes.
    const radios = document.querySelectorAll?.('input[name="new-project-mode"]');
    radios?.forEach((r) => r.addEventListener('change', () => _updateNewProjectCreateBtn()));

    // --- Foreign folder modal listeners ---
    elements['foreign-folder-nest-btn']?.addEventListener('click', () => {
        _hideForeignFolderModal();
        bus.notify('ui:foreignFolderNest', { name: _pendingFsaProjectName });
    });
    elements['foreign-folder-repick-btn']?.addEventListener('click', () => {
        _hideForeignFolderModal();
        bus.notify('ui:foreignFolderRepick', { name: _pendingFsaProjectName });
    });

    // --- Sync info modal listeners ---
    elements['sync-info-ok-btn']?.addEventListener('click', () => {
        _hideSyncInfoModal();
        const name = _pendingFsaProjectName;
        _clearPendingFsa();
        bus.notify('ui:syncInfoAcknowledged', { name });
    });
    elements['sync-info-repick-btn']?.addEventListener('click', () => {
        _hideSyncInfoModal();
        bus.notify('ui:syncInfoRepick', { name: _pendingFsaProjectName });
    });

    // --- Reconnect banner ---
    elements['reconnect-btn']?.addEventListener('click', () => bus.notify('ui:reconnectClicked'));

    // --- Export project modal (Phase 2) ---
    elements['export-project-btn']?.addEventListener('click', () => bus.notify('ui:exportProjectClicked'));
    elements['export-cancel-btn']?.addEventListener('click', () => {
        _hideExportProjectModal();
        _pendingExport = null;
    });
    elements['export-dest-name']?.addEventListener('input', () => {
        const btn = elements['export-confirm-btn'];
        if (btn) btn.disabled = !(elements['export-dest-name']?.value.trim());
    });
    elements['export-confirm-btn']?.addEventListener('click', () => {
        const destName = elements['export-dest-name']?.value.trim();
        if (!destName || !_pendingExport) return;
        const { sourceProjectId } = _pendingExport;
        _pendingExport = null;
        _hideExportProjectModal();
        bus.notify('ui:exportProjectConfirmed', { sourceProjectId, destName });
    });

    elements['diagram-list']?.addEventListener('click', (e) => {
        const listItem = e.target.closest('li[data-diagram-id]');
        if (listItem) {
            tracer.startTrace('Select Diagram');
            // Diagram ids are opaque compound strings ("idb:N" / "fsa:folder/name").
            const diagramId = listItem.dataset.diagramId;
            bus.notify('ui:diagramSelected', { diagramId });
        }
    });

    // --- NEW "NEW" BUTTON FLOW ---
    // When the user clicks "New", immediately show the modal to get a name.
    elements['new-btn']?.addEventListener('click', () => _showNewDiagramModal());

    elements['save-btn']?.addEventListener('click', () => bus.notify('ui:saveDiagramClicked'));
    elements['delete-btn']?.addEventListener('click', () => bus.notify('ui:deleteDiagramClicked'));
    elements['rename-btn']?.addEventListener('click', () => bus.notify('ui:renameDiagramClicked'));
    elements['export-mmd-btn']?.addEventListener('click', () => bus.notify('ui:exportMmdClicked'));

    elements['download-project-btn']?.addEventListener('click', () => bus.notify('ui:downloadProjectClicked'));

    elements['code-editor']?.addEventListener('input', (e) => bus.notify('ui:editorContentChanged', { content: e.target.value }));

    // Add validation to the new diagram modal input
    elements['new-name']?.addEventListener('input', (e) => {
        elements['new-create-btn'].disabled = e.target.value.trim() === '';
    });

    elements['new-create-btn']?.addEventListener('click', () => {
        const name = elements['new-name'].value.trim();
        if (name) {
            bus.notify('ui:createDiagramClicked', { name });
            _hideNewDiagramModal();
        }
    });
    elements['new-cancel-btn']?.addEventListener('click', _hideNewDiagramModal);

    elements['render-btn']?.addEventListener('click', () => bus.notify('ui:renderDiagramRequested'));

    // Tabs
    elements['code-tab']?.addEventListener('click', () => _switchTab('code'));
    elements['diagram-tab']?.addEventListener('click', () => _switchTab('diagram'));
    elements['split-view-btn']?.addEventListener('click', () => _toggleSplitView());

    // Fullscreen toggle
    elements['fullscreen-btn']?.addEventListener('click', () => _toggleFullscreen());
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
        // Gray out Code and Diagram tabs
        elements['code-tab'].classList.add('split-active-tab');
        elements['diagram-tab'].classList.add('split-active-tab');
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
    // 1.5 additions: FSA flow modal/banner drivers.
    'showForeignFolderModal': _showForeignFolderModal,
    'hideForeignFolderModal': _hideForeignFolderModal,
    'showSyncInfoModal': _showSyncInfoModal,
    'hideSyncInfoModal': _hideSyncInfoModal,
    'showReconnectBanner': _showReconnectBanner,
    'hideReconnectBanner': _hideReconnectBanner,
    'clearPendingFsa': _clearPendingFsa,
    // Phase 2 additions.
    'showExportProjectModal': _showExportProjectModal,
    'hideExportProjectModal': _hideExportProjectModal,
    'setExportButtonVisible': _setExportButtonVisible,
};

/**
 * Injects a mermaid library instance, primarily for testing purposes.
 * @param {object} mockMermaid - The mock mermaid object.
 */
function _setMermaid(mockMermaid) {
    mermaid = mockMermaid;
}

export const uiConcept = {
    subscribe: bus.subscribe,
    notify: bus.notify,
    getState: () => ({ ...state }),
    reset: _reset,
    listen(event, payload) {
        if (actions[event]) {
            actions[event](payload);
        }
    },
    setMermaid: _setMermaid,
};