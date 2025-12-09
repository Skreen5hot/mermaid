/**
 * @module syncConcept
 * @description Orchestrates the bi-directional synchronization between the local
 * IndexedDB and the remote Git repository. This is the "Synchronization Core Agent".
 * It manages polling for remote changes and processing the local change queue.
 */

import { securityConcept } from './securityConcept.js';
import { projectConcept } from './projectConcept.js';
import { gitAbstractionConcept } from './gitAbstractionConcept.js';
import { storageConcept } from './storageConcept.js';
import { merge3Way } from '../utils/diff3.js';

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

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const syncConcept = {
  state: {
    isSyncing: false,
    syncIntervalId: null,
    lastSyncTimestamp: null,
  },

  actions: {
    /**
     * Starts a periodic poll to check for remote changes.
     */
    startPolling() {
      if (syncConcept.state.syncIntervalId) {
        console.log('[SyncConcept] Polling is already active.');
        return;
      }
      console.log(`[SyncConcept] Starting polling every ${SYNC_INTERVAL / 1000 / 60} minutes.`);
      // Trigger an initial sync immediately, then start the interval.
      syncConcept.actions.triggerSync();
      syncConcept.state.syncIntervalId = setInterval(() => {
        syncConcept.actions.triggerSync();
      }, SYNC_INTERVAL);
    },

    /**
     * Stops the periodic polling.
     */
    stopPolling() {
      if (syncConcept.state.syncIntervalId) {
        clearInterval(syncConcept.state.syncIntervalId);
        syncConcept.state.syncIntervalId = null;
        console.log('[SyncConcept] Polling stopped.');
      }
    },

    /**
     * Manually triggers a one-off synchronization cycle.
     */
    triggerSync() {
      if (syncConcept.state.isSyncing) {
        console.warn('[SyncConcept] Sync already in progress. Skipping this trigger.');
        return;
      }
      // We need the active project and token to perform a sync.
      // This will be provided by the synchronization layer.
      const activeProject = projectConcept.state.projects.find(p => p.id === projectConcept.state.activeProjectId);
      const sessionPassword = securityConcept.state.sessionPassword;

      if (activeProject && (activeProject.gitProvider === 'local' || sessionPassword)) {
        syncConcept.actions._performSync();
      } else {
        console.log('[SyncConcept] Skipping sync: No active project or session is not unlocked.');
      }
    },

    /**
     * The core logic for a single synchronization cycle.
     * @param {any} project - The active project object.
     * @param {string} token - The decrypted access token. (Note: this is now fetched from securityConcept)
     * @private
     */
    async _performSync() {
      syncConcept.state.isSyncing = true;
      notify('syncStarted');
      console.log('[SyncConcept] Starting synchronization cycle...');

      try {
        const project = projectConcept.state.projects.find(p => p.id === projectConcept.state.activeProjectId);

        // --- NEW: Guard against trying to sync local projects ---
        if (!project) throw new Error('Sync failed: No active project.');
        if (project.gitProvider === 'local') {
          console.log('[SyncConcept] Skipping sync for local project.');
          return; // Exit early, nothing to sync.
        }

        // --- FIX: Decrypt the project-specific token on-demand using the session password ---
        const sessionPassword = securityConcept.state.sessionPassword;
        if (!sessionPassword) throw new Error('Sync failed: Session is locked.');

        const token = await securityConcept.actions.decryptToken(project.encryptedToken, sessionPassword);

        const [owner, repo] = project.repositoryPath.split('/');
        const diagramsPath = 'mermaid'; // Standard directory for diagrams

        // 1. Get the latest commit SHA and check if a pull is needed
        const remoteCommit = await gitAbstractionConcept.actions.getLatestCommit(owner, repo, project.defaultBranch, token);
        const remoteSha = remoteCommit.sha;

        // --- DETAILED LOGGING ---
        console.log(`[Sync Check] Last known local SHA: ${project.lastSyncSha}`);
        console.log(`[Sync Check] Current remote SHA: ${remoteSha}`);

        // If the project has never been synced (lastSyncSha is null), we must pull.
        // Otherwise, we only pull if the remote SHA has changed.
        if (project.lastSyncSha && remoteSha === project.lastSyncSha) {
          console.log('[Sync] Remote has not changed. Skipping pull phase.');
        } else {
          await pullChanges(project, token, owner, repo, diagramsPath);
        }

        // 3. Process the local syncQueue (PUSH) - This should ALWAYS run.
        await pushChanges(project, token, owner, repo, diagramsPath);

        // 4. Update the project's last sync SHA
        // We fetch the commit SHA again *after* the push to get the most up-to-date state.
        const finalRemoteCommit = await gitAbstractionConcept.actions.getLatestCommit(owner, repo, project.defaultBranch, token);
        project.lastSyncSha = finalRemoteCommit.sha;
        await storageConcept.actions.updateProject(project);

        console.log('[Sync] Push/Pull reconciliation complete.');
        notify('diagramsChanged', { projectId: project.id });

      } catch (error) {
        console.error('[SyncConcept] Error during synchronization cycle:', error);
        notify('syncError', { error });
      } finally {
        syncConcept.state.isSyncing = false;
        syncConcept.state.lastSyncTimestamp = new Date();
        notify('syncCompleted', { timestamp: syncConcept.state.lastSyncTimestamp });
        console.log('[SyncConcept] Synchronization cycle finished.');
      }
    },
  },

  subscribe(fn) {
    subscribers.add(fn);
  },

  notify,
};

async function pullChanges(project, token, owner, repo, diagramsPath) {
  console.log('[Sync] Remote changes detected. Starting pull phase...');
  
  let remoteFiles = [];
  try {
    remoteFiles = await gitAbstractionConcept.actions.listContents(owner, repo, diagramsPath, token);
  } catch (error) {
    if (error.message.includes('404')) {
      console.log(`[Sync] Remote directory "${diagramsPath}" not found. Creating it...`);
      await gitAbstractionConcept.actions.putContents(
        owner, repo, `${diagramsPath}/.gitkeep`, '',
        '[Mermaid-IDE] Initialize mermaid directory', null, token
      );
      // After creating the directory, we must re-fetch the contents to see if other files exist.
      remoteFiles = await gitAbstractionConcept.actions.listContents(owner, repo, diagramsPath, token);
    } else {
      throw error;
    }
  }
  const localDiagrams = await storageConcept.actions.getDiagramsByProjectId(project.id);

  // --- DETAILED LOGGING ---
  console.log(`[Pull] Found ${remoteFiles.length} raw items in remote directory:`, remoteFiles);

  const mmdRemoteFiles = remoteFiles.filter(file => file.name.endsWith('.mmd'));

  const localDiagramsMap = new Map(localDiagrams.map(d => [d.title, d]));
  const remoteFilesMap = new Map(mmdRemoteFiles.map(f => [f.name, f]));

  console.log(`[Pull] Filtered to ${mmdRemoteFiles.length} .mmd files:`, mmdRemoteFiles.map(f => f.name));

  const pullPromises = [];

  for (const remoteFile of mmdRemoteFiles) {
    const localMatch = localDiagramsMap.get(remoteFile.name);
    console.log(`[Pull] Processing remote file: ${remoteFile.name}`);

    if (!localMatch) {
      console.log(`[Sync] New remote file found: ${remoteFile.name}. Downloading...`);
      const downloadPromise = gitAbstractionConcept.actions.getContents(owner, repo, remoteFile.path, token)
        .then(({ content, sha }) => storageConcept.actions.addDiagram({
          projectId: project.id, title: remoteFile.name, content,
          lastModifiedRemoteSha: sha, createdAt: new Date(), updatedAt: new Date(),
        }));
      pullPromises.push(downloadPromise);
    } else if (localMatch.lastModifiedRemoteSha !== remoteFile.sha) { // File exists locally, check if remote has changed
      // This is the "Remote Wins" strategy. If the remote file has a different SHA,
      // we overwrite the local version, regardless of local changes.
      // Pending local changes in the queue will be handled during the push phase.
      console.log(`[Pull] Conflict or update detected for "${remoteFile.name}". Remote version wins. Downloading...`);
      const updatePromise = gitAbstractionConcept.actions.getContents(owner, repo, remoteFile.path, token)
        .then(({ content, sha }) => storageConcept.actions.updateDiagram({ ...localMatch, content, lastModifiedRemoteSha: sha, updatedAt: new Date() }));
      pullPromises.push(updatePromise);
    } else {
      console.log(`[Pull] Local file "${remoteFile.name}" is already up-to-date. Skipping.`);
    }
  }

  for (const localDiagram of localDiagrams) {
    if (!remoteFilesMap.has(localDiagram.title) && localDiagram.lastModifiedRemoteSha !== null) {
      console.log(`[Sync] Remote file deleted: ${localDiagram.title}. Deleting local...`);
      pullPromises.push(storageConcept.actions.deleteDiagram(localDiagram.id));
    }
  }

  await Promise.all(pullPromises);
}

async function pushChanges(project, token, owner, repo, diagramsPath) {
  const allSyncQueueItems = await storageConcept.actions.getSyncQueueItems();
  const projectSyncQueueItems = allSyncQueueItems.filter(item => item.projectId === project.id);

  if (projectSyncQueueItems.length > 0) {
    console.log(`[Sync] Processing ${projectSyncQueueItems.length} item(s) in sync queue for project ${project.id}...`);
    for (const item of projectSyncQueueItems) {
      const { action, payload } = item;
      const filePath = `${diagramsPath}/${payload.title}`;
      const commitMessage = `[Mermaid-IDE] ${action} diagram: ${payload.title}`;

      try {
        let response;
        switch (action) {
          case 'create':
            response = await gitAbstractionConcept.actions.putContents(owner, repo, filePath, payload.content, commitMessage, null, token);
            const createdDiagram = await storageConcept.actions.getDiagram(item.diagramId);
            if (createdDiagram) {
              createdDiagram.lastModifiedRemoteSha = response.content.sha;
              await storageConcept.actions.updateDiagram(createdDiagram);
            }
            break;
          case 'update':
            response = await gitAbstractionConcept.actions.putContents(owner, repo, filePath, payload.content, commitMessage, payload.sha, token);
            const updatedDiagram = await storageConcept.actions.getDiagram(item.diagramId);
            if (updatedDiagram) {
              updatedDiagram.lastModifiedRemoteSha = response.content.sha;
              await storageConcept.actions.updateDiagram(updatedDiagram);
            }
            break;
          case 'delete':
            await gitAbstractionConcept.actions.deleteContents(owner, repo, filePath, commitMessage, payload.sha, token);
            break;
          case 'rename':
            const oldFilePath = `${diagramsPath}/${payload.oldTitle}`;
            const newFilePath = `${diagramsPath}/${payload.newTitle}`;
            const renameCommitMessage = `[Mermaid-IDE] rename ${payload.oldTitle} to ${payload.newTitle}`;
            await gitAbstractionConcept.actions.deleteContents(owner, repo, oldFilePath, renameCommitMessage, payload.sha, token);
            await gitAbstractionConcept.actions.putContents(owner, repo, newFilePath, payload.content, renameCommitMessage, null, token);
            break;
        }
        await storageConcept.actions.deleteSyncQueueItem(item.id);
        console.log(`[Sync] Successfully processed queue item #${item.id} (${action})`);
      } catch (error) {
        // --- FIX: Handle 409 Conflict during push ---
        // This should now be rare, but as a safeguard, if we get a 409 it means the remote
        // changed after our pull check. We should discard the local change and let the
        // next sync cycle's pull phase correct the local state.
        if (error.message.includes('409')) {
          console.error(`[Sync] A 409 conflict occurred during push for "${payload.title}". The remote was updated before this push. Discarding local change and pulling remote version.`);
          await storageConcept.actions.deleteSyncQueueItem(item.id); // Remove the failed item from the queue

          // --- FIX: Immediately fetch the remote version to resolve the conflict ---
          const remoteContent = await gitAbstractionConcept.actions.getContents(owner, repo, filePath, token);
          const diagramToUpdate = await storageConcept.actions.getDiagram(item.diagramId);
          if (diagramToUpdate) {
            diagramToUpdate.content = remoteContent.content;
            diagramToUpdate.lastModifiedRemoteSha = remoteContent.sha;
            await storageConcept.actions.updateDiagram(diagramToUpdate);
          }
        } else if (item.action === 'delete' && error.message.includes('404')) {
          console.warn(`[Sync] Delete failed with 404 for queue item #${item.id}. File likely already deleted. Removing from queue.`);
          await storageConcept.actions.deleteSyncQueueItem(item.id); // Remove the failed item from the queue
        } else {
          console.error(`[Sync] Failed to process queue item #${item.id} (${action}):`, error);
          // For other errors, we leave the item in the queue to be retried.
        }
      }
    }
  }
}