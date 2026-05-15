/**
 * @module projectConcept
 * @description Manages the state of projects, including the list of all projects
 * and the currently active project. It emits events for creation, deletion,
 * and selection, but does not perform storage or API calls itself.
 * It follows the "Concepts and Synchronizations" architecture.
 */

const subscribers = new Set();

/**
 * Notifies all subscribed listeners of an event.
 * @param {string} event - The name of the event.
 * @param {*} payload - The data associated with the event.
 */
function notify(event, payload) {
  for (const subscriber of subscribers) {
    subscriber(event, payload);
  }
}

export const projectConcept = {
  state: {
    /** @type {Array<any>} */
    projects: [],
    /** @type {number | null} */
    activeProjectId: null,
  },

  actions: {
    /**
     * Sets the list of projects in the state, typically after being loaded from storage.
     * @param {Array<any>} projects - The array of project objects.
     */
    setProjects(projects) {
      projectConcept.state.projects = projects || [];
      notify('projectsLoaded', projectConcept.state.projects);
    },

    /**
     * Initiates the process of creating a new project.
     * Emits an event with the necessary details for other concepts to handle.
     * @param {{gitProvider: string, repositoryPath: string, token: string, password: string}} details - The new project details.
     */
    createProject(details) {
      // Does not modify state directly. Emits an event for the synchronization layer.
      notify('projectCreationRequested', details);
    },

    /**
     * Sets the currently active project.
     * @param {number} projectId - The ID of the project to set as active.
     */
    setActiveProject(projectId) {
      if (projectConcept.state.activeProjectId !== projectId) {
        projectConcept.state.activeProjectId = projectId;
        const project = projectConcept.state.projects.find(p => p.id === projectId);
        console.log(`[ProjectConcept] Active project set to:`, project);
        notify('projectSelected', project);
      }
    },

    /**
     * Initiates the deletion of a project.
     * Emits an event for the synchronization layer to handle storage operations.
     * @param {number} projectId - The ID of the project to delete.
     */
    deleteProject(projectId) {
      notify('projectDeletionRequested', { projectId });
    },

    /**
     * Initiates the loading of all projects from storage.
     */
    loadProjects() {
      return notify('projectsLoadRequested');
    },

    /**
     * Updates a single project in the state after it has been created or updated.
     * @param {any} newProject - The new or updated project object.
     */
    addOrUpdateProject(newProject) {
      const index = projectConcept.state.projects.findIndex(p => p.id === newProject.id);
      if (index > -1) {
        projectConcept.state.projects[index] = newProject;
      } else {
        projectConcept.state.projects.push(newProject);
      }
      notify('projectListUpdated', projectConcept.state.projects);
    }
  },

  subscribe(fn) {
    subscribers.add(fn);
  },

  unsubscribe(fn) {
    subscribers.delete(fn);
  },

  notify,
};