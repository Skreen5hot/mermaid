import { describe, it, assert, beforeEach } from '../test-utils.js';
import { projectConcept } from '../../src/concepts/projectConcept.js';

describe('Project Concept', () => {

  beforeEach(() => {
    // Reset state before each test
    projectConcept.state.projects = [];
    projectConcept.state.activeProjectId = null;
    // Clear subscribers by replacing the notify function temporarily
    const originalNotify = projectConcept.notify;
    projectConcept.notify = () => {};
    // This is a bit of a hack; a better solution would be a dedicated reset/unsubscribe method.
    // We restore it after clearing subscribers by re-subscribing.
    const subscribers = projectConcept.subscribe(() => {});
    if (subscribers) subscribers.clear();
    projectConcept.notify = originalNotify;
  });

  it('should have a default state', () => {
    assert.deepStrictEqual(projectConcept.state.projects, [], 'projects should be an empty array');
    assert.strictEqual(projectConcept.state.activeProjectId, null, 'activeProjectId should be null');
  });

  it("actions.setProjects() should update the projects array and notify", () => {
    const received = [];
    projectConcept.subscribe((event, payload) => received.push({ event, payload }));

    const newProjects = [{ id: 1, name: 'Project 1' }];
    projectConcept.actions.setProjects(newProjects);

    assert.strictEqual(projectConcept.state.projects, newProjects, 'State should be updated with new projects');

    const notification = received.find(r => r.event === 'projectsLoaded');
    assert.ok(notification, 'Should have emitted a projectsLoaded event');
    assert.strictEqual(notification.payload, newProjects, 'Payload should be the new projects array');
  });

  it("actions.setActiveProject() should update activeProjectId and notify", () => {
    const received = [];
    projectConcept.subscribe((event, payload) => received.push({ event, payload }));

    const projectId = 'proj-123';
    projectConcept.state.projects = [{ id: projectId, name: 'Test Project' }]; // Add project to state first
    projectConcept.actions.setActiveProject(projectId);

    assert.strictEqual(projectConcept.state.activeProjectId, projectId, 'State should be updated with new project ID');

    const notification = received.find(r => r.event === 'projectSelected');
    assert.ok(notification, 'Should have emitted a projectSelected event');
    assert.strictEqual(notification.payload.id, projectId, 'Payload should be the selected project object');
  });

  it("actions.createProject() should emit a 'projectCreationRequested' event", () => {
    const received = [];
    projectConcept.subscribe((event, payload) => received.push({ event, payload }));

    const projectDetails = { name: 'New Project', type: 'local' };
    projectConcept.actions.createProject(projectDetails);

    assert.strictEqual(received.length, 1, 'Should have emitted one event');
    assert.strictEqual(received[0].event, 'projectCreationRequested', 'Should emit projectCreationRequested event');
    assert.strictEqual(received[0].payload, projectDetails, 'Payload should be the project details');
  });

  it("actions.deleteProject() should emit a 'projectDeletionRequested' event", () => {
    const received = [];
    projectConcept.subscribe((event, payload) => received.push({ event, payload }));

    const projectId = 'proj-456';
    projectConcept.actions.deleteProject(projectId);

    assert.strictEqual(received.length, 1, 'Should have emitted one event');
    assert.strictEqual(received[0].event, 'projectDeletionRequested', 'Should emit projectDeletionRequested event');
    assert.deepStrictEqual(received[0].payload, { projectId }, 'Payload should be the project ID object');
  });

  it("actions.addOrUpdateProject() should add a new project", () => {
    const newProject = { id: 1, name: 'New Project' };
    projectConcept.actions.addOrUpdateProject(newProject);

    assert.strictEqual(projectConcept.state.projects.length, 1);
    assert.strictEqual(projectConcept.state.projects[0].name, 'New Project');
  });

  it("actions.addOrUpdateProject() should update an existing project", () => {
    projectConcept.state.projects = [{ id: 1, name: 'Original Name' }];
    const updatedProject = { id: 1, name: 'Updated Name' };
    projectConcept.actions.addOrUpdateProject(updatedProject);

    assert.strictEqual(projectConcept.state.projects.length, 1);
    assert.strictEqual(projectConcept.state.projects[0].name, 'Updated Name');
  });
});