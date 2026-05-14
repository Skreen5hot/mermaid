/**
 * @module githubAdapter
 * @description Implements the IGitAdapter interface for the GitHub REST API.
 * This module handles all direct communication with GitHub.
 */

const GITHUB_API_BASE = 'https://api.github.com';

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
 * Constructs the full API URL for GitHub or GitHub Enterprise.
 * @param {string} path - The API path (e.g., 'repos/owner/repo').
 * @param {string} [apiBaseUrl] - Optional custom API base URL for GitHub Enterprise.
 * @returns {string} The full API URL.
 */
function _buildApiUrl(path, apiBaseUrl) {
  if (apiBaseUrl) {
    // GitHub Enterprise instances typically use /api/v3 path
    // Example: https://github.company.com/api/v3
    const baseUrl = apiBaseUrl.endsWith('/api/v3') ? apiBaseUrl : `${apiBaseUrl}/api/v3`;
    return `${baseUrl}/${path}`;
  }
  // Default to public GitHub
  return `${GITHUB_API_BASE}/${path}`;
}

/**
 * A helper function to handle common fetch logic for the GitHub API.
 * @param {string} path - The API path (e.g., 'repos/owner/repo').
 * @param {string} token - The user's GitHub personal access token.
 * @param {object} [fetchOptions={}] - Additional fetch options (method, body, headers).
 * @param {object} [adapterOptions={}] - Adapter-level options like apiBaseUrl.
 * @param {number} [retries=3] - Number of retry attempts.
 * @param {number} [backoff=1000] - Initial backoff delay in milliseconds.
 * @returns {Promise<any>} The JSON response.
 */
async function _githubFetch(path, token, fetchOptions = {}, adapterOptions = {}, retries = 3, backoff = 1000) {
  const url = _buildApiUrl(path, adapterOptions.apiBaseUrl);
  let lastError;
  for (let i = 0; i < retries; i++) {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${token}`,
      ...fetchOptions.headers,
    };

    const response = await fetch(url, { ...fetchOptions, headers });

    if (response.ok) {
      // Handle responses with no content (e.g., 204 No Content for DELETE)
      if (response.status === 204) {
        return null;
      }
      return response.json();
    }

    // Check for rate limit status codes
    if (response.status === 403 || response.status === 429) {
      lastError = new Error(`[GitHub API Error] ${response.status}: ${(await response.json().catch(() => ({ message: response.statusText }))).message}`);
      
      // Log the scopes of the token that caused the 403 error.
      const scopes = response.headers.get('X-OAuth-Scopes');
      console.error(`[GitHub Adapter] Permission Denied. The token has these scopes: [${scopes || 'none'}]. Write operations require the 'repo' or 'public_repo' scope.`);

      const retryAfter = response.headers.get('Retry-After');
      let waitTime = backoff * Math.pow(2, i); // Exponential backoff

      if (retryAfter) {
        const retryAfterSeconds = parseInt(retryAfter, 10);
        if (!isNaN(retryAfterSeconds)) {
          waitTime = retryAfterSeconds * 1000;
        }
      }
      
      console.warn(`[GitHub Adapter] Rate limit hit. Retrying in ${waitTime / 1000}s... (${i + 1}/${retries})`);
      await _sleep(waitTime);
      continue; // Go to next iteration of the loop
    }

    // For other non-ok responses, fail immediately
    const errorBody = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`[GitHub API Error] ${response.status}: ${errorBody.message}`);
  }

  // If all retries fail, provide a more specific error message.
  if (lastError && lastError.message.includes('403')) {
    throw new Error(`[GitHub Adapter] A 403 Forbidden error occurred. Please ensure your Personal Access Token has the 'repo' scope (for private repos) or 'public_repo' scope (for public repos).`);
  }

  throw new Error(`[GitHub Adapter] Request failed after ${retries} retries. Last error: ${lastError?.message}`);
}

/**
 * @type {import('../concepts/gitAbstractionConcept').IGitAdapter}
 */
export const githubAdapter = {
  /**
   * Gets repository information, primarily to find the default branch.
   * @param {string} owner - The repository owner.
   * @param {string} repo - The repository name.
   * @param {string} token - The user's PAT.
   * @param {object} [options={}] - Options, including apiBaseUrl for GitHub Enterprise.
   * @returns {Promise<{default_branch: string}>}
   */
  getRepoInfo(owner, repo, token, options = {}) {
    return _githubFetch(`repos/${owner}/${repo}`, token, {}, options);
  },

  /**
   * Lists the contents of a given path in the repository.
   * @param {string} owner - The repository owner.
   * @param {string} repo - The repository name.
   * @param {string} path - The directory path (e.g., 'mermaid').
   * @param {string} token - The user's PAT.
   * @param {object} [options={}] - Options, including apiBaseUrl for GitHub Enterprise.
   * @returns {Promise<any[]>} An array of file/directory objects.
   */
  listContents(owner, repo, path, token, options = {}) {
    return _githubFetch(`repos/${owner}/${repo}/contents/${path}`, token, {}, options);
  },

  /**
   * Gets the content of a single file.
   * @param {string} owner - The repository owner.
   * @param {string} repo - The repository name.
   * @param {string} path - The full file path.
   * @param {string} token - The user's PAT.
   * @param {object} [options={}] - Options, including apiBaseUrl for GitHub Enterprise.
   * @returns {Promise<{content: string, sha: string}>} Decoded content and file SHA.
   */
  async getContents(owner, repo, path, token, options = {}) {
    const response = await _githubFetch(`repos/${owner}/${repo}/contents/${path}`, token, {}, options);
    // GitHub API returns content base64 encoded.
    return {
      content: atob(response.content),
      sha: response.sha,
    };
  },

  /**
   * Gets the SHA of a directory tree.
   * @param {string} owner - The repository owner.
   * @param {string} repo - The repository name.
   * @param {string} path - The directory path.
   * @param {string} token - The user's PAT.
   * @param {object} [options={}] - Options, including apiBaseUrl for GitHub Enterprise.
   * @returns {Promise<string | null>} The SHA of the tree, or null if not found.
   */
  async getTreeSha(owner, repo, path, token, options = {}) {
    // This is a more direct way to get the SHA of a specific directory.
    // We get the contents of the parent directory and find our target directory's entry.
    // For the root 'mermaid' directory, the parent is the root of the repo.
    const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
    try {
      const parentContents = await this.listContents(owner, repo, parentPath, token, options);
      const pathEntry = parentContents.find(entry => entry.path === path && entry.type === 'dir');

      // If the directory doesn't exist, GitHub returns an object with a message.
      if (!pathEntry) {
        return null;
      }

      return pathEntry ? pathEntry.sha : null;
    } catch (error) {
      if (error.message.includes('404')) return null; // Path not found is not a critical error
      throw error;
    }
  },

  /**
   * Creates or updates a file.
   * @param {string} owner - The repository owner.
   * @param {string} repo - The repository name.
   * @param {string} path - The full file path.
   * @param {string} content - The new file content.
   * @param {string} message - The commit message.
   * @param {string | null} sha - The blob SHA, required for updates. Null for new files.
   * @param {string} token - The user's PAT.
   * @param {object} [options={}] - Options, including apiBaseUrl for GitHub Enterprise.
   * @returns {Promise<any>}
   */
  putContents(owner, repo, path, content, message, sha, token, options = {}) {
    const body = {
      message,
      content: unicodeBtoa(content), // Content must be base64 encoded.
      sha, // If sha is null, GitHub treats it as a new file create.
    };
    return _githubFetch(`repos/${owner}/${repo}/contents/${path}`, token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, options);
  },

  /**
   * Deletes a file.
   * @param {string} owner - The repository owner.
   * @param {string} repo - The repository name.
   * @param {string} path - The full file path.
   * @param {string} message - The commit message.
   * @param {string} sha - The blob SHA, required for deletion.
   * @param {string} token - The user's PAT.
   * @param {object} [options={}] - Options, including apiBaseUrl for GitHub Enterprise.
   * @returns {Promise<any>}
   */
  deleteContents(owner, repo, path, message, sha, token, options = {}) {
    const body = { message, sha };
    return _githubFetch(`repos/${owner}/${repo}/contents/${path}`, token, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, options);
  },

  /**
   * Gets the latest commit SHA for a given branch.
   * @param {string} owner - The repository owner.
   * @param {string} repo - The repository name.
   * @param {string} branch - The branch name.
   * @param {string} token - The user's PAT.
   * @param {object} [options={}] - Options, including apiBaseUrl for GitHub Enterprise.
   * @returns {Promise<{sha: string}>} An object containing the commit SHA.
   */
  async getLatestCommit(owner, repo, branch, token, options = {}) {
    const branchInfo = await _githubFetch(`repos/${owner}/${repo}/branches/${branch}`, token, {}, options);
    return { sha: branchInfo.commit.sha };
  },
};