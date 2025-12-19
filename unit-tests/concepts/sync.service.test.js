import { describe, it, assert, beforeEach } from '../test-utils.js';
import { syncService } from '../../src/concepts/syncService.js';
import { projectConcept } from '../../src/concepts/projectConcept.js';
import { securityConcept } from '../../src/concepts/securityConcept.js';
import { storageConcept } from '../../src/concepts/storageConcept.js';
import { gitAbstractionConcept } from '../../src/concepts/gitAbstractionConcept.js';

describe('Sync Concept', () => {
  // Store original actions to restore them
  let originalStorageActions;
  let originalGalActions;

  const project = { id: 1, repositoryPath: 'owner/repo', defaultBranch: 'main', lastSyncSha: 'old-commit-sha' };
  const token = 'fake-token';
  
  beforeEach(() => {
    // Reset state
    syncService.state.isSyncing = false;
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
      getLatestCommit: () => Promise.resolve({ sha: 'new-commit-sha' }),
      listContents: () => Promise.resolve([]),
      getContents: () => Promise.resolve({ content: '', sha: '' }),
      putContents: () => Promise.resolve({ content: { sha: 'new-sha-from-put' } }),
      deleteContents: () => Promise.resolve(),
      getTreeSha: () => Promise.resolve('deprecated-tree-sha'), // Keep for any old references if needed
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

      await syncService.actions._performSync(project, token);

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

      await syncService.actions._performSync(project, token);

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

      await syncService.actions._performSync(project, token);

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

      await syncService.actions._performSync(project, token);

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

      await syncService.actions._performSync(project, token);

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

      await syncService.actions._performSync(project, token);

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

      await syncService.actions._performSync(project, token);

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

      await syncService.actions._performSync(project, token);

      assert.isTrue(deleteCalled, 'deleteContents should have been called for rename');
      assert.isTrue(createCalled, 'putContents should have been called for rename');
    });
  });

  describe('Conflict Resolution', () => {
    it('[UNIT] Conflict Resolution - Remote Wins: should overwrite local content with remote content', async () => {
      let updateDiagramCalledWith = null;

      // Arrange: Simulate a scenario where the remote has changed since the last sync.
      // 1. The latest commit on the remote is different from our last known commit.
      gitAbstractionConcept.actions.getLatestCommit = () => Promise.resolve({ sha: 'new-commit-sha' });
      // 2. The local DB has a diagram with an old file SHA.
      const localDiagram = { id: 1, title: 'conflict.mmd', content: 'local changes', lastModifiedRemoteSha: 'old-file-sha' };
      storageConcept.actions.getDiagramsByProjectId = () => Promise.resolve([localDiagram]);
      // 3. The remote repo lists the same file, but with a new file SHA.
      const remoteFile = { name: 'conflict.mmd', path: 'mermaid/conflict.mmd', sha: 'new-file-sha' };
      gitAbstractionConcept.actions.listContents = () => Promise.resolve([remoteFile]);
      // 4. When we fetch the remote content, it's different.
      gitAbstractionConcept.actions.getContents = () => Promise.resolve({ content: 'remote changes', sha: 'new-file-sha' });
      // 5. Spy on updateDiagram to see what it gets called with.
      storageConcept.actions.updateDiagram = (diagram) => { updateDiagramCalledWith = diagram; return Promise.resolve(); };

      await syncService.actions._performSync(project, token);

      assert.isNotNull(updateDiagramCalledWith, 'storageConcept.updateDiagram should have been called');
      assert.strictEqual(updateDiagramCalledWith.content, 'remote changes', 'The diagram should be updated with the content from the remote');
    });
  });
});