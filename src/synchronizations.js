import { storageConcept } from './concepts/storageConcept.js';
import { projectConcept } from './concepts/projectConcept.js';
import { diagramConcept } from './concepts/diagramConcept.js';
import { uiConcept } from './concepts/uiConcept.js';
import { tracer } from './utils/tracer.js';

// --- Synchronization Rules ---

// When storage finishes listing projects, update the project concept's state.
storageConcept.subscribe((event, payload) => {
    if (event === 'projectsListed') {
        projectConcept.listen('setProjects', payload);
    }
    if (event === 'projectCreated' && payload.isDefault) {
        // This is the new synchronization for the default project.
        const defaultDiagramContent = `graph TD
    A[Start] --> B{Is it?};
    B -- Yes --> C[OK];
    C --> D[End];
    B -- No --> E[Find out];
    E --> B;`;
        diagramConcept.listen('createDiagram', { name: 'generic', projectId: payload.id, content: defaultDiagramContent });
    }
    if (event === 'projectCreated') {
        projectConcept.listen('handleProjectCreated', payload);
    }
    if (event === 'databaseOpened') {
        // Now that the database is open, we can safely load projects.
        projectConcept.listen('loadProjects');
    }
    if (event === 'projectDeleted') {
        projectConcept.listen('loadProjects'); // Reload to update the list
    }
    // --- Storage -> Diagram ---
    if (event === 'diagramsListed') {
        // Get the project from the projectConcept state to provide context.
        const projectState = projectConcept.getState();
        const project = projectState.projects.find(p => p.id === payload.projectId);
        diagramConcept.listen('setDiagrams', { diagrams: payload.diagrams, project });
    }
    if (event === 'diagramLoaded') {
        diagramConcept.listen('handleDiagramLoaded', payload);
    }
    if (event === 'diagramSaved') {
        diagramConcept.listen('handleDiagramSaved', payload);
    }
    if (event === 'diagramDeleted') {
        diagramConcept.listen('handleDiagramDeleted', payload);
    }
});

// When the project concept wants to do something with storage, tell storage.
projectConcept.subscribe((event, payload) => {
    if (event.startsWith('do:')) {
        storageConcept.listen(event, payload);
    }
    // --- Project -> Diagram ---
    if (event === 'projectChanged') {
        diagramConcept.listen('loadDiagrams', payload);
    }
    if (event === 'projectsUpdated' && payload.currentProjectId === null) {
        diagramConcept.listen('loadDiagrams', { projectId: null });
    }
    // --- Project -> UI ---
    if (event === 'projectsUpdated') {
        uiConcept.listen('renderProjectSelector', payload);
        // This is the fix: When projects are updated (e.g., on initial load),
        // immediately trigger the diagram loading for the current project.
        // This is now handled by the 'projectChanged' event, which is more robust.
        // No action needed here anymore.
    }
});

// When the diagram concept wants to do something with storage, tell storage.
diagramConcept.subscribe((event, payload) => {
    if (event === 'do:downloadFile') {
        // This is a UI action, not a storage action.
        uiConcept.listen('downloadFile', payload);
    } else if (event.startsWith('do:')) {
        storageConcept.listen(event, payload);
    }
    // --- Diagram -> UI ---
    if (event === 'diagramsUpdated') {
        uiConcept.listen('renderDiagramList', payload);
        tracer.endTrace(); // End the trace after the final UI update is triggered.
    }
    if (event === 'diagramSelectionChanged') {
        uiConcept.listen('updateActiveDiagramSelection', payload);
        tracer.endTrace(); // End the trace after the selection update.
    }
    if (event === 'do:showNewDiagramModal') {
        uiConcept.listen('showNewDiagramModal');
    }
    if (event === 'diagramContentChanged') {
        // This is for split-view auto-render.
        // We can check a flag on the uiConcept if we want to be more specific.
        const { currentDiagram } = diagramConcept.getState();
        if (currentDiagram) {
            uiConcept.listen('renderMermaidDiagram', { content: currentDiagram.content });
        }
    }
    if (event === 'diagramContentLoaded') {
        const projectState = projectConcept.getState();
        const currentProject = projectState.projects.find(p => p.id === projectState.currentProjectId);

        // When no diagram is loaded, the editor should be empty to show the placeholder.
        uiConcept.listen('renderEditor', { content: payload.diagram?.content ?? '' });
        uiConcept.listen('renderFileInfo', {
            projectName: currentProject?.name,
            diagramName: payload.diagram?.name || '',
        });
        // When content is loaded, update button states. A diagram being loaded means they should be enabled.
        // If payload.diagram is null, it means no diagram is active, so they should be disabled.
        uiConcept.listen('updateButtonStates', { currentDiagram: payload.diagram });
        // When no diagram is loaded, show a helpful message in the diagram view.
        const initialContent = payload.diagram?.content || 'graph TD\n  A["Create a new diagram or select one from the list"];';
        uiConcept.listen('renderMermaidDiagram', { content: initialContent });

    }
});

// When the UI emits an event, update the appropriate state concept.
uiConcept.subscribe((event, payload) => {
    if (event === 'ui:projectSelected') {
        projectConcept.listen('setCurrentProject', payload);
    }
    if (event === 'ui:diagramSelected') {
        diagramConcept.listen('setCurrentDiagram', payload);
    }
    if (event === 'ui:newProjectClicked') {
        projectConcept.listen('createProject', payload);
    }
    if (event === 'ui:deleteProjectClicked') {
        const { currentProjectId, projects } = projectConcept.getState();
        const currentProject = projects.find(p => p.id === currentProjectId);
        if (currentProject && confirm(`Are you sure you want to delete project "${currentProject.name}"? This cannot be undone.`)) {
            projectConcept.listen('deleteProject', { projectId: currentProjectId });
        }
    }
    if (event === 'ui:createDiagramClicked') {
        const { currentProjectId } = projectConcept.getState();
        if (currentProjectId) {
            diagramConcept.listen('createDiagram', { name: payload.name, projectId: currentProjectId });
        } else {
            alert("Please select a project first.");
        }
    }
    if (event === 'ui:editorContentChanged') {
        // Use the debounced version for performance
        diagramConcept.listen('debouncedUpdateCurrentDiagramContent', payload);
    }
    if (event === 'ui:saveDiagramClicked') {
        diagramConcept.listen('saveCurrentDiagram');
    }
    if (event === 'ui:deleteDiagramClicked') {
        const { currentDiagram } = diagramConcept.getState();
        if (currentDiagram && confirm(`Are you sure you want to delete "${currentDiagram.name}"?`)) {
            diagramConcept.listen('deleteDiagram', { diagramId: currentDiagram.id });
        }
    }
    if (event === 'ui:renameDiagramClicked') {
        const { currentDiagram } = diagramConcept.getState();
        if (currentDiagram) {
            const newName = prompt("Enter new name:", currentDiagram.name);
            if (newName && newName.trim()) {
                diagramConcept.listen('renameDiagram', { diagramId: currentDiagram.id, newName: newName.trim() });
            }
        }
    }
    if (event === 'ui:splitViewToggled') {
        uiConcept.listen('toggleSplitView');
    }
    if (event === 'ui:tabSelected') {
        uiConcept.listen('switchTab', payload);
    }
    if (event === 'ui:renderDiagramRequested') {
        const { currentDiagram } = diagramConcept.getState();
        if (currentDiagram) {
            uiConcept.listen('renderMermaidDiagram', { content: currentDiagram.content });
        }
    }
    if (event === 'ui:exportMmdClicked') {
        // This logic is now handled in diagramConcept.js
        diagramConcept.listen('exportCurrentDiagramAsMmd');
    }
    if (event === 'ui:exportJsonLdClicked') {
        const { currentDiagram } = diagramConcept.getState();
        if (currentDiagram) {
            const jsonLd = {
                '@context': { '@vocab': 'https://schema.org/', 'MermaidModel': 'https://example.org/ontology/MermaidModel' },
                '@id': `urn:uuid:${crypto.randomUUID()}`,
                '@type': 'MermaidModel',
                name: currentDiagram.name,
                content: currentDiagram.content,
                dateModified: new Date().toISOString(),
            };
            uiConcept.listen('downloadFile', {
                filename: `${currentDiagram.name}.jsonld`,
                content: JSON.stringify(jsonLd, null, 2),
                mimeType: 'application/ld+json'
            });
        } else {
            alert("Please open a diagram to export.");
        }
    }
    if (event === 'ui:downloadProjectClicked') {
        const { diagrams } = diagramConcept.getState();
        const { projects, currentProjectId } = projectConcept.getState();
        const currentProject = projects.find(p => p.id === currentProjectId);
        // This requires JSZip, which is a global. We can handle this directly in the UI concept or here.
        // For now, let's keep the logic here.
        if (currentProject && diagrams.length > 0) {
            const zip = new JSZip();
            diagrams.forEach(d => zip.file(`${d.name}.mmd`, d.content));
            zip.generateAsync({ type: "blob" }).then(blob => {
                uiConcept.listen('downloadFile', {
                    filename: `${currentProject.name}.zip`,
                    content: blob,
                    mimeType: 'application/zip'
                });
            });
        } else {
            alert("Current project is empty or not selected.");
        }
    }
    if (event === 'ui:uploadMmdClicked') {
        console.log('Synchronization layer received ui:uploadMmdClicked event.');
        const { files } = payload;
        const { currentProjectId } = projectConcept.getState();

        if (!currentProjectId) {
            console.warn('Upload cancelled: No project selected.');
            alert("Please select a project before uploading diagrams.");
            return;
        }

        if (!files || files.length === 0) {
            console.log('No files were selected in the file dialog.');
            return;
        }

        console.log(`Processing ${files.length} uploaded file(s).`);
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const name = file.name.endsWith('.mmd') ? file.name.slice(0, -4) : file.name;
                console.log(`Creating diagram "${name}" in project ID ${currentProjectId}.`);
                diagramConcept.listen('createDiagram', { name, content, projectId: currentProjectId });
            };
            reader.readAsText(file);
        }
    }
});

/**
 * Initializes the application by setting up the UI and starting the database connection.
 * This should be called from the main entry point of the application (e.g., index.html).
 */
export function initializeApp() {
    uiConcept.listen('initialize'); // Set up the initial UI state (like theme)
    storageConcept.listen('do:open'); // This will eventually trigger a chain reaction
}

// --- DEBUGGING: Expose concepts to the console ---
if (typeof window !== 'undefined') {
    window.concepts = { storageConcept, projectConcept, diagramConcept, uiConcept };
}