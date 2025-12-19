import { describe, test, assert, beforeEach } from '../test-utils.js';
import { githubAdapter } from '../../src/github.js';

describe('GitHub Adapter', () => {
  let originalFetch;
  let fetchSpy;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchSpy = {
      calls: [],
      mock: (response, ok = true) => {
        global.fetch = async (url, options) => {
          fetchSpy.calls.push({ url, options });
          return {
            ok,
            status: ok ? 200 : 404,
            json: async () => response,
          };
        };
      },
    };
  });

  const tearDown = () => {
    global.fetch = originalFetch;
  };

  const owner = 'test-owner';
  const repo = 'test-repo';
  const token = 'ghp_fake-token';

  describe('getTreeSha', () => {
    test('should make multiple API calls to find the correct tree SHA', async () => {
      // Mock the three fetch calls required by the method
      global.fetch = async (url) => {
        fetchSpy.calls.push({ url });
        if (url.includes('/branches/')) {
          return { ok: true, json: async () => ({ commit: { sha: 'commit-sha-1' } }) };
        }
        if (url.includes('/git/commits/')) {
          return { ok: true, json: async () => ({ tree: { sha: 'root-tree-sha-2' } }) };
        }
        if (url.includes('/git/trees/')) {
          return { ok: true, json: async () => ({
            tree: [
              { path: 'mermaid', type: 'tree', sha: 'mermaid-tree-sha-3' },
              { path: 'README.md', type: 'blob', sha: 'readme-sha-4' },
            ]
          }) };
        }
        // Fallback for getRepoInfo call
        return { ok: true, json: async () => ({ default_branch: 'main' }) };
      };

      const result = await githubAdapter.getTreeSha(owner, repo, 'mermaid', token);

      assert.strictEqual(fetchSpy.calls.length, 4, 'fetch should be called 4 times (getRepoInfo, branch, commit, tree)');
      
      assert.ok(fetchSpy.calls[1].url.includes('/branches/main'), 'Should fetch branch info');
      assert.ok(fetchSpy.calls[2].url.includes('/git/commits/commit-sha-1'), 'Should fetch commit info');
      assert.ok(fetchSpy.calls[3].url.includes('/git/trees/root-tree-sha-2'), 'Should fetch root tree info');
      
      assert.strictEqual(result, 'mermaid-tree-sha-3', 'Should return the correct SHA for the "mermaid" path');
      tearDown();
    });
  });

  describe('Error Handling', () => {
    test('[UNIT] should provide a helpful error message on a 403 Forbidden error', async () => {
      // Mock a 403 response with the X-OAuth-Scopes header
      fetchSpy.mock({ message: 'Forbidden' }, false);
      fetchSpy.calls = []; // Reset calls for this specific test
      global.fetch = async (url, options) => {
        fetchSpy.calls.push({ url, options });
        return {
          ok: false,
          status: 403,
          headers: { get: (header) => header === 'X-OAuth-Scopes' ? 'read:user, gist' : null },
          json: async () => ({ message: 'Requires write permission' }),
        };
      };

      let thrownError = null;
      try {
        await githubAdapter.putContents(owner, repo, 'file.mmd', 'content', 'msg', 'sha', token);
      } catch (error) {
        thrownError = error;
      }

      assert.isNotNull(thrownError, 'An error should have been thrown');
      assert.include(thrownError.message, "The token has these scopes: [read:user, gist]", "Error message should list the token's actual scopes");
      assert.include(thrownError.message, "require the 'repo' or 'public_repo' scope", "Error message should suggest the required scopes");
      tearDown();
    });
  });

  describe('Rate Limit Handling', () => {
    test('[UNIT] should retry with exponential backoff on a 403 error', async () => {
      let callCount = 0;
      global.fetch = async (url, options) => {
        callCount++;
        fetchSpy.calls.push({ url, options });
        if (callCount < 3) { // Fail the first two times
          return { ok: false, status: 403, json: async () => ({ message: 'Rate limit exceeded' }) };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      // We pass a very short backoff to speed up the test
      const result = await githubAdapter.getRepoInfo(owner, repo, token, {}, 3, 10);

      assert.strictEqual(callCount, 3, 'fetch should be called 3 times (1 initial + 2 retries)');
      assert.deepStrictEqual(result, { success: true }, 'Should eventually return the successful response');
      tearDown();
    });

    test('[UNIT] should respect the Retry-After header', async () => {
      let callCount = 0;
      global.fetch = async (url, options) => {
        callCount++;
        fetchSpy.calls.push({ url, options });
        if (callCount === 1) { // Fail once with a Retry-After header
          return {
            ok: false,
            status: 403,
            headers: { get: (header) => header === 'Retry-After' ? '1' : null }, // 1 second
            json: async () => ({ message: 'Rate limit exceeded' })
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const startTime = Date.now();
      // Use a long backoff to prove the Retry-After header is being used instead
      await githubAdapter.getRepoInfo(owner, repo, token, {}, 2, 5000);
      const duration = Date.now() - startTime;

      assert.strictEqual(callCount, 2, 'fetch should be called twice');
      // The test will be fast, but the internal wait should be ~1000ms.
      // We check if it's greater than a threshold to account for execution time.
      assert.isAbove(duration, 900, 'Wait time should be at least 0.9s, respecting Retry-After header');
      assert.isBelow(duration, 2000, 'Wait time should not be the long backoff value');
      tearDown();
    });
  });
});