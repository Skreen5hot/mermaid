import { createEventBus } from '../utils/eventBus.js';

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
        _setDiagrams([]);
        state.currentDiagram = null;
        bus.notify('diagramContentLoaded', { diagram: null });
    }
}

function _setDiagrams(diagrams) {
    state.diagrams = diagrams;
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
        _initializeUnsavedDiagram({ content: 'graph TD;\n  A-->B;' });
    }
}

function _handleDiagramLoaded(diagram) {
    state.currentDiagram = diagram;
    bus.notify('diagramContentLoaded', { diagram });
}

function _createDiagram({ name, projectId }) {
    const newDiagramData = {
        name,
        projectId,
        content: 'graph TD;\n  A-->B;',
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

function _handleDiagramSaved(savedDiagram) {
    // After saving, the most reliable way to update the UI is to reload everything for the current project.
    // This avoids complex state management and ensures consistency.
    _loadDiagrams({ projectId: savedDiagram.projectId });
    // After saving, we should reload the list to get the latest state
    // And then select the diagram that was just saved.
    _setCurrentDiagram({ diagramId: savedDiagram.id });
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
            actions[event](payload);
        } else {
            bus.notify(event, payload);
        }
    }
};