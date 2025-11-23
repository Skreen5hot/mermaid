/**
 * @module storageConcept
 * @description Manages all interactions with the browser's IndexedDB.
 * This concept is responsible for opening the database, defining the schema,
 * and providing a connection handle for data operations. It follows the
 * "Concepts and Synchronizations" architecture.
 */

const DB_NAME = 'MermaidSyncDB';
const DB_VERSION = 1;

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

export const storageConcept = {
  state: {
    /** @type {IDBDatabase | null} */
    db: null,
  },

  actions: {
    /**
     * Initializes the IndexedDB database.
     * This action opens the database and, if necessary, creates the object stores
     * and indexes as defined in the schema.
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database connection.
     */
    init() {
      return new Promise((resolve, reject) => {
        if (storageConcept.state.db) {
          return resolve(storageConcept.state.db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // This event only runs when the DB is created for the first time or the version is upgraded.
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          console.log('[StorageConcept] Upgrade needed. Setting up schema...');
          // Create object stores if they don't exist.
          const projectsStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
          projectsStore.createIndex('name', 'name', { unique: true });

          const diagramsStore = db.createObjectStore('diagrams', { keyPath: 'id', autoIncrement: true });
          diagramsStore.createIndex('projectId', 'projectId', { unique: false });
          diagramsStore.createIndex('project_title', ['projectId', 'title'], { unique: true });

          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        };

        // This event runs every time the DB is successfully opened, including on first creation.
        request.onsuccess = (event) => {
          storageConcept.state.db = event.target.result;

          // Handle cases where the DB is closed unexpectedly.
          storageConcept.state.db.onclose = () => {
            console.error('[StorageConcept] Database connection closed unexpectedly.');
            storageConcept.state.db = null;
          };

          // Handle version change requests from other tabs.
          storageConcept.state.db.onversionchange = () => {
            console.warn('[StorageConcept] Database version change requested. Closing connection...');
            storageConcept.state.db.close();
          };

          console.log(`[StorageConcept] Database "${DB_NAME}" initialized successfully.`);
          notify('dbInitialized', storageConcept.state.db);
          resolve(storageConcept.state.db);
        };

        request.onerror = (event) => {
          console.error('[StorageConcept] Database error:', event.target.error);
          notify('dbError', event.target.error);
          reject(event.target.error);
        };
      });
    },

    /**
     * A generic helper to retrieve all records from a given object store.
     * @param {string} storeName - The name of the object store.
     * @returns {Promise<any[]>} A promise that resolves with an array of records.
     * @private
     */
    _getAll(storeName) {
      return new Promise((resolve, reject) => {
        if (!storageConcept.state.db) {
          return reject(new Error('[StorageConcept] Database not initialized.'));
        }
        const transaction = storageConcept.state.db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = (event) => {
          console.error(`[StorageConcept] Error getting all from "${storeName}":`, event.target.error);
          reject(event.target.error);
        };
      });
    },

    /**
     * Fetches all projects from the 'projects' object store.
     * @returns {Promise<any[]>}
     */
    getAllProjects() { return storageConcept.actions._getAll('projects'); },

    /**
     * A generic helper to retrieve a single record by its key.
     * @param {string} storeName - The name of the object store.
     * @param {*} key - The key of the record to retrieve.
     * @returns {Promise<any>} A promise that resolves with the record.
     * @private
     */
    _get(storeName, key) {
      return new Promise((resolve, reject) => {
        if (!storageConcept.state.db) return reject(new Error('[StorageConcept] Database not initialized.'));
        const transaction = storageConcept.state.db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
      });
    },

    /**
     * A generic helper to add or update a record in a store.
     * @param {string} storeName - The name of the object store.
     * @param {any} item - The item to add or update.
     * @returns {Promise<IDBValidKey>} A promise that resolves with the key of the added/updated item.
     * @private
     */
    _put(storeName, item) {
      return new Promise((resolve, reject) => {
        if (!storageConcept.state.db) return reject(new Error('[StorageConcept] Database not initialized.'));
        const transaction = storageConcept.state.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
      });
    },

    /**
     * A generic helper to delete a record from a store.
     * @param {string} storeName - The name of the object store.
     * @param {IDBValidKey} key - The key of the item to delete.
     * @returns {Promise<void>}
     * @private
     */
    _delete(storeName, key) {
      return new Promise((resolve, reject) => {
        if (!storageConcept.state.db) return reject(new Error('[StorageConcept] Database not initialized.'));
        const transaction = storageConcept.state.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
      });
    },

    // --- Diagram-specific Actions ---

    /**
     * Adds a new diagram to the 'diagrams' object store.
     * @param {any} diagramData - The diagram object to add.
     * @returns {Promise<IDBValidKey>} The ID of the newly created diagram.
     */
    addDiagram(diagramData) {
      console.log('[Storage] Adding/updating diagram in IndexedDB:', diagramData);
      return storageConcept.actions._put('diagrams', diagramData);
    },

    /**
     * Retrieves a single diagram by its ID.
     * @param {number} diagramId - The ID of the diagram.
     * @returns {Promise<any>} The diagram object.
     */
    getDiagram(diagramId) { return storageConcept.actions._get('diagrams', diagramId); },

    /**
     * Updates an existing diagram in the 'diagrams' object store.
     * @param {any} diagramData - The diagram object to update. It must have an 'id'.
     * @returns {Promise<IDBValidKey>} The ID of the updated diagram.
     */
    updateDiagram(diagramData) { return storageConcept.actions._put('diagrams', diagramData); },

    /**
     * Deletes a diagram from the 'diagrams' object store.
     * @param {number} diagramId - The ID of the diagram to delete.
     * @returns {Promise<void>}
     */
    deleteDiagram(diagramId) { return storageConcept.actions._delete('diagrams', diagramId); },

    /**
     * Adds a new project to the 'projects' object store.
     * @param {any} projectData - The project object to add.
     * @returns {Promise<IDBValidKey>} The ID of the newly created project.
     */
    addProject(projectData) { return storageConcept.actions._put('projects', projectData); },

    /**
     * Updates an existing project in the 'projects' object store.
     * @param {any} projectData - The project object to update. It must have an 'id'.
     * @returns {Promise<IDBValidKey>} The ID of the updated project.
     */
    updateProject(projectData) { return storageConcept.actions._put('projects', projectData); },

    /**
     * Deletes a project from the 'projects' object store.
     * @param {number} projectId - The ID of the project to delete.
     * @returns {Promise<void>}
     */
    deleteProject(projectId) { return storageConcept.actions._delete('projects', projectId); },

    /**
     * Deletes all diagrams associated with a given project ID using an index cursor.
     * @param {number} projectId - The ID of the project whose diagrams should be deleted.
     * @returns {Promise<void>}
     */
    deleteDiagramsByProjectId(projectId) {
      return new Promise((resolve, reject) => {
        if (!storageConcept.state.db) return reject(new Error('[StorageConcept] Database not initialized.'));
        const transaction = storageConcept.state.db.transaction('diagrams', 'readwrite');
        const store = transaction.objectStore('diagrams');
        const index = store.index('projectId');
        const request = index.openCursor(IDBKeyRange.only(projectId));

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve(); // All matching diagrams deleted
          }
        };
        request.onerror = (e) => reject(e.target.error);
      });
    },

    // --- Sync Queue Actions ---

    /**
     * Fetches all items from the 'syncQueue' object store.
     * @returns {Promise<any[]>}
     */
    getSyncQueueItems() { return storageConcept.actions._getAll('syncQueue'); },

    /**
     * Adds a new item to the 'syncQueue'.
     * @param {any} item - The sync item to add.
     * @returns {Promise<IDBValidKey>}
     */
    addSyncQueueItem(item) { return storageConcept.actions._put('syncQueue', item); },

    /**
     * Deletes a single item from the 'syncQueue' by its ID.
     * @param {number} itemId - The ID of the sync queue item to delete.
     * @returns {Promise<void>}
     */
    deleteSyncQueueItem(itemId) { return storageConcept.actions._delete('syncQueue', itemId); },

    /**
     * Fetches all diagrams for a given project ID using the 'projectId' index.
     * @param {number} projectId - The ID of the project.
     * @returns {Promise<any[]>} A promise that resolves with an array of diagrams.
     */
    getDiagramsByProjectId(projectId) {
      return new Promise((resolve, reject) => {
        if (!storageConcept.state.db) {
          return reject(new Error('[StorageConcept] Database not initialized.'));
        }
        const transaction = storageConcept.state.db.transaction('diagrams', 'readonly');
        const store = transaction.objectStore('diagrams');
        const index = store.index('projectId');
        const request = index.getAll(projectId);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = (event) => {
          console.error(`[StorageConcept] Error getting diagrams for project ${projectId}:`, event.target.error);
          reject(event.target.error);
        };
      });
    },
  },

  subscribe(fn) {
    subscribers.add(fn);
  },

  notify,
};