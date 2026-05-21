import { storageConcept } from './concepts/storageConcept.js';
import { projectConcept } from './concepts/projectConcept.js';
import { diagramConcept } from './concepts/diagramConcept.js';
import { uiConcept } from './concepts/uiConcept.js';
import { tracer } from './utils/tracer.js';
import { Storage } from './storage/storage.js';
import { appConfirm, appPrompt, appToast } from './components/dialogs.js';
import { migrateLegacyRootIfNeeded } from './storage/migration.js';

// --- Synchronization Rules ---

// When storage finishes listing projects, update the project concept's state.
storageConcept.subscribe((event, payload) => {
    if (event === 'projectsListed') {
        projectConcept.listen('setProjects', payload);
    }
    if (event === 'projectCreated' && payload.isDefault) {
        // This is the new synchronization for the default project.
        const defaultDiagramContent = `graph TD
    A[Start] --> B{Is it?};
    B -- Yes --> C[OK];
    C --> D[End];
    B -- No --> E[Find out];
    E --> B;`;
        diagramConcept.listen('createDiagram', { name: 'generic', projectId: payload.id, content: defaultDiagramContent });
    }
    if (event === 'projectCreated') {
        projectConcept.listen('handleProjectCreated', payload);
    }
    if (event === 'databaseOpened') {
        // Now that the database is open, we can safely load projects.
        projectConcept.listen('loadProjects');
    }
    if (event === 'projectDeleted') {
        projectConcept.listen('loadProjects'); // Reload to update the list
    }
    // --- Storage -> Diagram ---
    if (event === 'diagramsListed') {
        // Get the project from the projectConcept state to provide context.
        const projectState = projectConcept.getState();
        const project = projectState.projects.find(p => p.id === payload.projectId);
        diagramConcept.listen('setDiagrams', { diagrams: payload.diagrams, project });
    }
    if (event === 'diagramLoaded') {
        diagramConcept.listen('handleDiagramLoaded', payload);
    }
    if (event === 'diagramSaved') {
        diagramConcept.listen('handleDiagramSaved', payload);
    }
    if (event === 'diagramDeleted') {
        diagramConcept.listen('handleDiagramDeleted', payload);
    }
});

// When the project concept wants to do something with storage, tell storage.
projectConcept.subscribe((event, payload) => {
    if (event.startsWith('do:')) {
        storageConcept.listen(event, payload);
    }
    // --- Project -> Diagram ---
    if (event === 'projectChanged') {
        diagramConcept.listen('loadDiagrams', payload);
    }
    if (event === 'projectsUpdated' && payload.currentProjectId === null) {
        diagramConcept.listen('loadDiagrams', { projectId: null });
    }
    // --- Project -> UI ---
    if (event === 'projectsUpdated') {
        uiConcept.listen('renderProjectSelector', payload);
        // This is the fix: When projects are updated (e.g., on initial load),
        // immediately trigger the diagram loading for the current project.
        // This is now handled by the 'projectChanged' event, which is more robust.
        // No action needed here anymore.
    }
});

// When the diagram concept wants to do something with storage, tell storage.
diagramConcept.subscribe((event, payload) => {
    if (event === 'do:downloadFile') {
        // This is a UI action, not a storage action.
        uiConcept.listen('downloadFile', payload);
    } else if (event.startsWith('do:')) {
        storageConcept.listen(event, payload);
    }
    // --- Diagram -> UI ---
    if (event === 'diagramsUpdated') {
        uiConcept.listen('renderDiagramList', payload);
        tracer.endTrace(); // End the trace after the final UI update is triggered.
    }
    if (event === 'diagramSelectionChanged') {
        uiConcept.listen('updateActiveDiagramSelection', payload);
        tracer.endTrace(); // End the trace after the selection update.
    }
    if (event === 'do:showNewDiagramModal') {
        uiConcept.listen('showNewDiagramModal');
    }
    if (event === 'diagramContentChanged') {
        // This is for split-view auto-render.
        // We can check a flag on the uiConcept if we want to be more specific.
        const { currentDiagram } = diagramConcept.getState();
        if (currentDiagram) {
            uiConcept.listen('renderMermaidDiagram', { content: currentDiagram.content });
        }
    }
    if (event === 'diagramAfterSave') {
        // Save of the currently-open diagram. Don't re-render the editor or
        // mermaid view (the user may still be typing); just refresh the
        // button state (the diagram now has an id, so Save/Delete/Rename
        // should enable) and the file-info pane.
        const projectState = projectConcept.getState();
        const currentProject = projectState.projects.find((p) => p.id === projectState.currentProjectId);
        uiConcept.listen('renderFileInfo', {
            projectName: currentProject?.name,
            diagramName: payload.diagram?.name || '',
        });
        uiConcept.listen('updateButtonStates', { currentDiagram: payload.diagram });
    }
    if (event === 'diagramContentLoaded') {
        const projectState = projectConcept.getState();
        const currentProject = projectState.projects.find(p => p.id === projectState.currentProjectId);

        // When no diagram is loaded, the editor should be empty to show the placeholder.
        uiConcept.listen('renderEditor', { content: payload.diagram?.content ?? '' });
        uiConcept.listen('renderFileInfo', {
            projectName: currentProject?.name,
            diagramName: payload.diagram?.name || '',
        });
        // When content is loaded, update button states. A diagram being loaded means they should be enabled.
        // If payload.diagram is null, it means no diagram is active, so they should be disabled.
        uiConcept.listen('updateButtonStates', { currentDiagram: payload.diagram });
        // When no diagram is loaded, show a helpful message in the diagram view.
        const initialContent = payload.diagram?.content || 'graph TD\n  A["Create a new diagram or select one from the list"];';
        uiConcept.listen('renderMermaidDiagram', { content: initialContent });

    }
});

// When the UI emits an event, update the appropriate state concept.
uiConcept.subscribe((event, payload) => {
    if (event === 'ui:projectSelected') {
        // Flush the editor's live value into state BEFORE the project switch.
        // The setDiagrams handler will then see the accurate `isDirty` state
        // and persist the old diagram before clearing/auto-selecting.
        const { currentDiagram } = diagramConcept.getState();
        if (currentDiagram) {
            const live = uiConcept.getEditorContent();
            if (live !== null && live !== currentDiagram.content) {
                diagramConcept.listen('updateCurrentDiagramContent', { content: live });
            }
        }
        projectConcept.listen('setCurrentProject', payload);
    }
    if (event === 'ui:diagramSelected') {
        // Flush the editor's current value into state BEFORE the switch.
        // The editor-input → state update is debounced at 300ms, so a fast
        // click could otherwise lose the last few keystrokes (which is
        // exactly when save-on-switch matters most).
        const { currentDiagram } = diagramConcept.getState();
        if (currentDiagram) {
            const live = uiConcept.getEditorContent();
            if (live !== null && live !== currentDiagram.content) {
                diagramConcept.listen('updateCurrentDiagramContent', { content: live });
            }
        }
        diagramConcept.listen('setCurrentDiagram', payload);
    }
    if (event === 'ui:newProjectClicked') {
        const { name, mode } = payload || {};
        if (mode === 'fsa') {
            // FSA path. Three sub-cases:
            //  - Storage already ready: create directly.
            //  - Storage has root but permission lapsed: re-grant first.
            //  - Storage has no root: pick a folder first.
            if (Storage.isReady()) {
                projectConcept.listen('createProject', { name, mode });
            } else if (Storage.hasRoot()) {
                // Permission lapsed. The click IS a user gesture, so ensurePermission
                // is allowed to run; on success, create the project.
                Storage.ensurePermission()
                    .then(() => projectConcept.listen('createProject', { name, mode }))
                    .catch(() => uiConcept.listen('showReconnectBanner'));
            } else {
                // First-ever FSA project: pick the root folder.
                Storage.pickRoot()
                    .then((result) => {
                        if (result === null) {
                            uiConcept.listen('clearPendingFsa');
                            return;
                        }
                        if (result === false) {
                            uiConcept.listen('showForeignFolderModal');
                            return;
                        }
                        // result === true: root adopted. Show sync info modal; project
                        // creation happens on the modal's "Sounds good" click.
                        uiConcept.listen('showSyncInfoModal');
                    })
                    .catch((err) => {
                        console.error('pickRoot failed:', err);
                        uiConcept.listen('clearPendingFsa');
                    });
            }
        } else {
            projectConcept.listen('createProject', { name, mode });
        }
    }
    if (event === 'ui:autoSaveToggled') {
        diagramConcept.listen('setAutoSave', { enabled: !!payload?.enabled });
    }
    if (event === 'ui:reconnectClicked') {
        Storage.ensurePermission()
            .then(() => uiConcept.listen('hideReconnectBanner'))
            .catch((err) => { console.error('ensurePermission failed:', err); });
    }
    if (event === 'ui:foreignFolderNest') {
        const { name } = payload || {};
        Storage.adoptForeignFolder(true)
            .then(() => uiConcept.listen('showSyncInfoModal'))
            .catch((err) => {
                console.error('adoptForeignFolder failed:', err);
                uiConcept.listen('clearPendingFsa');
                appToast({ message: 'Could not adopt the folder: ' + (err?.message || err), kind: 'error', timeout: 5000 });
            });
    }
    if (event === 'ui:foreignFolderRepick') {
        Storage.cancelForeignAdoption();
        // Re-fire the picker from the click's gesture context.
        Storage.pickRoot()
            .then((result) => {
                if (result === null) { uiConcept.listen('clearPendingFsa'); return; }
                if (result === false) { uiConcept.listen('showForeignFolderModal'); return; }
                uiConcept.listen('showSyncInfoModal');
            })
            .catch((err) => {
                console.error('pickRoot retry failed:', err);
                uiConcept.listen('clearPendingFsa');
            });
    }
    if (event === 'ui:syncInfoAcknowledged') {
        const { name } = payload || {};
        // If we were in the middle of an export flow (the user picked a folder
        // because Storage wasn't ready), surface the export modal now.
        if (_pendingExportInfo) {
            const info = _pendingExportInfo;
            _pendingExportInfo = null;
            const { diagrams } = diagramConcept.getState();
            uiConcept.listen('showExportProjectModal', {
                sourceProjectId: info.sourceProjectId,
                sourceName: info.sourceName,
                diagramCount: diagrams.length,
                defaultDestName: info.sourceName,
            });
        } else if (name) {
            projectConcept.listen('createProject', { name, mode: 'fsa' });
        }
    }
    if (event === 'ui:exportProjectClicked') {
        const { projects, currentProjectId } = projectConcept.getState();
        const source = projects.find((p) => p.id === currentProjectId);
        if (!source || source.mode !== 'idb') return; // button is hidden in this case anyway

        const showModal = () => {
            const { diagrams } = diagramConcept.getState();
            uiConcept.listen('showExportProjectModal', {
                sourceProjectId: source.id,
                sourceName: source.name,
                diagramCount: diagrams.length,
                defaultDestName: source.name,
            });
        };

        if (Storage.isReady()) {
            showModal();
        } else if (Storage.hasRoot()) {
            Storage.ensurePermission()
                .then(showModal)
                .catch(() => uiConcept.listen('showReconnectBanner'));
        } else {
            // No folder yet — chain through pickRoot. After the pick (and
            // foreign-folder/sync-info handshake), syncInfoAcknowledged sees
            // _pendingExportInfo and opens the export modal instead of
            // creating a new FSA project.
            _pendingExportInfo = { sourceProjectId: source.id, sourceName: source.name };
            Storage.pickRoot()
                .then((result) => {
                    if (result === null) { _pendingExportInfo = null; return; }
                    if (result === false) { uiConcept.listen('showForeignFolderModal'); return; }
                    uiConcept.listen('showSyncInfoModal');
                })
                .catch(() => { _pendingExportInfo = null; });
        }
    }
    if (event === 'ui:exportProjectConfirmed') {
        const { sourceProjectId, destName } = payload || {};
        storageConcept.listen('do:exportProject', { sourceProjectId, destName });
    }
    if (event === 'ui:syncInfoRepick') {
        Storage.pickRoot()
            .then((result) => {
                if (result === null) { uiConcept.listen('clearPendingFsa'); return; }
                if (result === false) { uiConcept.listen('showForeignFolderModal'); return; }
                uiConcept.listen('showSyncInfoModal');
            })
            .catch((err) => {
                console.error('pickRoot (sync-info repick) failed:', err);
                uiConcept.listen('clearPendingFsa');
            });
    }
    if (event === 'ui:deleteProjectClicked') {
        (async () => {
            const { currentProjectId, projects } = projectConcept.getState();
            const currentProject = projects.find((p) => p.id === currentProjectId);
            if (!currentProject) return;
            const ok = await appConfirm({
                message: `Are you sure you want to delete project "${currentProject.name}"? This cannot be undone.`,
                confirmLabel: 'Delete',
                danger: true,
            });
            if (ok) projectConcept.listen('deleteProject', { projectId: currentProjectId });
        })();
    }
    if (event === 'ui:createDiagramClicked') {
        const { currentProjectId } = projectConcept.getState();
        if (currentProjectId) {
            diagramConcept.listen('createDiagram', { name: payload.name, projectId: currentProjectId });
        } else {
            appToast({ message: 'Please select a project first.', kind: 'error' });
        }
    }
    if (event === 'ui:editorContentChanged') {
        // Use the debounced version for performance
        diagramConcept.listen('debouncedUpdateCurrentDiagramContent', payload);
    }
    if (event === 'ui:saveDiagramClicked') {
        diagramConcept.listen('saveCurrentDiagram');
    }
    if (event === 'ui:deleteDiagramClicked') {
        (async () => {
            const { currentDiagram } = diagramConcept.getState();
            if (!currentDiagram) return;
            const ok = await appConfirm({
                message: `Are you sure you want to delete "${currentDiagram.name}"?`,
                confirmLabel: 'Delete',
                danger: true,
            });
            if (ok) diagramConcept.listen('deleteDiagram', { diagramId: currentDiagram.id });
        })();
    }
    if (event === 'ui:renameDiagramClicked') {
        (async () => {
            const { currentDiagram } = diagramConcept.getState();
            if (!currentDiagram) return;
            const newName = await appPrompt({
                label: 'Enter new name:',
                initialValue: currentDiagram.name,
                placeholder: 'diagram name',
            });
            if (newName && newName.trim()) {
                diagramConcept.listen('renameDiagram', { diagramId: currentDiagram.id, newName: newName.trim() });
            }
        })();
    }
    if (event === 'ui:splitViewToggled') {
        uiConcept.listen('toggleSplitView');
    }
    if (event === 'ui:tabSelected') {
        uiConcept.listen('switchTab', payload);
    }
    if (event === 'ui:renderDiagramRequested') {
        const { currentDiagram } = diagramConcept.getState();
        if (currentDiagram) {
            uiConcept.listen('renderMermaidDiagram', { content: currentDiagram.content });
        }
    }
    if (event === 'ui:exportMmdClicked') {
        // This logic is now handled in diagramConcept.js
        diagramConcept.listen('exportCurrentDiagramAsMmd');
    }
    if (event === 'ui:exportJsonLdClicked') {
        const { currentDiagram } = diagramConcept.getState();
        if (currentDiagram) {
            const jsonLd = {
                '@context': { '@vocab': 'https://schema.org/', 'MermaidModel': 'https://example.org/ontology/MermaidModel' },
                '@id': `urn:uuid:${crypto.randomUUID()}`,
                '@type': 'MermaidModel',
                name: currentDiagram.name,
                content: currentDiagram.content,
                dateModified: new Date().toISOString(),
            };
            uiConcept.listen('downloadFile', {
                filename: `${currentDiagram.name}.jsonld`,
                content: JSON.stringify(jsonLd, null, 2),
                mimeType: 'application/ld+json'
            });
        } else {
            appToast({ message: 'Please open a diagram to export.', kind: 'error' });
        }
    }
    if (event === 'ui:downloadProjectClicked') {
        const { diagrams } = diagramConcept.getState();
        const { projects, currentProjectId } = projectConcept.getState();
        const currentProject = projects.find(p => p.id === currentProjectId);
        // This requires JSZip, which is a global. We can handle this directly in the UI concept or here.
        // For now, let's keep the logic here.
        if (currentProject && diagrams.length > 0) {
            const zip = new JSZip();
            diagrams.forEach(d => zip.file(`${d.name}.mmd`, d.content));
            zip.generateAsync({ type: "blob" }).then(blob => {
                uiConcept.listen('downloadFile', {
                    filename: `${currentProject.name}.zip`,
                    content: blob,
                    mimeType: 'application/zip'
                });
            });
        } else {
            appToast({ message: 'Current project is empty or not selected.', kind: 'error' });
        }
    }
    if (event === 'ui:uploadMmdClicked') {
        console.log('Synchronization layer received ui:uploadMmdClicked event.');
        const { files } = payload;
        const { currentProjectId } = projectConcept.getState();

        if (!currentProjectId) {
            console.warn('Upload cancelled: No project selected.');
            appToast({ message: 'Please select a project before uploading diagrams.', kind: 'error' });
            return;
        }

        if (!files || files.length === 0) {
            console.log('No files were selected in the file dialog.');
            return;
        }

        console.log(`Processing ${files.length} uploaded file(s).`);
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const name = file.name.endsWith('.mmd') ? file.name.slice(0, -4) : file.name;
                console.log(`Creating diagram "${name}" in project ID ${currentProjectId}.`);
                diagramConcept.listen('createDiagram', { name, content, projectId: currentProjectId });
            };
            reader.readAsText(file);
        }
    }
});

// Tracks an in-flight Export-to-folder flow when the user clicked "Export"
// before Storage was ready. Set when the export click kicks off pickRoot;
// cleared when the export modal is shown (via syncInfoAcknowledged) or when
// the flow is abandoned.
let _pendingExportInfo = null;

function updateExportButtonVisibility() {
    const { projects, currentProjectId } = projectConcept.getState();
    const current = projects.find((p) => p.id === currentProjectId);
    uiConcept.listen('setExportButtonVisible', current?.mode === 'idb');
}

function updateReconnectBannerState() {
    // Show whenever Storage has a stored root but permission isn't granted.
    // This covers two cases: (a) an FSA project is open and unusable, and
    // (b) the user had FSA projects previously — those won't appear in the
    // selector until permission is restored, so the banner is the only way
    // back. Cheap to dismiss visually for users on IDB-only.
    if (Storage.hasRoot() && !Storage.isReady()) {
        Storage.detectPersistentPermissions()
            .then((persistent) => uiConcept.listen('showReconnectBanner', { persistent }))
            .catch(() => uiConcept.listen('showReconnectBanner'));
    } else {
        uiConcept.listen('hideReconnectBanner');
    }
}

/**
 * Initializes the application by setting up the UI and starting the database connection.
 * This should be called from the main entry point of the application (e.g., index.html).
 */
export function initializeApp() {
    uiConcept.listen('initialize'); // Set up the initial UI state (like theme)

    // Sync the autosave checkbox to whatever was persisted in localStorage.
    // diagramConcept reads localStorage at module load, so getState() already
    // reflects the user's last choice; we just need to mirror it to the DOM.
    uiConcept.listen('setAutoSaveToggle', { enabled: diagramConcept.getState().autoSaveEnabled });

    // Reconnect-banner reflects Storage permission state. Re-evaluate on
    // every permissionchange and on project-list updates.
    Storage.on('permissionchange', (state) => {
        updateReconnectBannerState();
        // After a grant: try migration (it's a no-op if nothing to do) then
        // refresh projects so FSA folders re-appear in the selector. The
        // refresh sources from fsaRegistry post-migration, falling back to
        // legacy folder listing otherwise.
        if (state === 'granted') {
            migrateLegacyRootIfNeeded()
                .catch(() => {})
                .finally(() => projectConcept.listen('loadProjects'));
        }
    });
    projectConcept.subscribe((event) => {
        if (event === 'projectChanged' || event === 'projectsUpdated') {
            updateReconnectBannerState();
            updateExportButtonVisibility();
        }
    });

    storageConcept.listen('do:open'); // This will eventually trigger a chain reaction (incl. Storage.init).
}

// --- DEBUGGING: Expose concepts and the FSA Storage capability to the console ---
// Storage is exposed for hand-testing during phase 1 development. The full
// initializeApp() integration (Storage.init() on app start) lands in 1.8.
if (typeof window !== 'undefined') {
    window.concepts = { storageConcept, projectConcept, diagramConcept, uiConcept };
    window.Storage = Storage;
}