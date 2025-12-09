/**
 * @module gitlabAdapter
 * @description Implements the IGitAdapter interface for the GitLab REST API.
 * This module handles all direct communication with GitLab.
 */

/**
 * A robust, Unicode-safe Base64 encoder.
 * The native btoa() function fails on strings containing characters outside of the Latin1 range.
 * This function correctly handles Unicode by first encoding the string as UTF-8.
 * @param {string} str The string to encode.
 * @returns {string} The Base64 encoded string.
 */
function unicodeBtoa(str) {
  // First, encode the string into a sequence of UTF-8 bytes.
  const utf8Bytes = new TextEncoder().encode(str);
  // Then, convert the byte array to a binary string and Base64 encode it.
  return btoa(String.fromCharCode.apply(null, utf8Bytes));
}

const _sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A helper function to handle common fetch logic for the GitLab API.
 * @param {string} path - The API path relative to /api/v4 (e.g., 'projects/group%2Fproject').
 * @param {string} token - The user's GitLab personal access token.
 * @param {object} [options={}] - Additional options for the fetch call.
 * @param {string} [options.method='GET'] - The HTTP method.
 * @param {object} [options.body=null] - The request body for POST/PUT requests.
 * @param {string} [options.apiBaseUrl=null] - The base URL for the API (for self-hosted instances, e.g., 'https://maestro.dhs.gov/gitlab').
 * @returns {Promise<any>} The JSON response.
 */
async function _gitlabFetch(path, token, options = {}, retries = 3, backoff = 1000) {
  const { method = 'GET', body = null, apiBaseUrl = null } = options;
  const baseUrl = apiBaseUrl || 'https://gitlab.com'; // Default to gitlab.com if no custom base URL is provided
  const apiUrl = `${baseUrl}/api/v4/${path}`;

  for (let i = 0; i < retries; i++) {
    const response = await fetch(apiUrl, { method, headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json', ...options.headers }, body: body ? JSON.stringify(body) : null });

    if (response.ok) {
      if (response.status === 204) {
        return null;
      }
      return response.json();
    }

    // GitLab primarily uses 429 for rate limiting, but also 5xx for server errors
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      let waitTime = backoff * Math.pow(2, i); // Exponential backoff

      if (retryAfter) {
        const retryAfterSeconds = parseInt(retryAfter, 10);
        if (!isNaN(retryAfterSeconds)) {
          waitTime = retryAfterSeconds * 1000;
        }
      }
      
      console.warn(`[GitLab Adapter] API request failed with status ${response.status}. Retrying in ${waitTime / 1000}s... (${i + 1}/${retries})`);
      await _sleep(waitTime);
      continue; // Go to next iteration of the loop
    }

    // For 401 Unauthorized, 403 Forbidden, 404 Not Found, etc., fail immediately
    if (response.status >= 400 && response.status < 500) {
      const errorBody = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`[GitLab API Error] ${response.status}: ${errorBody.message || errorBody.error}`);
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
   * @param {string} projectPath - The full project path (e.g., 'group/subgroup/project').
   * @param {string} token - The user's PAT.
   * @param {object} [options={}] - Options, including apiBaseUrl for self-hosted instances.
   * @returns {Promise<{default_branch: string}>}
   */
  getRepoInfo(projectPath, token, options = {}) {
    const encodedProjectPath = encodeURIComponent(projectPath);
    return _gitlabFetch(`projects/${encodedProjectPath}`, token, options);
  },

  /**
   * Lists the contents of a given path in the repository.
   * @param {string} owner - The repository owner/group.
   * @param {string} repo - The repository name.
   * @param {string} path - The directory path.
   * @param {string} token - The user's PAT.
   * @returns {Promise<any[]>} An array of file/directory objects.
   */
  async listContents(projectPath, token, path, options = {}) {
    const encodedProjectPath = encodeURIComponent(projectPath);
    // Note: GitLab's `tree` endpoint doesn't return SHAs for files directly.
    // It returns a `blob_id`. We will map this to `sha` for compatibility.
    return _gitlabFetch(`projects/${encodedProjectPath}/repository/tree?path=${path}`, token, options);
  },

  /**
   * Gets the content of a single file.
   * @param {string} owner - The repository owner/group.
   * @param {string} repo - The repository name.
   * @param {string} path - The full file path.
   * @param {string} token - The user's PAT.
   * @param {string} [ref] - An optional branch, tag, or SHA.
   * @returns {Promise<{content: string, sha: string}>} Decoded content and file SHA.
   */ // Note: The original `getContents` signature had `owner, repo, path, token, ref`. The `options` object is now the 5th parameter.
  async getContents(projectPath, token, path, ref, options = {}) {
    const encodedProjectPath = encodeURIComponent(projectPath);
    const filePath = encodeURIComponent(path);
    // Pass options to getRepoInfo as well, so it uses the correct base URL
    const refToUse = ref || (await this.getRepoInfo(projectPath, token, options)).default_branch;
    
    const response = await _gitlabFetch(`projects/${encodedProjectPath}/repository/files/${filePath}?ref=${refToUse}`, token, options);
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
  async getTreeSha(projectPath, token, path, options = {}) {
    // Use the same robust logic as the GitHub adapter: get the parent's contents
    // and find the target directory's SHA within that list.
    const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
    try { // Pass options to listContents
      const parentContents = await this.listContents(projectPath, token, parentPath, options);
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
  async putContents(projectPath, token, path, content, message, sha, options = {}) {
    const encodedProjectPath = encodeURIComponent(projectPath);
    const filePath = encodeURIComponent(path);
    // Pass options to getRepoInfo as well, so it uses the correct base URL
    const { default_branch } = await this.getRepoInfo(projectPath, token, options);
    const body = {
      branch: default_branch,
      content: unicodeBtoa(content),
      commit_message: message,
    };

    // GitLab uses POST for create and PUT for update.
    const method = sha ? 'PUT' : 'POST';

    return _gitlabFetch(`projects/${encodedProjectPath}/repository/files/${filePath}`, token, {
      ...options, // Pass through apiBaseUrl and other top-level options
      method,
      // The body for the fetch call should only contain the GitLab-specific payload.
      // Do not spread `options` into the body.
      body,
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
  async deleteContents(projectPath, token, path, message, sha, options = {}) {
    const encodedProjectPath = encodeURIComponent(projectPath);
    const filePath = encodeURIComponent(path);
    // Pass options to getRepoInfo as well, so it uses the correct base URL
    const { default_branch } = await this.getRepoInfo(projectPath, token, options);
    const body = { branch: default_branch, commit_message: message };
    return _gitlabFetch(`projects/${encodedProjectPath}/repository/files/${filePath}`, token, {
      method: 'DELETE',
      ...options, // Pass through apiBaseUrl
      body,
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
  async getLatestCommit(projectPath, token, branch, options = {}) {
    const encodedProjectPath = encodeURIComponent(projectPath);
    // Pass options to _gitlabFetch
    const branchInfo = await _gitlabFetch(`projects/${encodedProjectPath}/repository/branches/${branch}`, token, options);
    return { sha: branchInfo.commit.id }; // GitLab uses 'id' for the commit SHA in this response
  },
};