import { createEventBus } from '../utils/eventBus.js';
import { createIdbBackend } from '../storage/idbBackend.js';
import { Storage } from '../storage/storage.js';
import * as fsaRegistry from '../storage/fsaRegistry.js';
import * as auditLog from '../storage/auditLog.js';
import { migrateLegacyRootIfNeeded } from '../storage/migration.js';
import {
  makeIdbProjectId,
  makeFsaProjectId,
  makeIdbDiagramId,
  makeFsaDiagramId,
  parseStorageId,
  parseFsaDiagramKey,
} from '../storage/projectIds.js';

// Router. Translates compound project/diagram ids ("idb:N" / "fsa:Name") into
// raw IDB integers or FSA paths, dispatches to the correct backend, then
// emits the same external events ('projectCreated', 'diagramSaved', etc.)
// the rest of the concepts already consume — only the id values change shape.
//
// External event shape:
//   projectsListed       [{ id, name, mode }, ...]
//   projectCreated       { id, name, mode }
//   projectDeleted       { projectId }
//   diagramsListed       { diagrams: [{ id, name, projectId, content? }], projectId }
//   diagramLoaded        { id, name, projectId, content, dateModified } | null
//   diagramSaved         { id, name, projectId, content, dateModified }
//   diagramDeleted       { diagramId }
//   databaseOpened       no payload
//   error                string

const bus = createEventBus();
const idb = createIdbBackend();

async function _open() {
  try {
    await idb.open();
    bus.notify('databaseOpened');
  } catch (e) {
    bus.notify('error', `Error opening DB: ${e?.message || e}`);
    return;
  }
  // Best-effort FSA handle restore + v2→v3 migration. Both swallow errors;
  // permission state and migration retries surface via Storage events.
  Storage.init()
    .then(() => migrateLegacyRootIfNeeded())
    .catch(() => {});
}

async function _listProjects() {
  let idbList = [];
  let fsaList = [];
  try {
    idbList = await idb.getAllProjects();
  } catch (e) {
    bus.notify('error', `Failed to list IDB projects: ${e?.message || e}`);
  }

  // Prefer the new per-project registry. If migration hasn't run yet (no
  // rows), fall back to legacy folder listing so existing users see their
  // projects on first load before they reconnect. Migration will populate
  // fsaRegistry on the next permission grant, and subsequent listings will
  // switch to the registry path automatically.
  const fsaRows = await fsaRegistry.list();
  if (fsaRows.length > 0) {
    fsaList = fsaRows.map((row) => ({ id: row.id, name: row.name, mode: 'fsa' }));
  } else if (Storage.isReady()) {
    try {
      const entries = await Storage.list('');
      fsaList = entries
        .filter((e) => e.kind === 'directory')
        .map((e) => ({ id: makeFsaProjectId(e.name), name: e.name, mode: 'fsa' }));
    } catch (e) {
      bus.notify('error', `Failed to list FSA projects: ${e?.message || e}`);
    }
  }

  const merged = [
    ...idbList.map((p) => ({ id: makeIdbProjectId(p.id), name: p.name, mode: 'idb' })),
    ...fsaList,
  ];
  bus.notify('projectsListed', merged);
}

async function _createProject(payload = {}) {
  const { name, mode = 'idb' } = payload;
  if (!name || typeof name !== 'string') {
    bus.notify('error', 'Project name is required');
    return;
  }
  try {
    if (mode === 'fsa') {
      if (!Storage.isReady()) {
        bus.notify('error', 'FSA storage is not ready — pick a folder first');
        return;
      }
      const safe = name.trim();
      const projectId = makeFsaProjectId(safe);
      await Storage.mkdir(safe);
      const defaultDiagramContent =
        'graph TD\n    A[Start] --> B{Is it?};\n    B -- Yes --> C[OK];\n    C --> D[End];\n    B -- No --> E[Find out];\n    E --> B;';
      await Storage.writeText(`${safe}/generic.mmd`, defaultDiagramContent);

      // Register the new project in fsaRegistry so the listing path stays
      // consistent post-migration. Best-effort: if registry insert fails
      // (e.g. duplicate id from a previously-deleted-then-recreated folder),
      // we still emit projectCreated — the legacy folder-listing fallback in
      // _listProjects will surface it.
      try {
        const root = Storage.getRootHandle();
        if (root) {
          const handle = await root.getDirectoryHandle(safe, { create: false });
          await fsaRegistry.add({ id: projectId, name: safe, handle, diagramsPath: '' });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('createProject: fsaRegistry.add failed (non-fatal)', e?.message || e);
      }

      auditLog.append({ action: 'mkdir', projectId, path: safe }).catch(() => {});
      bus.notify('projectCreated', { id: projectId, name: safe, mode: 'fsa' });
    } else {
      const created = await idb.createProject({ name });
      bus.notify('projectCreated', { id: makeIdbProjectId(created.id), name: created.name, mode: 'idb' });
    }
  } catch (e) {
    bus.notify('error', `Failed to create project: ${e?.message || e}`);
  }
}

async function _deleteProject({ projectId }) {
  try {
    const parsed = parseStorageId(projectId);
    if (parsed.mode === 'fsa') {
      await Storage.remove(parsed.key, { recursive: true });
      // Drop the registry row too so the project doesn't ghost in the
      // selector after deletion. Best-effort.
      try { await fsaRegistry.remove(projectId); } catch {}
      auditLog.append({ action: 'remove', projectId, path: parsed.key, recursive: true }).catch(() => {});
    } else {
      await idb.deleteProject({ projectId: parsed.key });
    }
    bus.notify('projectDeleted', { projectId });
  } catch (e) {
    bus.notify('error', `Failed to delete project: ${e?.message || e}`);
  }
}

async function _saveDiagram({ diagramData, becomeCurrent = false }) {
  try {
    const project = parseStorageId(diagramData.projectId);
    if (project.mode === 'fsa') {
      const safeName = diagramData.name.trim();
      const newPath = `${project.key}/${safeName}.mmd`;

      await Storage.writeText(newPath, diagramData.content);

      // If this was a rename (existing id with a different name), remove the
      // old file. Best-effort — if it's already gone, fine.
      if (diagramData.id) {
        const diag = parseStorageId(diagramData.id);
        if (diag.mode === 'fsa') {
          const { name: oldName } = parseFsaDiagramKey(diag.key);
          if (oldName !== safeName) {
            const oldPath = `${project.key}/${oldName}.mmd`;
            try { await Storage.remove(oldPath); } catch {}
          }
        }
      }

      auditLog.append({
        action: 'write',
        projectId: diagramData.projectId,
        path: newPath,
        bytes: typeof diagramData.content === 'string' ? diagramData.content.length : undefined,
      }).catch(() => {});

      bus.notify('diagramSaved', {
        id: makeFsaDiagramId(project.key, safeName),
        name: safeName,
        projectId: diagramData.projectId,
        content: diagramData.content,
        dateModified: new Date().toISOString(),
        becomeCurrent,
      });
    } else {
      const idbPayload = {
        name: diagramData.name,
        projectId: project.key,
        content: diagramData.content,
      };
      if (diagramData.id) {
        const diag = parseStorageId(diagramData.id);
        if (diag.mode === 'idb') idbPayload.id = diag.key;
      }
      const saved = await idb.saveDiagram({ diagramData: idbPayload });
      bus.notify('diagramSaved', {
        id: makeIdbDiagramId(saved.id),
        name: saved.name,
        projectId: diagramData.projectId,
        content: saved.content,
        dateModified: saved.dateModified,
        becomeCurrent,
      });
    }
  } catch (e) {
    bus.notify('error', `Failed to save diagram: ${e?.message || e}`);
  }
}

async function _loadDiagram({ diagramId }) {
  try {
    const diag = parseStorageId(diagramId);
    if (diag.mode === 'fsa') {
      const { folder, name } = parseFsaDiagramKey(diag.key);
      const content = await Storage.readText(`${folder}/${name}.mmd`);
      bus.notify('diagramLoaded', {
        id: diagramId,
        name,
        projectId: makeFsaProjectId(folder),
        content,
        dateModified: null,
      });
    } else {
      const result = await idb.loadDiagram({ diagramId: diag.key });
      if (!result) {
        bus.notify('diagramLoaded', null);
      } else {
        bus.notify('diagramLoaded', {
          id: makeIdbDiagramId(result.id),
          name: result.name,
          projectId: makeIdbProjectId(result.projectId),
          content: result.content,
          dateModified: result.dateModified,
        });
      }
    }
  } catch (e) {
    bus.notify('error', `Failed to load diagram: ${e?.message || e}`);
  }
}

async function _listDiagrams({ projectId }) {
  try {
    if (projectId == null) {
      bus.notify('diagramsListed', { diagrams: [], projectId });
      return;
    }
    const project = parseStorageId(projectId);
    let diagrams = [];
    if (project.mode === 'fsa') {
      const entries = await Storage.list(project.key);
      // Eager-load content. Thumbnails and zip download need it; lazy-load would
      // complicate both paths for negligible savings on a typical .mmd file.
      diagrams = await Promise.all(
        entries
          .filter((e) => e.kind === 'file' && e.name.endsWith('.mmd'))
          .map(async (e) => {
            const name = e.name.slice(0, -4);
            let content = '';
            try { content = await Storage.readText(`${project.key}/${e.name}`); } catch {}
            return {
              id: makeFsaDiagramId(project.key, name),
              name,
              projectId,
              content,
            };
          })
      );
    } else {
      const list = await idb.listDiagrams({ projectId: project.key });
      diagrams = list.map((d) => ({
        id: makeIdbDiagramId(d.id),
        name: d.name,
        projectId: makeIdbProjectId(d.projectId),
        content: d.content,
        dateModified: d.dateModified,
      }));
    }
    bus.notify('diagramsListed', { diagrams, projectId });
  } catch (e) {
    bus.notify('error', `Failed to list diagrams: ${e?.message || e}`);
  }
}

async function _deleteDiagram({ diagramId }) {
  try {
    const diag = parseStorageId(diagramId);
    if (diag.mode === 'fsa') {
      const { folder, name } = parseFsaDiagramKey(diag.key);
      const path = `${folder}/${name}.mmd`;
      await Storage.remove(path);
      auditLog.append({
        action: 'remove',
        projectId: makeFsaProjectId(folder),
        path,
      }).catch(() => {});
    } else {
      await idb.deleteDiagram({ diagramId: diag.key });
    }
    bus.notify('diagramDeleted', { diagramId });
  } catch (e) {
    bus.notify('error', `Failed to delete diagram: ${e?.message || e}`);
  }
}

// IDB → FSA one-way export. Reads the source IDB project's diagrams, creates
// a new <destName>/ folder in the FSA root, and writes each diagram as
// <destName>/<diagramName>.mmd. The source IDB project is read-only here.
// Each per-diagram write is atomic (temp+move) so a mid-export crash leaves
// a partial folder on disk without corrupting any individual file.
async function _exportProject({ sourceProjectId, destName }) {
  try {
    const parsed = parseStorageId(sourceProjectId);
    if (parsed.mode !== 'idb') {
      bus.notify('error', 'Only IDB projects can be exported to folder');
      return;
    }
    if (!Storage.isReady()) {
      bus.notify('error', 'FSA storage is not ready — pick a folder first');
      return;
    }
    const safe = (destName || '').trim();
    if (!safe) {
      bus.notify('error', 'Destination name is required');
      return;
    }

    // Collision check against existing folders in the FSA root.
    try {
      const entries = await Storage.list('');
      if (entries.some((e) => e.kind === 'directory' && e.name === safe)) {
        bus.notify('error', `A folder named "${safe}" already exists on disk`);
        return;
      }
    } catch (e) {
      bus.notify('error', `Could not check destination: ${e?.message || e}`);
      return;
    }

    const sourceDiagrams = await idb.listDiagrams({ projectId: parsed.key });

    await Storage.mkdir(safe);
    for (const d of sourceDiagrams) {
      await Storage.writeText(`${safe}/${d.name}.mmd`, d.content, { ifAbsent: true });
    }

    bus.notify('projectCreated', { id: makeFsaProjectId(safe), name: safe, mode: 'fsa' });
  } catch (e) {
    bus.notify('error', `Export failed: ${e?.message || e}`);
  }
}

async function _saveProject({ projectData }) {
  // Only IDB projects have a renameable record. FSA project rename would be
  // a folder rename — not in this slice's scope.
  try {
    const parsed = parseStorageId(projectData.id);
    if (parsed.mode !== 'idb') {
      bus.notify('error', 'Renaming FSA projects is not supported in this version');
      return;
    }
    await idb.saveProject({ projectData: { id: parsed.key, name: projectData.name } });
    await _listProjects();
  } catch (e) {
    bus.notify('error', `Failed to save project: ${e?.message || e}`);
  }
}

const actions = {
  'do:open': _open,
  'do:listProjects': _listProjects,
  'do:createProject': _createProject,
  'do:saveProject': _saveProject,
  'do:deleteProject': _deleteProject,
  'do:exportProject': _exportProject,
  'do:saveDiagram': _saveDiagram,
  'do:loadDiagram': _loadDiagram,
  'do:listDiagrams': _listDiagrams,
  'do:deleteDiagram': _deleteDiagram,
  reset: () => idb.reset(),
};

export const storageConcept = {
  subscribe: bus.subscribe,
  notify: bus.notify,
  reset: () => idb.reset(),

  async listen(event, payload) {
    // Lazy-open the IDB on first non-do:open action, matching prior behavior.
    if (event !== 'do:open' && !idb.isOpen()) {
      await idb.open();
    }
    if (actions[event]) {
      // Fire-and-forget. Errors surface as 'error' events via the bus.
      actions[event](payload);
    }
  },
};
