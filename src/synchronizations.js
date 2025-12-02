/**
 * @file synchronizations.js
 * @description This file defines the declarative links between different "Concepts".
 * It follows the "Concepts and Synchronizations" architecture, where all cross-concept
 * interactions are explicitly defined here. It also manages the application's
 * initialization sequence.
 */

import { storageConcept } from './concepts/storageConcept.js';
import { securityConcept } from './concepts/securityConcept.js';
import { gitAbstractionConcept } from './concepts/gitAbstractionConcept.js';
import { githubAdapter } from './github.js';
import { gitlabAdapter } from './gitlab.js';
import { projectConcept } from './concepts/projectConcept.js';
import { syncConcept } from './concepts/syncConcept.js';
import { diagramConcept } from './concepts/diagramConcept.js';
import { uiConcept } from './concepts/uiConcept.js';

/**
 * A list of declarative rules that define how concepts interact.
 * Each rule specifies that when a 'from' concept emits a 'when' event,
 * a 'do' action is triggered.
 * @type {Array<{when: string, from: object, do: Function}>}
 */
export const synchronizations = [
  {
    when: 'projectsLoadRequested',
    from: projectConcept,
    do: async () => {
      console.log('[Sync] Handling projectsLoadRequested...');
      const projects = await storageConcept.actions.getAllProjects();
      if (projects.length === 0) {
        console.log('[Sync] No projects found. Creating a default local project.');
        const defaultProject = {
          name: 'Default Project',
          gitProvider: 'local',
          repositoryPath: null,
          lastSyncSha: null,
        };
        await storageConcept.actions.addProject(defaultProject);
        // After creating the default project, reload projects to get its ID, then create a default diagram.
        const reloadedProjects = await storageConcept.actions.getAllProjects();
        projectConcept.actions.setProjects(reloadedProjects);
        if (reloadedProjects.length > 0) {
          const defaultProjectId = reloadedProjects[0].id;
          console.log(`[Sync] Creating a default 'example.mmd' for project ID: ${defaultProjectId}`);
          diagramConcept.actions.createDiagram({ name: 'example.mmd', projectId: defaultProjectId, content: 'graph TD\n    A[Start] --> B{Is it?};\n    B -- Yes --> C[OK];\n    C --> D[End];\n    B -- No --> E[Find out];\n    E --> B;' });
        }
      } else {
        projectConcept.actions.setProjects(projects);
      }
    },
  },
  {
    when: 'projectSelected',
    from: projectConcept,
    do: (project) => {
      if (project) {
        // Configure the Git Abstraction Layer for the selected project's provider.
        const provider = project.gitProvider?.toLowerCase();
        const adapters = {
          github: githubAdapter,
          gitlab: gitlabAdapter,
        };
        const adapter = adapters[provider];
        if (provider !== 'local' && adapter) {
          gitAbstractionConcept.actions.setProvider(provider, adapter);
        }

        console.log(`[Sync] Project ${project.id} selected. Loading its diagrams.`);
        // For remote projects, if the session is not already unlocked, prompt the user for the password.
        if (provider !== 'local' && !securityConcept.state.decryptedToken) {
          console.log('[Sync] Session is locked. Showing unlock modal.');
          uiConcept.actions.showUnlockSessionModal({ projectName: project.name });
          return; // Stop further processing until unlocked
        } else {
          // For local projects, or unlocked remote projects, load the diagrams immediately.
          console.log('[Sync] Project is local or session is unlocked. Proceeding to load diagrams.');
          diagramConcept.actions.loadDiagramsForProject({ projectId: project.id });
        }
      } else {
        // Handle case where project is deselected
        diagramConcept.actions.setDiagrams([]);
        console.log('[Sync] No project selected. Cleared diagram list.');
      }
    },
  },
  {
    when: 'diagramsLoadRequested',
    from: diagramConcept,
    do: async ({ projectId }) => {
      console.log(`[Sync] Handling diagramsLoadRequested for project ${projectId}...`);
      const diagrams = await storageConcept.actions.getDiagramsByProjectId(projectId);
      diagramConcept.actions.setDiagrams(diagrams);
    },
  },
  {
    when: 'diagramCreationRequested',
    from: diagramConcept,
    do: async ({ name, projectId, content, skipSyncTrigger = false }) => {
      // Ensure the diagram name ends with .mmd
      const finalName = name.endsWith('.mmd') ? name : `${name}.mmd`;

      console.log(`[Sync] Handling diagramCreationRequested: "${finalName}" in project ${projectId}`);

      // --- Pre-creation Validation ---
      const existingDiagrams = await storageConcept.actions.getDiagramsByProjectId(projectId);
      if (existingDiagrams.some(d => d.title === finalName)) {
        const message = `A diagram named "${finalName}" already exists in this project.`;
        console.error(`[Sync] ${message}`);
        uiConcept.actions.showNotification({ message, type: 'error' });
        return; // Stop the creation process
      }

      const newDiagram = {
        projectId,
        title: finalName,
        content: content || `graph TD\n    A[New Diagram] --> B[Edit Me];`,
        lastModifiedRemoteSha: null, // This is a new local file, not yet on the remote
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        const newId = await storageConcept.actions.addDiagram(newDiagram);
        await storageConcept.actions.addSyncQueueItem({
          diagramId: newId,
          projectId: projectId, // Add the project ID to the sync queue item
          action: 'create',
          payload: { title: finalName, content: newDiagram.content },
          attempts: 0,
          createdAt: new Date(),
        });
        // After successfully adding, reload the diagram list for the project to reflect the change.
        diagramConcept.actions.loadDiagramsForProject({ projectId });
        // --- NEW ---
        // And immediately select the new diagram to be active in the editor.
        diagramConcept.actions.loadDiagramContent({ diagramId: newId });
        if (!skipSyncTrigger) {
          syncConcept.actions.triggerSync(); // Trigger sync after creating a diagram
        }
        console.log(`[Sync] Diagram "${name}" created and added to sync queue.`);
      } catch (error) {
        console.error('[Sync] Failed to create diagram or add to sync queue:', error);
      }
    },
  },
  {
    when: 'diagramSaveRequested',
    from: diagramConcept,
    do: async ({ diagram }) => {
      console.log(`[Sync] Handling diagramSaveRequested for diagram ID: ${diagram.id}`);
      const activeProjectId = projectConcept.state.activeProjectId;
      const diagramToSave = {
        ...diagram,
        updatedAt: new Date(),
      };

      try {
        // Before adding a new 'update' task, check if there's already a 'create' task for this diagram.
        const queue = await storageConcept.actions.getSyncQueueItems();
        const pendingCreate = queue.find(item => item.diagramId === diagram.id && item.action === 'create');

        if (pendingCreate) {
          // If a 'create' task exists, update it instead of adding a new 'update' task.
          console.log(`[Sync] Found pending 'create' for diagram ${diagram.id}. Updating it with new content.`);
          pendingCreate.payload.content = diagramToSave.content;
          await storageConcept.actions.addSyncQueueItem(pendingCreate); // 'put' will update the existing item.
        } else {
          // If no 'create' task, add a new 'update' task as usual.
          await storageConcept.actions.addSyncQueueItem({
            diagramId: diagram.id,
            projectId: activeProjectId, // Get the active project ID directly
            action: 'update',
            payload: { title: diagram.title, content: diagram.content, sha: diagram.lastModifiedRemoteSha },
            attempts: 0,
            createdAt: new Date(),
          });
        }

        await storageConcept.actions.updateDiagram(diagramToSave);
        syncConcept.actions.triggerSync(); // Trigger sync after saving a diagram
        console.log(`[Sync] Diagram ${diagram.id} saved successfully to IndexedDB.`);
        // Optionally, we could emit a new event like 'diagramSavedSuccessfully'
        // for the UI to listen to, e.g., to show a "Saved!" notification.
      } catch (error) {
        console.error(`[Sync] Failed to save diagram ${diagram.id}:`, error);
      }
    },
  },
  {
    when: 'diagramContentLoadRequested',
    from: diagramConcept,
    do: async ({ diagramId }) => {
      console.log(`[Sync] Handling diagramContentLoadRequested for diagram ID: ${diagramId}`);
      try {
        const diagram = await storageConcept.actions.getDiagram(diagramId);
        if (diagram) {
          diagramConcept.actions.setActiveDiagram(diagram);
        } else {
          console.warn(`[Sync] Diagram with ID ${diagramId} not found in storage.`);
        }
      } catch (error) {
        console.error(`[Sync] Failed to load content for diagram ${diagramId}:`, error);
      }
    },
  },
  {
    when: 'projectCreationRequested',
    from: projectConcept,
    do: async ({ gitProvider, name, repositoryPath, token, password }) => {
      console.log(`[Sync] Handling projectCreationRequested for provider: ${gitProvider}, name: ${name || repositoryPath}`);
      uiConcept.actions.showNotification({ message: `Creating project "${name || repositoryPath}"...`, type: 'info' });
      try {
        let newProject;

        if (gitProvider === 'local') {
          // For local projects, no Git interaction is needed.
          console.log(`[Sync] Creating local project: "${name}"`);
          newProject = {
            name: name,
            gitProvider: 'local',
            repositoryPath: null,
            defaultBranch: null,
            lastSyncSha: null,
            encryptedToken: null, // No token for local projects
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        } else {
          // Existing logic for Git-connected projects
          const provider = gitProvider.toLowerCase();
          const adapters = {
            github: githubAdapter,
            gitlab: gitlabAdapter,
          };

          const adapter = adapters[provider];
          if (!adapter) {
            throw new Error(`Provider "${gitProvider}" is not supported.`);
          }

          // 1. Configure the Git Abstraction Layer
          gitAbstractionConcept.actions.setProvider(provider, adapter);

          // 2. Validate repository and get default branch
          let owner, repo;
          try {
            // Handle full URLs by extracting the path
            const url = new URL(repositoryPath);
            const pathParts = url.pathname.split('/').filter(p => p); // e.g., ['Skreen5hot', 'vanilla']
            owner = pathParts[0];
            repo = pathParts[1];
          } catch (e) {
            // Not a URL, assume it's already in owner/repo format
            [owner, repo] = repositoryPath.split('/');
          }
          if (!owner || !repo) throw new Error('Invalid repository path format. Must be "owner/repo" or a full URL.');
          console.log('[Sync] Validating repository...');
          const repoInfo = await gitAbstractionConcept.actions.getRepoInfo(owner, repo, token);
          const defaultBranch = repoInfo.default_branch;
          console.log(`[Sync] Repository validated. Default branch: ${defaultBranch}.`);

          // 3. Encrypt the token
          const encryptedToken = await securityConcept.actions.encryptToken(token, password);
          console.log('[Sync] Token encrypted successfully.');

          // --- FIX: Unlock the session with the provided token for immediate use ---
          // This makes the token available for the initial sync.
          securityConcept.state.decryptedToken = token;

          // 4. Prepare the project object for storage
          newProject = {
            name: name || repositoryPath, // Use provided name, or repositoryPath as default
            gitProvider,
            repositoryPath: `${owner}/${repo}`, // Store the canonical owner/repo path
            defaultBranch,
            lastSyncSha: null,
            encryptedToken, // This is an object: { ciphertext, salt, iv }
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }

        // 5. Save the new project to IndexedDB
        const newProjectId = await storageConcept.actions.addProject(newProject); // Capture the new ID
        console.log('[Sync] New project saved successfully.');

        // --- FIX: Await the project list reload to prevent a race condition ---
        // 6. Create a promise that resolves when projects are loaded.
        const projectsLoadedPromise = new Promise(resolve => {
          const tempSub = (event, payload) => {
            if (event === 'projectsLoaded') {
              projectConcept.unsubscribe(tempSub); // Clean up the temporary subscriber
              resolve(payload);
            }
          };
          projectConcept.subscribe(tempSub);
        });

        // 7. Trigger the reload and wait for it to complete.
        projectConcept.actions.loadProjects();
        await projectsLoadedPromise;

        // 8. Now that the state is updated, set the newly created project as active.
        projectConcept.actions.setActiveProject(newProjectId);

        // --- FIX: Trigger an initial sync to pull diagrams from the new repo ---
        syncConcept.actions.triggerSync();

        // 9. Close the modal and show a success notification
        uiConcept.actions.hideConnectProjectModal();
        uiConcept.actions.showNotification({ // Use the project's actual name for the notification
          message: `Project "${newProject.name}" connected successfully!`,
          type: 'success',
        });
      } catch (error) {
        console.error('[Sync] Failed to create project:', error);
        uiConcept.actions.showNotification({
          message: `Failed to connect project: ${error.message}`,
          type: 'error',
        });
      }
    },
  },
  {
    when: 'diagramDeletionRequested',
    from: diagramConcept,
    do: async ({ diagramId }) => {
      console.log(`[Sync] Handling diagramDeletionRequested for diagram ID: ${diagramId}`);
      const activeProjectId = projectConcept.state.activeProjectId;

      try {
        // Before deleting the diagram record, get its info for the sync queue
        const diagramToDelete = await storageConcept.actions.getDiagram(diagramId);
        if (diagramToDelete && diagramToDelete.lastModifiedRemoteSha) {
          await storageConcept.actions.addSyncQueueItem({
            diagramId: diagramId, // Keep ID for reference, even though record will be gone
            projectId: diagramToDelete.projectId, // Add the project ID to the sync queue item
            action: 'delete',
            payload: { title: diagramToDelete.title, sha: diagramToDelete.lastModifiedRemoteSha },
            attempts: 0,
            createdAt: new Date(),
          });
          syncConcept.actions.triggerSync(); // Trigger sync after deleting a diagram
        } else if (diagramToDelete) {
          // --- FIX: Handle deletion of a local-only diagram that might be in the sync queue ---
          // If the diagram has no remote SHA, it was never synced. We must remove any pending
          // 'create' or 'update' actions for it from the sync queue to prevent it from being
          // created on the remote after it has been deleted locally.
          const queue = await storageConcept.actions.getSyncQueueItems();
          const pendingItem = queue.find(item => item.diagramId === diagramId);
          if (pendingItem) await storageConcept.actions.deleteSyncQueueItem(pendingItem.id);
          console.log(`[Sync] Purged pending sync queue item for local-only diagram ${diagramId}.`);
        }

        await storageConcept.actions.deleteDiagram(diagramId);
        console.log(`[Sync] Diagram ${diagramId} deleted successfully from IndexedDB.`);

        // If the deleted diagram was the one being viewed, clear the view.
        if (diagramConcept.state.activeDiagram?.id === diagramId) {
          diagramConcept.actions.clearActiveDiagram();
        }

        // Refresh the diagram list for the current project.
        if (activeProjectId) {
          console.log('[Sync] Refreshing diagram list after deletion.');
          diagramConcept.actions.loadDiagramsForProject({ projectId: activeProjectId });
        }
      } catch (error) {
        console.error(`[Sync] Failed to delete diagram ${diagramId}:`, error);
      }
    },
  },

  // --- UI Synchronizations ---

  // --- App State -> UI Renders ---

  {
    when: 'projectsLoaded',
    from: projectConcept,
    do: (projects) => {
      uiConcept.actions.renderProjectSelector({
        projects,
        activeProjectId: projectConcept.state.activeProjectId,
      });
      // If projects exist but none are active, automatically select the first one.
      // This handles the initial application load.
      if (projects.length > 0 && !projectConcept.state.activeProjectId) {
        console.log('[Sync] No active project. Auto-selecting the first project.');
        projectConcept.actions.setActiveProject(projects[0].id);
      }
    },
  },
  {
    when: 'diagramsLoaded',
    from: diagramConcept,
    do: (diagrams) => {
      uiConcept.actions.renderDiagramList({
        diagrams,
        activeDiagramId: diagramConcept.state.activeDiagram?.id,
      });
    },
  },
  {
    when: 'activeDiagramSet',
    from: diagramConcept,
    do: (diagram) => {
      const project = projectConcept.state.projects.find(p => p.id === projectConcept.state.activeProjectId);
      uiConcept.actions.renderEditor({ content: diagram?.content || '' });
      uiConcept.actions.renderFileInfo({ project, diagram });
      uiConcept.actions.updateButtonStates({ diagram });
      uiConcept.actions.updateActiveDiagramSelection({ activeDiagramId: diagram?.id });
      // Automatically render the diagram when it's set
      uiConcept.actions.renderMermaidDiagram({ content: diagram?.content });
    },
  },

  // --- UI Events -> App Logic ---

  {
    when: 'ui:projectSelected',
    from: uiConcept,
    do: ({ projectId }) => {
      projectConcept.actions.setActiveProject(projectId);
    },
  },
  {
    when: 'ui:diagramSelected',
    from: uiConcept,
    do: ({ diagramId }) => {
      diagramConcept.actions.loadDiagramContent({ diagramId });
    },
  },
  {
    when: 'ui:createDiagramClicked',
    from: uiConcept,
    do: ({ name }) => {
      const projectId = projectConcept.state.activeProjectId;
      if (projectId) {
        diagramConcept.actions.createDiagram({ name, projectId });
      } else {
        alert('Please select a project first.');
      }
    },
  },
  {
    when: 'ui:editorContentChanged',
    from: uiConcept,
    do: ({ content }) => {
      diagramConcept.actions.updateActiveDiagramContent(content);
    },
  },
  {
    when: 'ui:saveDiagramClicked',
    from: uiConcept,
    do: () => {
      diagramConcept.actions.saveActiveDiagram();
    },
  },
  {
    when: 'ui:deleteDiagramClicked',
    from: uiConcept,
    do: () => {
      const diagram = diagramConcept.state.activeDiagram;
      if (diagram && diagram.id) {
        if (confirm(`Are you sure you want to delete the diagram "${diagram.title}"?`)) {
          diagramConcept.actions.deleteDiagram({ diagramId: diagram.id });
        }
      } else {
        console.warn('[Sync] Delete clicked, but no saved diagram is active.');
      }
    },
  },
  {
    when: 'ui:renameDiagramClicked',
    from: uiConcept,
    do: ({ diagramId, newTitle }) => {
      diagramConcept.actions.renameDiagram({ diagramId, newTitle });
    },
  },
  {
    when: 'diagramRenameRequested',
    from: diagramConcept,
    do: async ({ diagramId, newTitle }) => {
      try {
        const diagram = await storageConcept.actions.getDiagram(diagramId);
        if (!diagram) throw new Error('Diagram not found for renaming.');

        const oldTitle = diagram.title;
        diagram.title = newTitle;
        diagram.updatedAt = new Date();

        // 1. Update the diagram in the local DB with the new name.
        await storageConcept.actions.updateDiagram(diagram);

        // 2. Add a 'rename' action to the sync queue.
        await storageConcept.actions.addSyncQueueItem({
          diagramId: diagram.id,
          projectId: diagram.projectId, // Add the project ID to the sync queue item
          action: 'rename',
          payload: {
            oldTitle: oldTitle,
            newTitle: newTitle,
            content: diagram.content,
            sha: diagram.lastModifiedRemoteSha, // The SHA of the file to be deleted.
          },
          attempts: 0,
          createdAt: new Date(),
        });

        // 3. Refresh the UI to show the new name.
        diagramConcept.actions.loadDiagramsForProject({ projectId: diagram.projectId });
        diagramConcept.actions.setActiveDiagram(diagram); // Update the active diagram state
        syncConcept.actions.triggerSync(); // Trigger sync after renaming a diagram
      } catch (error) {
        console.error('[Sync] Failed to process diagram rename:', error);
        uiConcept.actions.showNotification({ message: `Error renaming diagram: ${error.message}`, type: 'error' });
      }
    },
  },
  {
    when: 'projectDeletionRequested',
    from: projectConcept,
    do: async ({ projectId }) => {
      const project = projectConcept.state.projects.find(p => p.id === projectId);
      if (!project) {
        return console.warn(`[Sync] Project deletion requested for non-existent ID: ${projectId}`);
      }

      if (confirm(`Are you sure you want to delete the project "${project.name}" and all its diagrams? This cannot be undone.`)) {
        console.log(`[Sync] Handling projectDeletionRequested for project ID: ${projectId}`);
        try {
          console.log('[Sync] Deleting associated diagrams and project from storage...');
          // 1. Delete all associated diagrams
          await storageConcept.actions.deleteDiagramsByProjectId(projectId);

          // 2. Delete the project itself
          await storageConcept.actions.deleteProject(projectId);
          console.log(`[Sync] Project ${projectId} and its diagrams deleted successfully.`);

          // 3. Refresh the project list to update the state and UI
          console.log('[Sync] Reloading project list...');
          projectConcept.actions.loadProjects();
        } catch (error) {
          console.error(`[Sync] Failed to delete project ${projectId}:`, error);
        }
      }
    },
  },
  {
    when: 'ui:unlockSessionClicked',
    from: uiConcept,
    do: async ({ password }) => {
      const project = projectConcept.state.projects.find(p => p.id === projectConcept.state.activeProjectId);
      if (!project) return;

      try {
        console.log(`[Sync] Attempting to decrypt token for project "${project.name}"...`);
        await securityConcept.actions.decryptToken(project.encryptedToken, password);
        uiConcept.actions.hideUnlockSessionModal();
        // Now that we are unlocked, proceed with loading the diagrams for the selected project.
        diagramConcept.actions.loadDiagramsForProject({ projectId: project.id });
      } catch (error) {
        // The decryptToken action already logs the error, so we just update the UI.
        const errorEl = document.getElementById('unlock-error');
        if (errorEl) errorEl.style.display = 'block';
      }
    },
  },
  {
    when: 'tokenDecryptionFailed',
    from: securityConcept,
    do: () => {
      // This is an alternative way to show the error, listening to the security concept directly.
      const errorEl = document.getElementById('unlock-error');
      if (errorEl) errorEl.style.display = 'block';
    },
  },
  {
    when: 'ui:connectProjectClicked',
    from: uiConcept,
    do: (payload) => {
      projectConcept.actions.createProject(payload);
    },
  },
  {
    when: 'ui:projectSettingsClicked',
    from: uiConcept,
    do: () => {
      const activeProjectId = projectConcept.state.activeProjectId;
      const activeProject = projectConcept.state.projects.find(p => p.id === activeProjectId);

      if (activeProject) {
        uiConcept.actions.showProjectSettingsModal({ project: activeProject });
      } else {
        console.warn('[Sync] Project settings clicked, but no active project found.');
      }
    },
  },
  {
    when: 'ui:renameProjectConfirmed',
    from: uiConcept,
    do: async ({ projectId, newName }) => {
      console.log(`[Sync] Handling rename for project ${projectId} to "${newName}".`);
      try {
        // 1. Validate that the new name is not already in use by another project.
        const allProjects = await storageConcept.actions.getAllProjects();
        if (allProjects.some(p => p.name === newName && p.id !== projectId)) {
          throw new Error(`A project named "${newName}" already exists.`);
        }

        // 2. Get the project, update its name, and save it back.
        const projectToUpdate = allProjects.find(p => p.id === projectId);
        if (!projectToUpdate) throw new Error('Project not found.');

        projectToUpdate.name = newName;
        projectToUpdate.updatedAt = new Date();
        await storageConcept.actions.updateProject(projectToUpdate);

        // 3. Refresh the project list and close the modal.
        projectConcept.actions.loadProjects();
        uiConcept.actions.hideProjectSettingsModal();
        uiConcept.actions.showNotification({ message: 'Project renamed successfully!', type: 'success' });
      } catch (error) {
        console.error('[Sync] Failed to rename project:', error);
        uiConcept.actions.showNotification({ message: `Rename failed: ${error.message}`, type: 'error' });
      }
    },
  },
  {
    when: 'ui:diagramsUploaded',
    from: uiConcept,
    do: ({ diagrams }) => {
      const projectId = projectConcept.state.activeProjectId;
      if (!projectId) {
        return uiConcept.actions.showNotification({ message: 'Please select a project before uploading.', type: 'error' });
      }

      console.log(`[Sync] Handling upload of ${diagrams.length} diagrams to project ${projectId}.`);

      // Use the existing diagram creation flow for each uploaded file.
      // This ensures validation, sync queueing, and UI updates are all handled correctly.
      const creationPromises = diagrams.map(diagram => {
        console.log(`[Sync] Queueing creation for uploaded file: "${diagram.name}"`);
        // Pass skipSyncTrigger: true to prevent a sync storm.
        return diagramConcept.actions.createDiagram({ name: diagram.name, projectId, content: diagram.content, skipSyncTrigger: true });
      })

      // Once all diagrams are processed, trigger a single sync.
      Promise.all(creationPromises).then(() => {
        console.log('[Sync] Bulk upload processing finished. Triggering a single sync.');
        syncConcept.actions.triggerSync();
        uiConcept.actions.showNotification({ message: `Successfully imported ${diagrams.length} diagram(s).`, type: 'success' });
      })
    },
  },
  {
    when: 'ui:exportMmdClicked',
    from: uiConcept,
    do: () => {
      const diagram = diagramConcept.state.activeDiagram;
      console.log('[Sync] Handling export .mmd request.');

      if (diagram && diagram.id) { // Check for a saved diagram
        console.log(`[Sync] Exporting diagram: "${diagram.title}"`);
        uiConcept.actions.downloadFile({
          filename: diagram.title,
          content: diagram.content,
          mimeType: 'text/plain', // .mmd is just plain text
        });
      } else {
        console.warn('[Sync] Export .mmd clicked, but no saved diagram is active.');
        uiConcept.actions.showNotification({ message: 'Please save the diagram before exporting.', type: 'info' });
      }
    },
  },
  {
    when: 'ui:disconnectProjectConfirmed',
    from: uiConcept,
    do: async ({ projectId }) => {
      console.log(`[Sync] Handling disconnect for project ${projectId}.`);
      try {
        const projectToUpdate = await storageConcept.actions.getProject(projectId);
        if (!projectToUpdate) throw new Error('Project not found.');

        // Convert the project to a local-only project
        projectToUpdate.gitProvider = 'local';
        projectToUpdate.repositoryPath = null;
        projectToUpdate.defaultBranch = null;
        projectToUpdate.lastSyncSha = null;
        projectToUpdate.encryptedToken = null;
        projectToUpdate.updatedAt = new Date();

        await storageConcept.actions.updateProject(projectToUpdate);

        // Refresh the project list and close the modal
        projectConcept.actions.loadProjects();
        uiConcept.actions.hideProjectSettingsModal();
        uiConcept.actions.showNotification({ message: 'Project disconnected from Git successfully!', type: 'success' });
      } catch (error) {
        console.error('[Sync] Failed to disconnect project:', error);
        uiConcept.actions.showNotification({ message: `Disconnect failed: ${error.message}`, type: 'error' });
      }
    },
  },
  {
    when: 'ui:deleteLocalProjectConfirmed',
    from: uiConcept,
    do: ({ projectId }) => {
      console.log(`[Sync] Handling confirmed local deletion for project ${projectId}.`);
      // This triggers the 'projectDeletionRequested' synchronization, which handles the actual deletion logic.
      projectConcept.actions.deleteProject(projectId);
      uiConcept.actions.hideProjectSettingsModal();
      uiConcept.actions.showNotification({ message: 'Project deleted locally.', type: 'success' });
    },
  },
  {
    when: 'ui:connectExistingLocalProjectConfirmed',
    from: uiConcept,
    do: async ({ projectId, gitProvider, repositoryPath, token, password }) => {
      console.log(`[Sync] Handling connection of existing project ${projectId} to repo: ${repositoryPath}`);
      uiConcept.actions.showNotification({ message: `Connecting project to ${repositoryPath}...`, type: 'info' });

      try {
        const projectToUpdate = await storageConcept.actions.getProject(projectId);
        if (!projectToUpdate) throw new Error('Project to connect not found.');

        const provider = gitProvider.toLowerCase();
        const adapter = { github: githubAdapter, gitlab: gitlabAdapter }[provider];
        if (!adapter) throw new Error(`Provider "${gitProvider}" is not supported.`);

        gitAbstractionConcept.actions.setProvider(provider, adapter);

        let owner, repo;
        try {
          const url = new URL(repositoryPath);
          [owner, repo] = url.pathname.split('/').filter(p => p);
        } catch (e) {
          [owner, repo] = repositoryPath.split('/');
        }
        if (!owner || !repo) throw new Error('Invalid repository path format. Must be "owner/repo" or a full URL.');

        const repoInfo = await gitAbstractionConcept.actions.getRepoInfo(owner, repo, token);
        const encryptedToken = await securityConcept.actions.encryptToken(token, password);

        // --- FIX: Unlock the session with the provided token ---
        // This makes the token available for the immediate sync trigger.
        securityConcept.state.decryptedToken = token;

        // Update the project object with Git details
        projectToUpdate.gitProvider = gitProvider;
        projectToUpdate.repositoryPath = `${owner}/${repo}`;
        projectToUpdate.defaultBranch = repoInfo.default_branch;
        projectToUpdate.encryptedToken = encryptedToken;
        projectToUpdate.lastSyncSha = null; // Force a full pull on next sync
        projectToUpdate.updatedAt = new Date();

        await storageConcept.actions.updateProject(projectToUpdate);

        // --- FIX: Synchronously update the project state to avoid race condition ---
        const currentProjects = projectConcept.state.projects;
        const projectIndex = currentProjects.findIndex(p => p.id === projectId);
        if (projectIndex !== -1) {
          currentProjects[projectIndex] = projectToUpdate;
          projectConcept.actions.setProjects([...currentProjects]); // Re-render UI with updated project list
        } else {
          projectConcept.actions.loadProjects(); // Fallback to full reload if not found
        }

        uiConcept.actions.hideProjectSettingsModal();
        uiConcept.actions.showNotification({ message: 'Project connected to Git successfully!', type: 'success' });

        // --- FIX: Trigger a sync to push existing local diagrams to the new repo ---
        syncConcept.actions.triggerSync();

      } catch (error) {
        console.error('[Sync] Failed to connect existing project to Git:', error);
        uiConcept.actions.showNotification({ message: `Connection failed: ${error.message}`, type: 'error' });
      }
    },
  },
  {
    when: 'ui:downloadProjectClicked',
    from: uiConcept,
    do: async () => {
      const activeProjectId = projectConcept.state.activeProjectId;
      const activeProject = projectConcept.state.projects.find(p => p.id === activeProjectId);

      if (!activeProject) {
        console.error('[Sync] Download requested, but no active project.');
        return uiConcept.actions.showNotification({ message: 'Please select a project to download.', type: 'error' });
      }

      console.log(`[Sync] Handling download for project "${activeProject.name}". Fetching diagrams...`);

      try {
        const diagrams = await storageConcept.actions.getDiagramsByProjectId(activeProjectId);
        if (diagrams.length === 0) {
          return uiConcept.actions.showNotification({ message: 'Project has no diagrams to download.', type: 'info' });
        }

        console.log(`[Sync] Found ${diagrams.length} diagrams. Creating zip file...`);
        const zip = new JSZip();
        diagrams.forEach(diagram => {
          console.log(`[Sync] Adding "${diagram.title}" to zip.`);
          zip.file(diagram.title, diagram.content);
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const safeProjectName = activeProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${safeProjectName}_project.zip`;

        console.log(`[Sync] Triggering download of "${filename}".`);
        uiConcept.actions.downloadFile({ filename, content: zipBlob });
      } catch (error) {
        console.error('[Sync] Failed to create zip for project download:', error);
        uiConcept.actions.showNotification({ message: 'Failed to download project.', type: 'error' });
      }
    },
  },

  // --- Sync Polling Control ---

  {
    when: 'tokenDecrypted',
    from: securityConcept,
    do: () => {
      console.log('[Sync] Session unlocked. Starting sync polling.');
      syncConcept.actions.startPolling();
    },
  },
  {
    when: 'sessionLocked',
    from: securityConcept,
    do: () => {
      syncConcept.actions.stopPolling();
    },
  },
  {
    when: 'diagramsChanged',
    from: syncConcept,
    do: ({ projectId }) => {
      // If the sync affected the currently active project, reload the diagram list
      // to reflect any new, updated, or deleted files from the remote.
      if (projectConcept.state.activeProjectId === projectId) {
        console.log('[Sync] Refreshing diagram list after remote sync.');
        // This re-uses the existing data flow to fetch the updated list from
        // IndexedDB and render it in the UI.
        diagramConcept.actions.loadDiagramsForProject({ projectId });
      }

      // --- FIX: If the active diagram was affected by the sync, reload its content ---
      // This ensures the editor and diagram preview update immediately after a conflict resolution.
      const activeDiagram = diagramConcept.state.activeDiagram;
      if (activeDiagram && activeDiagram.projectId === projectId) {
        diagramConcept.actions.loadDiagramContent({ diagramId: activeDiagram.id });
      }
    },
  },

  // --- Sync Status UI ---
  {
    when: 'syncStarted',
    from: syncConcept,
    do: () => {
      uiConcept.actions.updateSyncStatus({ status: 'syncing', message: 'Syncing...' });
    },
  },
  {
    when: 'syncCompleted',
    from: syncConcept,
    do: ({ timestamp }) => {
      const time = new Date(timestamp).toLocaleTimeString();
      uiConcept.actions.updateSyncStatus({ status: 'success', message: `Synced at ${time}` });
    },
  },
  {
    when: 'syncError',
    from: syncConcept,
    do: ({ error }) => {
      const message = error.message.includes('401') ? 'Sync failed: Invalid token' : 'Sync failed. Check console.';
      uiConcept.actions.updateSyncStatus({ status: 'error', message });
    },
  },
  {
    when: 'conflictResolved',
    from: syncConcept,
    do: ({ originalTitle, conflictTitle }) => {
      const message = `A conflict was detected for "${originalTitle}".\n\n` +
                      `The file was updated with changes from the server.\n\n` +
                      `Your local changes have been saved to a new file: "${conflictTitle}".`;
      uiConcept.actions.showNotification({ message, type: 'info', duration: 10000 });
    },
  },
];

/**
 * Wires up the synchronizations by subscribing to events from one concept
 * and triggering actions in another.
 */
function setupSubscriptions() {
  synchronizations.forEach((sync) => {
    sync.from.subscribe((event, payload) => {
      if (event === sync.when) {
        sync.do(payload);
      }
    });
  });
}

/**
 * Initializes the application by setting up concept subscriptions and
 * performing initial data loads. This should be called by the main
 * application entry point (e.g., main.js).
 */
export function initializeApp() {
  setupSubscriptions();
  console.log('[App] Initializing application: setting up UI and loading data...');
  uiConcept.actions.initialize(); // Set up UI listeners and element cache
  storageConcept.actions.init().then(() => {
    projectConcept.actions.loadProjects();
  });
}