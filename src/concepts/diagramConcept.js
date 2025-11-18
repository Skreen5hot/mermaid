import { createEventBus } from '../utils/eventBus.js';
import { tracer } from '../utils/tracer.js';

const bus = createEventBus();

const initialState = {
    diagrams: [],
    currentDiagram: null, // { id, name, content, projectId }
};

let state = { ...initialState };

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

    // If we've loaded an empty list of diagrams for the default project, create the default diagram.
    // This ensures the default diagram is present even on subsequent loads, not just the very first one.
    if (diagrams.length === 0 && state.currentDiagram === null) {
        if (project?.name === 'Default Project') {
            const defaultContent = `graph TD\n    A[Start] --> B{Is it?};\n    B -- Yes --> C[OK];\n    C --> D[End];\n    B -- No --> E[Find out];\n    E --> B;`;
            _createDiagram({ name: 'generic', projectId: project.id, content: defaultContent });
            return; // The save/reload process will handle the rest.
        }
    }

    bus.notify('diagramsUpdated', { diagrams: state.diagrams, currentDiagramId: state.currentDiagram?.id });

    // If the list of diagrams for the current project is empty,
    // and there isn't already a current diagram (e.g. an unsaved one),
    // OR if a list of diagrams has loaded but none are selected,
    // we must explicitly notify that no diagram content is active.
    if (state.currentDiagram === null) {
        // This is the crucial event that was missing on initial load.
        bus.notify('diagramContentLoaded', { diagram: null });
    }
}

function _setCurrentDiagram({ diagramId }) {
    if (diagramId) {
        bus.notify('do:loadDiagram', { diagramId });
    } else {
        // This case handles when no diagram is selected, creating the unsaved state.
        _initializeUnsavedDiagram({ content: '' });
    }
}

function _handleDiagramLoaded(diagram) {
    state.currentDiagram = diagram;
    tracer.logStep('DiagramConcept: Diagram data loaded from storage');
    bus.notify('diagramContentLoaded', { diagram }); // This handles editor/main view updates.
    // Fire a specific, lightweight event for just updating the selection in the UI list.
    bus.notify('diagramSelectionChanged', { currentDiagramId: state.currentDiagram?.id });
}

function _createDiagram({ name, projectId, content }) {
    const newDiagramData = {
        name,
        projectId,
        content: content || 'graph TD;\n  A-->B;', // Use provided content or a default.
    };
    bus.notify('do:saveDiagram', { diagramData: newDiagramData });
}

function _saveCurrentDiagram() {
    console.log('`saveCurrentDiagram` action triggered.');

    if (!state.currentDiagram) {
        console.warn('Save ignored: No current diagram exists in the application state.');
        return;
    }

    console.log('Current diagram state:', JSON.stringify(state.currentDiagram, null, 2));

    // If the diagram has an ID, it's an existing diagram. Save it.
    if (state.currentDiagram.id) {
        console.log(`Action: Saving existing diagram with ID: ${state.currentDiagram.id}. Emitting 'do:saveDiagram'.`);
        bus.notify('do:saveDiagram', { diagramData: state.currentDiagram });
    } else {
        // If there's no ID, it's a new, unsaved diagram. Prompt for a name.
        console.log("Action: This is a new diagram. Emitting 'do:showNewDiagramModal'.");
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
        bus.notify('do:saveDiagram', { diagramData: updatedDiagram });
    }
}

function _deleteDiagram({ diagramId }) {
    bus.notify('do:deleteDiagram', { diagramId });
}

function _updateCurrentDiagramContent({ content }) {
    if (state.currentDiagram) {
        state.currentDiagram.content = content;
    }
    // Notify that content has changed, for auto-rendering in split view
    bus.notify('diagramContentChanged', { content });
}

// Debounce the reload function to prevent it from firing on every single diagram save during a batch upload.
// We will wait 100ms after the LAST save event before reloading the list once.
const _debouncedLoadDiagrams = debounce((projectId) => {
    _loadDiagrams({ projectId });
}, 100);

function _handleDiagramSaved(savedDiagram) {
    _debouncedLoadDiagrams(savedDiagram.projectId);
}

function _handleDiagramDeleted({ diagramId }) {
    if (state.currentDiagram?.id === diagramId) {
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
    // Only initialize if there isn't already a diagram.
    if (!state.currentDiagram) {
        state.currentDiagram = { id: null, name: '', content: content };
    }
    // Crucially, we must notify the UI that this "unsaved" diagram is now the content.
    // This replaces the problematic logic in synchronizations.js
    bus.notify('diagramContentLoaded', { diagram: state.currentDiagram });
}

function _reset() {
    state = { ...initialState };
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
    'reset': _reset, // Expose for testing
};

export const diagramConcept = {
    subscribe: bus.subscribe,
    getState: () => ({ ...state }),
    notify: bus.notify,
    reset: _reset, // Add a direct reset method for convenience in tests
    listen(event, payload) {
        if (actions[event]) {
            console.log(`[DiagramConcept] Action received: ${event}`, payload);
            actions[event](payload);
        } else {
            bus.notify(event, payload);
        }
    }
};