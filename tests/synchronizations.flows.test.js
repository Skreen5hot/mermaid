import { describe, it, assert, beforeEach } from './test-utils.js';
import { synchronizations } from '../src/synchronizations.js';
import { uiConcept } from '../src/concepts/uiConcept.js';
import { projectConcept } from '../src/concepts/projectConcept.js';
import { diagramConcept } from '../src/concepts/diagramConcept.js';
import { storageConcept } from '../src/concepts/storageConcept.js';
import { securityConcept } from '../src/concepts/securityConcept.js';
import { gitAbstractionConcept } from '../src/concepts/gitAbstractionConcept.js';

const allConcepts = [
  uiConcept, projectConcept, diagramConcept, storageConcept, securityConcept, gitAbstractionConcept
];

function setup() {
  // Set up all synchronizations for integration testing
  synchronizations.forEach((sync) => {
    sync.from.subscribe((event, payload) => {
      if (event === sync.when) {
        sync.do(payload);
      }
    });
  });
}

describe('Integration Synchronizations', () => {
  let spies = {};

  beforeEach(() => {
    // Reset spies
    spies = {};

    // Reset state and clear subscribers for all concepts
    allConcepts.forEach(c => {
      if (c.state) {
        Object.keys(c.state).forEach(key => {
          c.state[key] = Array.isArray(c.state[key]) ? [] : null;
        });
      }
      const subscribers = c.subscribe(() => {});
      if (subscribers) subscribers.clear();
    });

    // Mock all actions to act as spies
    allConcepts.forEach(c => {
      if (c.actions) {
        Object.keys(c.actions).forEach(actionName => {
          spies[`${c.constructor.name}_${actionName}`] = { called: false, with: null };
          const originalAction = c.actions[actionName];
          c.actions[actionName] = function(...args) {
            spies[`${c.constructor.name}_${actionName}`].called = true;
            spies[`${c.constructor.name}_${actionName}`].with = args;
            // Return a promise for async actions
            if (originalAction.constructor.name === 'AsyncFunction') {
              return Promise.resolve({});
            }
          };
        });
      }
    });

    setup();
  });

  describe('Connect Flow', () => {
    it('[INTEGRATION] should trigger project creation on ui:connectProjectClicked', async () => {
      const connectPayload = {
        gitProvider: 'github',
        repositoryPath: 'owner/repo',
        token: 'fake-token',
        password: 'fake-password',
      };

      // Mock successful API validation
      gitAbstractionConcept.actions.getRepoInfo = () => Promise.resolve({ default_branch: 'main' });
      securityConcept.actions.encryptToken = () => Promise.resolve({ ciphertext: 'encrypted' });

      // Trigger the start of the flow
      uiConcept.notify('ui:connectProjectClicked', connectPayload);

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      assert.isTrue(spies.Object_createProject.called, 'projectConcept.createProject should be called');
      assert.isTrue(spies.Object_addProject.called, 'storageConcept.addProject should be called');
      assert.isTrue(spies.Object_loadProjects.called, 'projectConcept.loadProjects should be called to refresh UI');
    });

    it('[INTEGRATION] should show a notification on connection failure', async () => {
      const connectPayload = { gitProvider: 'github', repositoryPath: 'owner/repo' };

      // Mock a failed API validation
      gitAbstractionConcept.actions.getRepoInfo = () => Promise.reject(new Error('Invalid repository'));

      uiConcept.notify('ui:connectProjectClicked', connectPayload);
      await new Promise(resolve => setTimeout(resolve, 0));

      assert.isFalse(spies.Object_addProject.called, 'storageConcept.addProject should NOT be called on failure');
      assert.isTrue(spies.Object_showNotification.called, 'uiConcept.showNotification should be called on failure');
    });
  });

  describe('Unlock Flow', () => {
    it('[INTEGRATION] should load diagrams after a successful unlock', async () => {
      // Setup initial state
      projectConcept.state.projects = [{ id: 1, name: 'Test Project', encryptedToken: {} }];
      projectConcept.state.activeProjectId = 1;

      // Mock successful decryption
      securityConcept.actions.decryptToken = () => Promise.resolve('decrypted-token');

      // Trigger the unlock UI event
      uiConcept.notify('ui:unlockSessionClicked', { password: 'good-password' });
      await new Promise(resolve => setTimeout(resolve, 0));

      assert.isTrue(spies.Object_hideUnlockSessionModal.called, 'Unlock modal should be hidden on success');
      assert.isTrue(spies.Object_loadDiagramsForProject.called, 'diagramConcept.loadDiagramsForProject should be called after unlock');
    });

    it('[INTEGRATION] should NOT load diagrams on a failed unlock', async () => {
      projectConcept.state.projects = [{ id: 1, name: 'Test Project', encryptedToken: {} }];
      projectConcept.state.activeProjectId = 1;

      // Mock failed decryption
      securityConcept.actions.decryptToken = () => Promise.reject(new Error('Decryption failed'));

      uiConcept.notify('ui:unlockSessionClicked', { password: 'wrong-password' });
      await new Promise(resolve => setTimeout(resolve, 0));

      assert.isFalse(spies.Object_hideUnlockSessionModal.called, 'Unlock modal should NOT be hidden on failure');
      assert.isFalse(spies.Object_loadDiagramsForProject.called, 'diagramConcept.loadDiagramsForProject should NOT be called on failure');
    });
  });

  describe('Rename Flow', () => {
    it('[INTEGRATION] should update storage and sync queue on rename', async () => {
      const renamePayload = { diagramId: 101, newTitle: 'Renamed Diagram.mmd' };
      const originalDiagram = { id: 101, title: 'Original.mmd', content: 'graph TD', projectId: 1 };

      // Mock the storage response
      storageConcept.actions.getDiagram = () => Promise.resolve(originalDiagram);

      // Trigger the UI event
      uiConcept.notify('ui:renameDiagramClicked', renamePayload);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert the full chain of events
      assert.isTrue(spies.Object_renameDiagram.called, 'diagramConcept.renameDiagram should be called');
      
      // Assert the effects of the diagramRenameRequested synchronization
      assert.isTrue(spies.Object_updateDiagram.called, 'storageConcept.updateDiagram should be called');
      const updatedDiagram = spies.Object_updateDiagram.with[0];
      assert.strictEqual(updatedDiagram.title, 'Renamed Diagram.mmd', 'Diagram title should be updated in storage');

      assert.isTrue(spies.Object_addSyncQueueItem.called, 'storageConcept.addSyncQueueItem should be called');
      const syncItem = spies.Object_addSyncQueueItem.with[0];
      assert.strictEqual(syncItem.action, 'rename', 'Sync queue action should be "rename"');
      assert.strictEqual(syncItem.payload.oldTitle, 'Original.mmd', 'Sync payload should contain old title');
      assert.strictEqual(syncItem.payload.newTitle, 'Renamed Diagram.mmd', 'Sync payload should contain new title');

      assert.isTrue(spies.Object_loadDiagramsForProject.called, 'Diagram list should be refreshed');
      assert.isTrue(spies.Object_setActiveDiagram.called, 'Active diagram should be updated');
    });
  });
});