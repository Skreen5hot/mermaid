import { describe, test, assert, beforeEach } from './test-utils.js';
import { uiConcept } from '../src/concepts/uiConcept.js';
import { projectConcept } from '../src/concepts/projectConcept.js';
import { diagramConcept } from '../src/concepts/diagramConcept.js';
import { synchronizations } from '../src/synchronizations.js';

function setup() {
  // Filter and apply only the relevant synchronizations for this test file
  const relevantSyncs = synchronizations.filter(s =>
    s.when === 'ui:deleteDiagramClicked' || s.when === 'ui:deleteProjectClicked'
  );

  relevantSyncs.forEach((sync) => {
    sync.from.subscribe((event, payload) => {
      if (event === sync.when) {
        sync.do(payload);
      }
    });
  });
}

describe('Deletion Synchronizations from UI', () => {
  let originalConfirm;
  let originalDeleteDiagram;
  let originalDeleteProject;

  beforeEach(() => {
    // Reset mocks and state before each test
    originalConfirm = window.confirm;
    originalDeleteDiagram = diagramConcept.actions.deleteDiagram;
    originalDeleteProject = projectConcept.actions.deleteProject;

    projectConcept.state.activeProjectId = null;
    diagramConcept.state.activeDiagram = null;

    // Clear all subscribers to ensure a clean slate, which is important
    // because concepts are singletons and listeners accumulate across test files.
    // A more robust test runner would handle this, but for now, we do it manually.
    const concepts = [uiConcept, projectConcept, diagramConcept];
    concepts.forEach(c => {
        const subscribers = c.subscribe(() => {});
        subscribers.clear();
    });

    setup();
  });

  // Restore original methods after each test
  const tearDown = () => {
    window.confirm = originalConfirm;
    diagramConcept.actions.deleteDiagram = originalDeleteDiagram;
    projectConcept.actions.deleteProject = originalDeleteProject;
  };

  describe('ui:deleteDiagramClicked Synchronization', () => {
    test('should trigger diagramConcept.deleteDiagram when a saved diagram is active and user confirms', () => {
      let wasCalled = false;
      diagramConcept.actions.deleteDiagram = ({ diagramId }) => {
        wasCalled = true;
        assert.strictEqual(diagramId, 101, 'The correct diagram ID should be passed');
      };
      window.confirm = () => true;
      diagramConcept.state.activeDiagram = { id: 101, title: 'Test Diagram' };

      uiConcept.notify('ui:deleteDiagramClicked');

      assert.isTrue(wasCalled, 'diagramConcept.actions.deleteDiagram should have been called');
      tearDown();
    });

    test('should NOT trigger deletion if the user cancels the confirmation', () => {
      let wasCalled = false;
      diagramConcept.actions.deleteDiagram = () => { wasCalled = true; };
      window.confirm = () => false;
      diagramConcept.state.activeDiagram = { id: 101, title: 'Test Diagram' };

      uiConcept.notify('ui:deleteDiagramClicked');

      assert.isFalse(wasCalled, 'diagramConcept.actions.deleteDiagram should not have been called');
      tearDown();
    });
  });

  describe('ui:deleteProjectClicked Synchronization', () => {
    test('should trigger projectConcept.deleteProject when a project is active', () => {
      let wasCalled = false;
      projectConcept.actions.deleteProject = (projectId) => {
        wasCalled = true;
        assert.strictEqual(projectId, 42, 'The correct project ID should be passed');
      };
      projectConcept.state.activeProjectId = 42;

      uiConcept.notify('ui:deleteProjectClicked');

      assert.isTrue(wasCalled, 'projectConcept.actions.deleteProject should have been called');
      tearDown();
    });

    test('should NOT trigger deletion if no project is active', () => {
      let wasCalled = false;
      projectConcept.actions.deleteProject = () => { wasCalled = true; };
      projectConcept.state.activeProjectId = null;

      uiConcept.notify('ui:deleteProjectClicked');

      assert.isFalse(wasCalled, 'projectConcept.actions.deleteProject should not have been called');
      tearDown();
    });
  });
});