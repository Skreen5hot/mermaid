import { projectConcept } from '../../src/concepts/projectConcept.js';
import assert from '../framework/assert.js';

/**
 * A helper to capture all events emitted by a concept's event bus during a test.
 * @param {object} concept The concept to monitor.
 * @returns {Array<{event: string, payload: any}>} A list of captured events.
 */
function captureEvents(concept) {
    const events = [];
    concept.subscribe((event, payload) => {
        events.push({ event, payload });
    });
    return events;
}

describe('projectConcept.js', () => {
    beforeEach(() => {
        // Reset the concept's state before each test to ensure isolation.
        projectConcept.reset();
    });

    it('should initialize with a default state', () => {
        const state = projectConcept.getState();
        assert.ok(Array.isArray(state.projects), 'initial state should have a projects array');
        assert.strictEqual(state.projects.length, 0, 'projects array should be empty initially');
        assert.strictEqual(state.currentProjectId, null, 'currentProjectId should be null initially');
    });

    it("listen('setProjects', ...) should update the projects array and current project", () => {
        const events = captureEvents(projectConcept);
        const mockProjects = [{ id: 101, name: 'Project Alpha' }, { id: 102, name: 'Project Beta' }];

        projectConcept.listen('setProjects', mockProjects);

        const state = projectConcept.getState();
        assert.strictEqual(state.projects.length, 2, 'state.projects should contain 2 projects');
        assert.strictEqual(state.projects[0].name, 'Project Alpha', 'Project name should be set correctly');
        assert.strictEqual(state.currentProjectId, 101, 'currentProjectId should default to the first project');

        const projectsUpdatedEvent = events.find(e => e.event === 'projectsUpdated');
        assert.ok(projectsUpdatedEvent, 'should emit a projectsUpdated event');
        assert.strictEqual(projectsUpdatedEvent.payload.projects, mockProjects, 'event payload should contain the projects');
    });

    it("listen('setCurrentProject', ...) should update currentProjectId and emit projectChanged", () => {
        const events = captureEvents(projectConcept);
        const newProjectId = 102;

        projectConcept.listen('setCurrentProject', { projectId: newProjectId });

        const state = projectConcept.getState();
        assert.strictEqual(state.currentProjectId, newProjectId, 'currentProjectId should be updated');

        const projectChangedEvent = events.find(e => e.event === 'projectChanged');
        assert.ok(projectChangedEvent, 'should emit a projectChanged event');
        assert.strictEqual(projectChangedEvent.payload.projectId, newProjectId, 'event payload should contain the new project ID');
    });

    it("listen('createProject', ...) should emit a do:createProject event", () => {
        const events = captureEvents(projectConcept);
        const newProjectName = 'New Test Project';

        projectConcept.listen('createProject', { name: newProjectName });

        const createEvent = events.find(e => e.event === 'do:createProject');
        assert.ok(createEvent, 'should emit a do:createProject event');
        assert.strictEqual(createEvent.payload.name, newProjectName, 'payload should contain the new project name');
    });

    it("listen('deleteProject', ...) should emit a do:deleteProject event", () => {
        const events = captureEvents(projectConcept);
        const projectIdToDelete = 101;

        projectConcept.listen('deleteProject', { projectId: projectIdToDelete });

        const deleteEvent = events.find(e => e.event === 'do:deleteProject');
        assert.ok(deleteEvent, 'should emit a do:deleteProject event');
        assert.strictEqual(deleteEvent.payload.projectId, projectIdToDelete, 'payload should contain the project ID to delete');
    });
});