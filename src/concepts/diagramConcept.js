/**
 * @module diagramConcept
 * @description Manages the state of diagrams for the currently active project.
 * This includes the list of diagrams, the active diagram, and its content.
 * It emits events for data loading and modification requests.
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

export const diagramConcept = {
  state: {
    /** @type {Array<any>} */
    diagrams: [],
    /** @type {any | null} */
    activeDiagram: null,
  },

  actions: {
    /**
     * Sets the list of diagrams for the current project.
     * @param {Array<any>} diagrams - The array of diagram objects from storage.
     */
    setDiagrams(diagrams) {
      diagramConcept.state.diagrams = diagrams || [];
      notify('diagramsLoaded', diagramConcept.state.diagrams);
    },

    /**
     * Sets the full content of the active diagram.
     * @param {any} diagram - The full diagram object, including content.
     */
    setActiveDiagram(diagram) {
      diagramConcept.state.activeDiagram = diagram;
      notify('activeDiagramSet', diagramConcept.state.activeDiagram);
    },

    /**
     * Updates the content of the currently active diagram as the user types.
     * @param {string} content - The new content from the editor.
     */
    updateActiveDiagramContent(content) {
      if (diagramConcept.state.activeDiagram) {
        diagramConcept.state.activeDiagram.content = content;
        notify('activeDiagramContentChanged', { content });
      }
    },

    /**
     * Initiates loading all diagrams for a given project.
     * @param {{projectId: number}} payload - The project ID.
     */
    loadDiagramsForProject({ projectId }) {
      // Clear current state before loading new diagrams
      diagramConcept.state.diagrams = [];
      diagramConcept.state.activeDiagram = null;
      notify('diagramsLoading', { projectId });
      notify('diagramsLoadRequested', { projectId });
    },

    /**
     * Initiates loading the full content for a specific diagram.
     * @param {{diagramId: number}} payload - The diagram ID.
     */
    loadDiagramContent({ diagramId }) {
      notify('diagramContentLoadRequested', { diagramId });
    },

    /**
     * Initiates the creation of a new diagram.
     * @param {{name: string, projectId: number, content?: string}} details - The new diagram details.
     */
    createDiagram(details) {
      notify('diagramCreationRequested', details);
    },

    /**
     * Initiates saving the currently active diagram.
     */
    saveActiveDiagram() {
      if (diagramConcept.state.activeDiagram) {
        notify('diagramSaveRequested', { diagram: diagramConcept.state.activeDiagram });
      }
    },

    /**
     * Initiates the deletion of a diagram.
     * @param {{diagramId: number}} payload - The diagram ID to delete.
     */
    deleteDiagram({ diagramId }) {
      notify('diagramDeletionRequested', { diagramId });
    },

    /**
     * Initiates the rename of a diagram.
     * @param {{diagramId: number, newTitle: string}} payload - The diagram ID and its new title.
     */
    renameDiagram({ diagramId, newTitle }) {
      notify('diagramRenameRequested', { diagramId, newTitle });
    },

    /**
     * Clears the active diagram, e.g., when a project is deleted or deselected.
     */
    clearActiveDiagram() {
      diagramConcept.state.activeDiagram = null;
      notify('activeDiagramSet', null);
    }
  },

  subscribe(fn) {
    subscribers.add(fn);
  },

  notify,
};