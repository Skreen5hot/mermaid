/**
 * @module gitlabAdapter
 * @description Implements the IGitAdapter interface for the GitLab REST API.
 * This module handles all direct communication with GitLab.
 */

const GITLAB_API_BASE = 'https://gitlab.com/api/v4';

const _sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A helper function to handle common fetch logic for the GitLab API.
 * @param {string} url - The full URL to fetch.
 * @param {string} token - The user's GitLab personal access token.
 * @param {RequestInit} options - Additional fetch options.
 * @returns {Promise<any>} The JSON response.
 */
async function _gitlabFetch(url, token, options = {}, retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    const headers = {
      'PRIVATE-TOKEN': token,
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.ok) {
      if (response.status === 204) {
        return null;
      }
      return response.json();
    }

    // GitLab primarily uses 429 for rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      let waitTime = backoff * Math.pow(2, i); // Exponential backoff

      if (retryAfter) {
        const retryAfterSeconds = parseInt(retryAfter, 10);
        if (!isNaN(retryAfterSeconds)) {
          waitTime = retryAfterSeconds * 1000;
        }
      }
      
      console.warn(`[GitLab Adapter] Rate limit hit. Retrying in ${waitTime / 1000}s... (${i + 1}/${retries})`);
      await _sleep(waitTime);
      continue; // Go to next iteration of the loop
    }

    // For other non-ok responses, fail immediately
    const errorBody = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`[GitLab API Error] ${response.status}: ${errorBody.message || errorBody.error}`);
  }

  // If all retries fail
  throw new Error(`[GitLab Adapter] Request failed after ${retries} retries.`);
}

/**
 * @type {import('../concepts/gitAbstractionConcept').IGitAdapter}
 */
export const gitlabAdapter = {
  /**
   * Gets repository information, primarily to find the default branch.
   * @param {string} owner - The repository owner/group.
   * @param {string} repo - The repository name.
   * @param {string} token - The user's PAT.
   * @returns {Promise<{default_branch: string}>}
   */
  getRepoInfo(owner, repo, token) {
    const projectId = encodeURIComponent(`${owner}/${repo}`);
    const url = `${GITLAB_API_BASE}/projects/${projectId}`;
    return _gitlabFetch(url, token);
  },

  /**
   * Lists the contents of a given path in the repository.
   * @param {string} owner - The repository owner/group.
   * @param {string} repo - The repository name.
   * @param {string} path - The directory path.
   * @param {string} token - The user's PAT.
   * @returns {Promise<any[]>} An array of file/directory objects.
   */
  async listContents(owner, repo, path, token) {
    const projectId = encodeURIComponent(`${owner}/${repo}`);
    // Note: GitLab's `tree` endpoint doesn't return SHAs for files directly.
    // It returns a `blob_id`. We will map this to `sha` for compatibility.
    const url = `${GITLAB_API_BASE}/projects/${projectId}/repository/tree?path=${path}`;
    return _gitlabFetch(url, token);
  },

  /**
   * Gets the content of a single file.
   * @param {string} owner - The repository owner/group.
   * @param {string} repo - The repository name.
   * @param {string} path - The full file path.
   * @param {string} token - The user's PAT.
   * @param {string} [ref] - An optional branch, tag, or SHA.
   * @returns {Promise<{content: string, sha: string}>} Decoded content and file SHA.
   */
  async getContents(owner, repo, path, token, ref) {
    const projectId = encodeURIComponent(`${owner}/${repo}`);
    const filePath = encodeURIComponent(path);
    const refToUse = ref || (await this.getRepoInfo(owner, repo, token)).default_branch;
    const url = `${GITLAB_API_BASE}/projects/${projectId}/repository/files/${filePath}?ref=${refToUse}`;
    
    const response = await _gitlabFetch(url, token);
    // GitLab API returns content base64 encoded. `blob_id` is the SHA.
    return {
      content: atob(response.content),
      sha: response.blob_id,
    };
  },

  /**
   * Gets the SHA of a directory tree.
   * @param {string} owner - The repository owner/group.
   * @param {string} repo - The repository name.
   * @param {string} path - The directory path.
   * @param {string} token - The user's PAT.
   * @returns {Promise<string | null>} The SHA of the tree, or null if not found.
   */
  async getTreeSha(owner, repo, path, token) {
    // Use the same robust logic as the GitHub adapter: get the parent's contents
    // and find the target directory's SHA within that list.
    const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
    try {
      const parentContents = await this.listContents(owner, repo, parentPath, token);
      // GitLab uses 'tree' for directories.
      const pathEntry = parentContents.find(entry => entry.path === path && entry.type === 'tree');
      return pathEntry ? pathEntry.id : null; // GitLab uses 'id' for the SHA
    } catch (error) {
      if (error.message.includes('404')) return null;
      throw error;
    }
  },

  /**
   * Creates or updates a file.
   * @param {string} owner - The repository owner/group.
   * @param {string} repo - The repository name.
   * @param {string} path - The full file path.
   * @param {string} content - The new file content.
   * @param {string} message - The commit message.
   * @param {string | null} sha - The blob SHA. GitLab's simple API doesn't use this for updates, but we accept it for interface compatibility.
   * @param {string} token - The user's PAT.
   * @returns {Promise<any>}
   */
  async putContents(owner, repo, path, content, message, sha, token) {
    const projectId = encodeURIComponent(`${owner}/${repo}`);
    const filePath = encodeURIComponent(path);
    const { default_branch } = await this.getRepoInfo(owner, repo, token);

    const body = {
      branch: default_branch,
      content: btoa(content),
      commit_message: message,
    };

    // GitLab uses POST for create and PUT for update.
    const method = sha ? 'PUT' : 'POST';
    const url = `${GITLAB_API_BASE}/projects/${projectId}/repository/files/${filePath}`;

    return _gitlabFetch(url, token, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  /**
   * Deletes a file.
   * @param {string} owner - The repository owner/group.
   * @param {string} repo - The repository name.
   * @param {string} path - The full file path.
   * @param {string} message - The commit message.
   * @param {string} sha - The blob SHA. Not used by GitLab's simple API but kept for compatibility.
   * @param {string} token - The user's PAT.
   * @returns {Promise<any>}
   */
  async deleteContents(owner, repo, path, message, sha, token) {
    const projectId = encodeURIComponent(`${owner}/${repo}`);
    const filePath = encodeURIComponent(path);
    const { default_branch } = await this.getRepoInfo(owner, repo, token);

    const body = { branch: default_branch, commit_message: message };
    const url = `${GITLAB_API_BASE}/projects/${projectId}/repository/files/${filePath}`;

    return _gitlabFetch(url, token, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  /**
   * Gets the latest commit SHA for a given branch.
   * @param {string} owner - The repository owner/group.
   * @param {string} repo - The repository name.
   * @param {string} branch - The branch name.
   * @param {string} token - The user's PAT.
   * @returns {Promise<{sha: string}>} An object containing the commit SHA.
   */
  async getLatestCommit(owner, repo, branch, token) {
    const projectId = encodeURIComponent(`${owner}/${repo}`);
    const url = `${GITLAB_API_BASE}/projects/${projectId}/repository/branches/${branch}`;
    const branchInfo = await _gitlabFetch(url, token);
    return { sha: branchInfo.commit.id }; // GitLab uses 'id' for the commit SHA in this response
  },
};