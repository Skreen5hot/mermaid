import { createEventBus } from '../utils/eventBus.js';

const bus = createEventBus();

const initialState = {
    projects: [],
    currentProjectId: null,
};

let state = { ...initialState };

function _loadProjects() {
    projectConcept.notify('do:listProjects');
}

function _setProjects(projects = []) {
    state.projects = projects;
    const previousProjectId = state.currentProjectId;

    if (projects.length === 0) {
        projectConcept.notify('do:createProject', { name: 'Default Project', isDefault: true });
        state.currentProjectId = null;
    } else if (!state.projects.find(p => p.id === state.currentProjectId)) {
        state.currentProjectId = projects.length > 0 ? projects[0].id : null;
    }
    // If the project ID changed (e.g., on initial load), fire the 'projectChanged' event.
    if (state.currentProjectId !== previousProjectId && state.currentProjectId !== null) {
        projectConcept.notify('projectChanged', { projectId: state.currentProjectId });
    }
    projectConcept.notify('projectsUpdated', { projects: state.projects, currentProjectId: state.currentProjectId });
}

function _createProject({ name }) {
    projectConcept.notify('do:createProject', { name });
}

function _renameProject({ projectId, newName }) {
    // The storage concept doesn't have a rename, so we'll just save it with the same ID.
    projectConcept.notify('do:saveProject', { projectData: { id: projectId, name: newName } });
}

function _deleteProject({ projectId }) {
    projectConcept.notify('do:deleteProject', { projectId });
}

function _setCurrentProject({ projectId }) {
    const newProjectId = parseInt(projectId, 10);
    if (state.currentProjectId !== newProjectId) {
        state.currentProjectId = newProjectId;
        projectConcept.notify('projectChanged', { projectId: newProjectId });
    }
}

function _handleProjectCreated(project) {
    // This is called after storage confirms creation
    _loadProjects(); // Easiest way to get the full, fresh list
    _setCurrentProject({ projectId: project.id });
}

function _reset() {
    state = { ...initialState };
}

const actions = {
    'loadProjects': _loadProjects,
    'setProjects': _setProjects,
    'createProject': _createProject,
    'deleteProject': _deleteProject,
    'renameProject': _renameProject,
    'setCurrentProject': _setCurrentProject,
    'handleProjectCreated': _handleProjectCreated,
    'reset': _reset,
};

export const projectConcept = {
    subscribe: bus.subscribe,
    // Expose a way to get current state without allowing mutation
    getState: () => ({ ...state }),
    notify: bus.notify,
    reset: _reset,
    listen(event, payload) {
        if (actions[event]) {
            console.log(`[ProjectConcept] Action received: ${event}`, payload);
            actions[event](payload);
        } else {
            // Allow direct notification for external events to trigger internal actions
            bus.notify(event, payload);
        }
    }
};