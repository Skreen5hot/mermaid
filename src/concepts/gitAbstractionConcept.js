/**
 * @module gitAbstractionConcept
 * @description Defines a provider-agnostic interface for Git operations.
 * This concept acts as a facade, delegating calls to a specific provider
 * adapter (e.g., for GitHub or GitLab). It fulfills the role of the
 * Git Abstraction Layer (GAL) as defined in the development plan.
 */

const subscribers = new Set();

function notify(event, payload) {
  for (const subscriber of subscribers) {
    subscriber(event, payload);
  }
}

/**
 * The interface that every Git provider adapter must implement.
 * @typedef {Object} IGitAdapter
 * @property {(owner: string, repo: string, token: string) => Promise<any>} getRepoInfo
 * @property {(owner: string, repo: string, path: string, token: string) => Promise<any[]>} listContents
 * @property {(owner: string, repo: string, path: string, token: string, ref?: string) => Promise<{content: string, sha: string}>} getContents
 * @property {(owner: string, repo: string, path: string, token: string) => Promise<string | null>} getTreeSha
 * @property {(owner: string, repo: string, path: string, content: string, message: string, sha: string | null, token: string) => Promise<any>} putContents
 * @property {(owner: string, repo: string, path: string, message: string, sha: string, token: string) => Promise<any>} deleteContents
 * @property {(owner: string, repo: string, branch: string, token: string) => Promise<{sha: string}>} getLatestCommit
 */

export const gitAbstractionConcept = {
  state: {
    /** @type {IGitAdapter | null} */
    adapter: null,
    /** @type {string | null} */
    provider: null,
  },

  actions: {
    /**
     * Configures the GAL with a specific provider adapter.
     * @param {string} provider - The name of the provider (e.g., 'github').
     * @param {IGitAdapter} adapter - The adapter object implementing the IGitAdapter interface.
     */
    setProvider(provider, adapter) {
      if (!provider || !adapter) {
        throw new Error('[GAL] Both provider name and adapter object are required.');
      }
      gitAbstractionConcept.state.provider = provider;
      gitAbstractionConcept.state.adapter = adapter;
      console.log(`[GAL] Provider set to: ${provider}`);
      notify('providerSet', { provider });
    },

    /**
     * Asserts that a provider adapter has been configured.
     * @private
     */
    _assertAdapter() {
      if (!gitAbstractionConcept.state.adapter) {
        throw new Error('[GAL] No provider adapter has been set. Call setProvider() first.');
      }
    },

    /**
     * Gets repository information, such as the default branch.
     * @returns {Promise<any>}
     */
    getRepoInfo(...args) {
      gitAbstractionConcept.actions._assertAdapter();
      return gitAbstractionConcept.state.adapter.getRepoInfo(...args);
    },

    /**
     * Lists contents of a directory in the repository.
     * @returns {Promise<any[]>}
     */
    listContents(...args) {
      gitAbstractionConcept.actions._assertAdapter();
      return gitAbstractionConcept.state.adapter.listContents(...args);
    },

    /**
     * Gets the content and SHA of a single file.
     * @returns {Promise<{content: string, sha: string}>}
     */
    getContents(...args) {
      gitAbstractionConcept.actions._assertAdapter();
      return gitAbstractionConcept.state.adapter.getContents(...args);
    },

    /**
     * Gets the SHA of a directory tree.
     * @returns {Promise<string | null>} The SHA of the tree, or null if not found.
     */
    getTreeSha(...args) {
      gitAbstractionConcept.actions._assertAdapter();
      return gitAbstractionConcept.state.adapter.getTreeSha(...args);
    },

    /**
     * Creates or updates a file in the repository.
     * @returns {Promise<any>}
     */
    putContents(...args) {
      gitAbstractionConcept.actions._assertAdapter();
      return gitAbstractionConcept.state.adapter.putContents(...args);
    },

    /**
     * Deletes a file from the repository.
     * @returns {Promise<any>}
     */
    deleteContents(...args) {
      gitAbstractionConcept.actions._assertAdapter();
      return gitAbstractionConcept.state.adapter.deleteContents(...args);
    },

    /**
     * Gets the latest commit of a branch.
     * @returns {Promise<{sha: string}>}
     */
    getLatestCommit(...args) {
      gitAbstractionConcept.actions._assertAdapter();
      return gitAbstractionConcept.state.adapter.getLatestCommit(...args);
    },
  },

  subscribe(fn) {
    subscribers.add(fn);
  },

  unsubscribe(fn) {
    subscribers.delete(fn);
  },

  notify,
};