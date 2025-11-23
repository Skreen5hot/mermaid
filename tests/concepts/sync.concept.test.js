import { describe, it, assert, beforeEach } from '../test-utils.js';
import { syncConcept } from '../../src/concepts/syncConcept.js';
import { projectConcept } from '../../src/concepts/projectConcept.js';
import { securityConcept } from '../../src/concepts/securityConcept.js';
import { storageConcept } from '../../src/concepts/storageConcept.js';
import { gitAbstractionConcept } from '../../src/concepts/gitAbstractionConcept.js';

describe('Sync Concept', () => {
  // Store original actions to restore them
  let originalStorageActions;
  let originalGalActions;

  const project = { id: 1, repositoryPath: 'owner/repo', lastSyncSha: 'old-tree-sha' };
  const token = 'fake-token';
  
  beforeEach(() => {
    // Reset state
    syncConcept.state.isSyncing = false;
    projectConcept.state.activeProjectId = 1;
    projectConcept.state.projects = [project];
    securityConcept.state.decryptedToken = token;

    // Create fresh mocks for each test
    const mockStorage = {
      getDiagramsByProjectId: () => Promise.resolve([]),
      getSyncQueueItems: () => Promise.resolve([]),
      addDiagram: () => Promise.resolve(),
      updateDiagram: () => Promise.resolve(),
      deleteDiagram: () => Promise.resolve(),
      deleteSyncQueueItem: () => Promise.resolve(),
      getDiagram: () => Promise.resolve({}),
      updateProject: () => Promise.resolve(),
    };

    const mockGal = {
      getTreeSha: () => Promise.resolve('new-tree-sha'),
      listContents: () => Promise.resolve([]),
      getContents: () => Promise.resolve({ content: '', sha: '' }),
      putContents: () => Promise.resolve({ content: { sha: 'new-sha-from-put' } }),
      deleteContents: () => Promise.resolve(),
    };

    // Replace the entire actions object with our mocks
    originalStorageActions = storageConcept.actions;
    storageConcept.actions = mockStorage;

    originalGalActions = gitAbstractionConcept.actions;
    gitAbstractionConcept.actions = mockGal;
  });

  describe('Pull Logic', () => {
    it('[UNIT] Pull Logic - New Remote File: should call addDiagram', async () => {
      let addDiagramCalled = false;
      
      // Configure mocks for this specific test
      gitAbstractionConcept.actions.listContents = () => Promise.resolve([{ name: 'new.mmd', path: 'mermaid/new.mmd', sha: 'new-sha' }]);
      storageConcept.actions.getDiagramsByProjectId = () => Promise.resolve([]);
      gitAbstractionConcept.actions.getContents = () => Promise.resolve({ content: 'graph TD', sha: 'new-sha' });
      storageConcept.actions.addDiagram = (diagram) => {
        addDiagramCalled = true;
        assert.strictEqual(diagram.title, 'new.mmd', 'Should add diagram with correct title');
        return Promise.resolve();
      };

      await syncConcept.actions._performSync(project, token);

      assert.isTrue(addDiagramCalled, 'storageConcept.addDiagram should have been called');
    });

    it('[UNIT] Pull Logic - Updated Remote File: should call updateDiagram', async () => {
      let updateDiagramCalled = false;
      gitAbstractionConcept.actions.listContents = () => Promise.resolve([{ name: 'existing.mmd', path: 'mermaid/existing.mmd', sha: 'new-sha' }]);
      storageConcept.actions.getDiagramsByProjectId = () => Promise.resolve([{ title: 'existing.mmd', lastModifiedRemoteSha: 'old-sha' }]);
      gitAbstractionConcept.actions.getContents = () => Promise.resolve({ content: 'updated content', sha: 'new-sha' });
      storageConcept.actions.updateDiagram = (diagram) => {
        updateDiagramCalled = true;
        assert.strictEqual(diagram.content, 'updated content', 'Should update diagram with new content');
        return Promise.resolve();
      };

      await syncConcept.actions._performSync(project, token);

      assert.isTrue(updateDiagramCalled, 'storageConcept.updateDiagram should have been called');
    });

    it('[UNIT] Pull Logic - Deleted Remote File: should call deleteDiagram', async () => {
      let deleteDiagramCalled = false;
      gitAbstractionConcept.actions.listContents = () => Promise.resolve([]); // Remote is empty
      storageConcept.actions.getDiagramsByProjectId = () => Promise.resolve([{ id: 101, title: 'deleted.mmd', lastModifiedRemoteSha: 'old-sha' }]);
      storageConcept.actions.deleteDiagram = (diagramId) => {
        deleteDiagramCalled = true;
        assert.strictEqual(diagramId, 101, 'Should delete the correct diagram ID');
        return Promise.resolve();
      };

      await syncConcept.actions._performSync(project, token);

      assert.isTrue(deleteDiagramCalled, 'storageConcept.deleteDiagram should have been called');
    });

    it('[UNIT] Pull Logic - Missing Remote Directory: should create the directory', async () => {
      let putContentsCalled = false;
      // Mock listContents to throw a 404 error
      gitAbstractionConcept.actions.listContents = () => {
        return Promise.reject(new Error('404 Not Found'));
      };
      // Spy on putContents to verify it's called to create the .gitkeep file
      gitAbstractionConcept.actions.putContents = (owner, repo, path, content, message) => {
        putContentsCalled = true;
        assert.strictEqual(path, 'mermaid/.gitkeep', 'Should create a .gitkeep file in the mermaid directory');
        return Promise.resolve({ content: { sha: 'gitkeep-sha' } });
      };

      await syncConcept.actions._performSync(project, token);

      assert.isTrue(putContentsCalled, 'gitAbstractionConcept.putContents should have been called to create the directory');
    });
  });

  describe('Push Logic', () => {
    it('[UNIT] Push Logic: should call putContents for a "create" item', async () => {
      let putContentsCalled = false;
      const queueItem = { id: 1, action: 'create', payload: { title: 'new.mmd', content: 'new content' } };
      storageConcept.actions.getSyncQueueItems = () => Promise.resolve([queueItem]);
      storageConcept.actions.deleteSyncQueueItem = () => Promise.resolve();
      storageConcept.actions.getDiagram = () => Promise.resolve({});
      gitAbstractionConcept.actions.putContents = (owner, repo, path, content, message, sha) => {
        putContentsCalled = true;
        assert.strictEqual(path, 'mermaid/new.mmd', 'Path should be correct');
        assert.isNull(sha, 'SHA should be null for creation');
        return Promise.resolve({ content: { sha: 'new-sha' } });
      };

      await syncConcept.actions._performSync(project, token);

      assert.isTrue(putContentsCalled, 'gitAbstractionConcept.putContents should have been called');
    });

    it('[UNIT] Push Logic: should call putContents for an "update" item', async () => {
      let putContentsCalled = false;
      const queueItem = { id: 1, action: 'update', payload: { title: 'existing.mmd', content: 'updated', sha: 'old-sha' } };
      storageConcept.actions.getSyncQueueItems = () => Promise.resolve([queueItem]);
      storageConcept.actions.deleteSyncQueueItem = () => Promise.resolve();
      storageConcept.actions.getDiagram = () => Promise.resolve({});
      gitAbstractionConcept.actions.putContents = (owner, repo, path, content, message, sha) => {
        putContentsCalled = true;
        assert.strictEqual(path, 'mermaid/existing.mmd', 'Path should be correct');
        assert.strictEqual(sha, 'old-sha', 'SHA should be passed for update');
        return Promise.resolve({ content: { sha: 'new-sha' } });
      };

      await syncConcept.actions._performSync(project, token);

      assert.isTrue(putContentsCalled, 'gitAbstractionConcept.putContents should have been called');
    });

    it('[UNIT] Push Logic: should call deleteContents for a "delete" item', async () => {
      let deleteContentsCalled = false;
      const queueItem = { id: 1, action: 'delete', payload: { title: 'deleted.mmd', sha: 'old-sha' } };
      storageConcept.actions.getSyncQueueItems = () => Promise.resolve([queueItem]);
      storageConcept.actions.deleteSyncQueueItem = () => Promise.resolve();
      gitAbstractionConcept.actions.deleteContents = (owner, repo, path, message, sha) => {
        deleteContentsCalled = true;
        assert.strictEqual(path, 'mermaid/deleted.mmd', 'Path should be correct');
        assert.strictEqual(sha, 'old-sha', 'SHA should be passed for deletion');
        return Promise.resolve();
      };

      await syncConcept.actions._performSync(project, token);

      assert.isTrue(deleteContentsCalled, 'gitAbstractionConcept.deleteContents should have been called');
    });

    it('[UNIT] Push Logic: should call delete and put for a "rename" item', async () => {
      let deleteCalled = false;
      let createCalled = false;
      const queueItem = { id: 1, action: 'rename', payload: { oldTitle: 'old.mmd', newTitle: 'new.mmd', content: 'content', sha: 'old-sha' } };
      storageConcept.actions.getSyncQueueItems = () => Promise.resolve([queueItem]);
      storageConcept.actions.deleteSyncQueueItem = () => Promise.resolve();
      gitAbstractionConcept.actions.deleteContents = (owner, repo, path) => {
        deleteCalled = true;
        assert.strictEqual(path, 'mermaid/old.mmd', 'Should delete the old path');
        return Promise.resolve();
      };
      gitAbstractionConcept.actions.putContents = (owner, repo, path) => {
        createCalled = true;
        assert.strictEqual(path, 'mermaid/new.mmd', 'Should create the new path');
        return Promise.resolve({ content: { sha: 'new-sha' } });
      };

      await syncConcept.actions._performSync(project, token);

      assert.isTrue(deleteCalled, 'deleteContents should have been called for rename');
      assert.isTrue(createCalled, 'putContents should have been called for rename');
    });
  });

  describe('Conflict Resolution', () => {
    it('[UNIT] Conflict Resolution - Fallback: should create a conflict file', async () => {
      let conflictFileCreated = false;
      const queueItem = { id: 1, action: 'update', payload: { title: 'conflict.mmd', content: 'local content', sha: 'base-sha' } };
      storageConcept.actions.getSyncQueueItems = () => Promise.resolve([queueItem]);
      storageConcept.actions.deleteSyncQueueItem = () => Promise.resolve();
      
      // First call to putContents will fail with 409
      let putCount = 0;
      gitAbstractionConcept.actions.putContents = (owner, repo, path, content, message, sha) => {
        putCount++;
        if (putCount === 1) {
          throw new Error('409 Conflict');
        }
        // Second call is for creating the conflict file
        conflictFileCreated = true;
        assert.include(path, '_conflict_', 'Should create a file with _conflict_ in the name');
        assert.strictEqual(content, 'local content', 'Conflict file should have local content');
        return Promise.resolve({ content: { sha: 'conflict-sha' } });
      };

      // Mock getContents for fetching BASE and REMOTE versions
      let getCount = 0;
      gitAbstractionConcept.actions.getContents = (owner, repo, path, token, ref) => {
        getCount++;
        if (ref === 'base-sha') return Promise.resolve({ content: 'base content', sha: 'base-sha' }); // BASE
        return Promise.resolve({ content: 'remote content', sha: 'remote-sha' }); // REMOTE
      };

      await syncConcept.actions._performSync(project, token);

      assert.strictEqual(getCount, 2, 'getContents should be called twice (for base and remote)');
      assert.isTrue(conflictFileCreated, 'A new conflict file should have been created via putContents');
    });
  });
});