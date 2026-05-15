import { createEventBus } from '../utils/eventBus.js';
import { tracer } from '../utils/tracer.js';

const bus = createEventBus();

const AUTOSAVE_PREF_KEY = 'mermaidide.autoSave';
const AUTOSAVE_IDLE_MS = 5000;

function _loadAutoSavePref() {
    try {
        if (typeof localStorage === 'undefined') return false;
        return localStorage.getItem(AUTOSAVE_PREF_KEY) === '1';
    } catch {
        return false;
    }
}

function _persistAutoSavePref(enabled) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(AUTOSAVE_PREF_KEY, enabled ? '1' : '0');
        }
    } catch { /* private mode, quota exhausted — ignore */ }
}

const initialState = {
    diagrams: [],
    currentDiagram: null, // { id, name, content, projectId, isDirty }
    autoSaveEnabled: _loadAutoSavePref(),
};

let state = { ...initialState };

// Autosave timer is module-private so user-facing state isn't cluttered.
let _autoSaveTimer = null;

function _cancelAutoSave() {
    if (_autoSaveTimer !== null) {
        clearTimeout(_autoSaveTimer);
        _autoSaveTimer = null;
    }
}

function _scheduleAutoSave() {
    _cancelAutoSave();
    if (!state.autoSaveEnabled) return;
    if (!state.currentDiagram) return;
    if (state.currentDiagram.id == null) return;   // unsaved diagrams need a name first
    if (!state.currentDiagram.isDirty) return;
    _autoSaveTimer = setTimeout(() => {
        _autoSaveTimer = null;
        // Re-check at fire time — state may have changed since we scheduled.
        if (state.autoSaveEnabled
            && state.currentDiagram
            && state.currentDiagram.id != null
            && state.currentDiagram.isDirty) {
            _saveCurrentDiagram();
        }
    }, AUTOSAVE_IDLE_MS);
}

function _setAutoSave({ enabled }) {
    state.autoSaveEnabled = !!enabled;
    _persistAutoSavePref(state.autoSaveEnabled);
    if (state.autoSaveEnabled) {
        _scheduleAutoSave(); // may fire later if currently dirty
    } else {
        _cancelAutoSave();
    }
    bus.notify('autoSaveToggled', { enabled: state.autoSaveEnabled });
}

// --- Utility ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

function _loadDiagrams({ projectId }) {
    if (projectId) {
        bus.notify('do:listDiagrams', { projectId });
    } else {
        // No project selected, clear the list and notify that no diagram is loaded.
        _setDiagrams({ diagrams: [], project: null });
        state.currentDiagram = null;
        bus.notify('diagramContentLoaded', { diagram: null });
    }
}

function _setDiagrams({ diagrams, project }) {
    state.diagrams = diagrams;

    // Project-switch coherence: if the previously-current diagram belongs to
    // a DIFFERENT project than the one we just loaded, the user has navigated
    // away from it. Save it (so any unsaved edits don't vanish), then clear
    // it so we don't accidentally route subsequent typing or save-on-switch
    // calls to the wrong project's diagram. The auto-select block below then
    // picks an appropriate diagram from the new project.
    if (state.currentDiagram
        && state.currentDiagram.projectId !== undefined
        && project?.id != null
        && state.currentDiagram.projectId !== project.id) {
        _cancelAutoSave();
        if (state.currentDiagram.isDirty && state.currentDiagram.id != null) {
            bus.notify('do:saveDiagram', {
                diagramData: state.currentDiagram,
                becomeCurrent: false,
            });
        }
        state.currentDiagram = null;
    }

    // Default-Project bootstrap: if a fresh Default Project has no diagrams,
    // create the seeded one. (Non-default projects manage their own seed.)
    if (diagrams.length === 0 && state.currentDiagram === null) {
        if (project?.name === 'Default Project') {
            const defaultContent = `graph TD\n    A[Start] --> B{Is it?};\n    B -- Yes --> C[OK];\n    C --> D[End];\n    B -- No --> E[Find out];\n    E --> B;`;
            _createDiagram({ name: 'generic', projectId: project.id, content: defaultContent });
            return; // The save/reload process will handle the rest.
        }
    }

    bus.notify('diagramsUpdated', { diagrams: state.diagrams, currentDiagramId: state.currentDiagram?.id });

    // Auto-select: if we entered a project with diagrams but nothing is
    // currently selected, pick the first one. Keeps state.currentDiagram in
    // sync with what the user is looking at, so typing always lands in the
    // right file and save-on-switch can route correctly.
    if (state.currentDiagram === null && diagrams.length > 0) {
        _setCurrentDiagram({ diagramId: diagrams[0].id });
        return;
    }

    // Empty project (no diagrams, not Default Project) — clear the editor.
    if (state.currentDiagram === null) {
        bus.notify('diagramContentLoaded', { diagram: null });
    }
}

function _setCurrentDiagram({ diagramId }) {
    // Save-on-switch: if the currently-open diagram has unsaved edits,
    // persist them before loading the new one. Without this, users who
    // click between diagrams faster than the 5-second autosave debounce
    // lose work silently — and autosave being on creates a false sense of
    // safety. The save is dispatched with becomeCurrent:false so it doesn't
    // try to claim the new selection when it lands; the user has already
    // moved on.
    if (state.currentDiagram?.isDirty && state.currentDiagram?.id != null) {
        _cancelAutoSave();
        bus.notify('do:saveDiagram', {
            diagramData: state.currentDiagram,
            becomeCurrent: false,
        });
    }
    if (diagramId) {
        bus.notify('do:loadDiagram', { diagramId });
    } else {
        // This case handles when no diagram is selected, creating the unsaved state.
        _initializeUnsavedDiagram({ content: '' });
    }
}

function _handleDiagramLoaded(diagram) {
    _cancelAutoSave();
    state.currentDiagram = diagram ? { ...diagram, isDirty: false } : null;
    tracer.logStep('DiagramConcept: Diagram data loaded from storage');
    bus.notify('diagramContentLoaded', { diagram: state.currentDiagram });
    bus.notify('diagramSelectionChanged', { currentDiagramId: state.currentDiagram?.id });
}

function _createDiagram({ name, projectId, content }) {
    const newDiagramData = {
        name,
        projectId,
        content: content || 'graph TD;\n  A-->B;',
    };
    // becomeCurrent:true — the new diagram should be selected after save.
    bus.notify('do:saveDiagram', { diagramData: newDiagramData, becomeCurrent: true });
}

function _saveCurrentDiagram() {
    if (!state.currentDiagram) {
        console.warn('Save ignored: No current diagram exists in the application state.');
        return;
    }
    if (state.currentDiagram.id) {
        // Saving the currently-open diagram. It's already current; don't
        // re-select on completion.
        bus.notify('do:saveDiagram', { diagramData: state.currentDiagram, becomeCurrent: false });
    } else {
        // No ID — unsaved scratch. Prompt for a name; the modal flow goes
        // through _createDiagram, which sets becomeCurrent:true.
        bus.notify('do:showNewDiagramModal');
    }
}

function _exportCurrentDiagramAsMmd() {
    const { currentDiagram } = state;
    if (currentDiagram) {
        bus.notify('do:downloadFile', {
            filename: `${currentDiagram.name || 'diagram'}.mmd`,
            content: currentDiagram.content,
            mimeType: 'text/plain;charset=utf-8'
        });
    } else {
        // In a real app, you might want to notify the UI to show a message.
        // For now, we'll just log it.
        console.warn('Export MMD ignored: No current diagram.');
    }
}

function _renameDiagram({ diagramId, newName }) {
    const diagramToRename = state.diagrams.find(d => d.id === diagramId);
    if (diagramToRename) {
        const updatedDiagram = { ...diagramToRename, name: newName };
        // Rename: the diagram stays current if it was current already; don't
        // force a re-selection.
        bus.notify('do:saveDiagram', { diagramData: updatedDiagram, becomeCurrent: false });
    }
}

function _deleteDiagram({ diagramId }) {
    bus.notify('do:deleteDiagram', { diagramId });
}

function _updateCurrentDiagramContent({ content }) {
    if (state.currentDiagram) {
        const prevContent = state.currentDiagram.content;
        state.currentDiagram.content = content;
        // Only flip dirty when the content actually changed; programmatic
        // re-renders (e.g. editor.value = content from renderEditor) can call
        // through here with the same content.
        if (prevContent !== content) {
            state.currentDiagram.isDirty = true;
            _scheduleAutoSave();
        }
    }
    // Notify that content has changed, for auto-rendering in split view.
    bus.notify('diagramContentChanged', { content });
}

// Debounce the reload function to prevent it from firing on every single diagram save during a batch upload.
// We will wait 100ms after the LAST save event before reloading the list once.
const _debouncedLoadDiagrams = debounce((projectId) => {
    _loadDiagrams({ projectId });
}, 100);

function _handleDiagramSaved(savedDiagram) {
    // Three cases:
    //   1. The save targets the currently-open diagram (manual Save, autosave,
    //      rename) → update metadata, preserve in-memory content for any
    //      keystrokes that landed during the save.
    //   2. The save targets a different diagram AND was tagged becomeCurrent
    //      (new diagram creation, upload) → make it the new current and
    //      render fully — equivalent to a load.
    //   3. The save targets a different diagram WITHOUT becomeCurrent
    //      (save-on-switch race: the user already navigated away) → don't
    //      touch state.currentDiagram. Just refresh the sidebar.
    const sameAsCurrent = state.currentDiagram?.id != null
        && state.currentDiagram.id === savedDiagram.id;
    const becomeCurrent = !!savedDiagram.becomeCurrent;

    if (sameAsCurrent) {
        _cancelAutoSave();
        state.currentDiagram = {
            ...state.currentDiagram,
            name: savedDiagram.name,
            projectId: savedDiagram.projectId,
            dateModified: savedDiagram.dateModified,
        };
        state.currentDiagram.isDirty = state.currentDiagram.content !== savedDiagram.content;
        tracer.logStep('DiagramConcept: Diagram saved (current)');
        bus.notify('diagramAfterSave', { diagram: state.currentDiagram });
        bus.notify('diagramSelectionChanged', { currentDiagramId: state.currentDiagram.id });
        if (state.currentDiagram.isDirty) _scheduleAutoSave();
    } else if (becomeCurrent) {
        // New diagram creation / upload — treat as a load.
        _handleDiagramLoaded(savedDiagram);
    }
    // else: background save lost the race against a switch. Silently succeed;
    // the sidebar refresh below will reflect the new content.

    _debouncedLoadDiagrams(savedDiagram.projectId);
}

function _handleDiagramDeleted({ diagramId }) {
    if (state.currentDiagram?.id === diagramId) {
        _cancelAutoSave();
        state.currentDiagram = null;
        bus.notify('diagramContentLoaded', { diagram: null });
        // The list will be reloaded, and _setDiagrams will handle creating an unsaved diagram if needed.
    }
    // Reload the list from storage
    const projectId = state.diagrams.find(d => d.id === diagramId)?.projectId;
    if (projectId) {
        _loadDiagrams({ projectId });
    }
}

function _initializeUnsavedDiagram({ content }) {
    if (!state.currentDiagram) {
        state.currentDiagram = { id: null, name: '', content, isDirty: false };
    }
    bus.notify('diagramContentLoaded', { diagram: state.currentDiagram });
}

function _reset() {
    _cancelAutoSave();
    state = { ...initialState, autoSaveEnabled: _loadAutoSavePref() };
}

const actions = {
    'loadDiagrams': _loadDiagrams,
    'setDiagrams': _setDiagrams,
    'setCurrentDiagram': _setCurrentDiagram,
    'handleDiagramLoaded': _handleDiagramLoaded,
    'createDiagram': _createDiagram,
    'saveCurrentDiagram': _saveCurrentDiagram,
    'renameDiagram': _renameDiagram,
    'deleteDiagram': _deleteDiagram,
    'exportCurrentDiagramAsMmd': _exportCurrentDiagramAsMmd,
    'updateCurrentDiagramContent': _updateCurrentDiagramContent,
    'debouncedUpdateCurrentDiagramContent': debounce(_updateCurrentDiagramContent, 300),
    'handleDiagramSaved': _handleDiagramSaved,
    'initializeUnsavedDiagram': _initializeUnsavedDiagram,
    'handleDiagramDeleted': _handleDiagramDeleted,
    'setAutoSave': _setAutoSave,
    'reset': _reset,
};

// Test hooks — not part of the public contract. Let tests inspect/fire the
// idle timer without using real wall-clock delays.
const _test = {
    isAutoSaveTimerPending: () => _autoSaveTimer !== null,
    fireAutoSaveTimerNow: () => {
        if (_autoSaveTimer === null) return false;
        clearTimeout(_autoSaveTimer);
        _autoSaveTimer = null;
        if (state.autoSaveEnabled
            && state.currentDiagram
            && state.currentDiagram.id != null
            && state.currentDiagram.isDirty) {
            _saveCurrentDiagram();
        }
        return true;
    },
};

export const diagramConcept = {
    subscribe: bus.subscribe,
    getState: () => ({ ...state }),
    notify: bus.notify,
    reset: _reset,
    listen(event, payload) {
        if (actions[event]) {
            console.log(`[DiagramConcept] Action received: ${event}`, payload);
            actions[event](payload);
        } else {
            bus.notify(event, payload);
        }
    },
    _test,
};