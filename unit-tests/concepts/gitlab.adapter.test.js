import { describe, test, assert, beforeEach } from '../test-utils.js';
import { gitlabAdapter } from '../../src/gitlab.js';

describe('GitLab Adapter', () => {
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
  const token = 'glpat-fake-token';
  const projectId = 'test-owner%2Ftest-repo';

  describe('getRepoInfo', () => {
    test('should call the correct project details endpoint', async () => {
      fetchSpy.mock({ id: 1, default_branch: 'main' });
      await gitlabAdapter.getRepoInfo(owner, repo, token);

      assert.strictEqual(fetchSpy.calls.length, 1, 'fetch should be called once');
      const { url, options } = fetchSpy.calls[0];
      assert.strictEqual(url, `https://gitlab.com/api/v4/projects/${projectId}`, 'URL should be correct');
      assert.strictEqual(options.headers['PRIVATE-TOKEN'], token, 'Auth header should be correct');
      tearDown();
    });
  });

  describe('listContents', () => {
    test('should call the correct repository tree endpoint and map id to sha', async () => {
      fetchSpy.mock([{ id: 'blob-sha-123', name: 'file.mmd', type: 'blob' }]);
      const result = await gitlabAdapter.listContents(owner, repo, 'mermaid', token);

      assert.strictEqual(fetchSpy.calls.length, 1, 'fetch should be called once');
      const { url } = fetchSpy.calls[0];
      assert.strictEqual(url, `https://gitlab.com/api/v4/projects/${projectId}/repository/tree?path=mermaid`, 'URL should be correct');
      assert.strictEqual(result[0].sha, 'blob-sha-123', 'should map id to sha');
      tearDown();
    });
  });

  describe('getContents', () => {
    test('should call the correct file content endpoint and decode content', async () => {
      // Mock the two fetch calls: getRepoInfo, then getContents
      global.fetch = async (url) => {
        fetchSpy.calls.push({ url });
        if (url.includes('/repository/files/')) {
          return { ok: true, json: async () => ({ content: btoa('file content'), blob_id: 'file-sha-456' }) };
        }
        return { ok: true, json: async () => ({ default_branch: 'main' }) };
      };

      const result = await gitlabAdapter.getContents(owner, repo, 'mermaid/diagram.mmd', token);

      assert.strictEqual(fetchSpy.calls.length, 2, 'fetch should be called twice');
      const { url: fileUrl } = fetchSpy.calls[1];
      assert.strictEqual(fileUrl, `https://gitlab.com/api/v4/projects/${projectId}/repository/files/mermaid%2Fdiagram.mmd?ref=main`, 'File content URL should be correct');
      assert.strictEqual(result.content, 'file content', 'Content should be base64 decoded');
      assert.strictEqual(result.sha, 'file-sha-456', 'SHA should be the blob_id');
      tearDown();
    });
  });

  describe('putContents', () => {
    test('should use POST to create a new file', async () => {
      // Mock getRepoInfo and the POST call
      global.fetch = async (url, options) => {
        fetchSpy.calls.push({ url, options });
        if (url.includes('/repository/files/')) {
          return { ok: true, json: async () => ({ file_path: 'new.mmd' }) };
        }
        return { ok: true, json: async () => ({ default_branch: 'main' }) };
      };

      await gitlabAdapter.putContents(owner, repo, 'mermaid/new.mmd', 'new content', 'create message', null, token);

      assert.strictEqual(fetchSpy.calls.length, 2, 'fetch should be called twice');
      const { options } = fetchSpy.calls[1];
      assert.strictEqual(options.method, 'POST', 'Method should be POST for creation');
      const body = JSON.parse(options.body);
      assert.strictEqual(body.content, btoa('new content'), 'Content should be base64 encoded');
      assert.strictEqual(body.commit_message, 'create message', 'Commit message should be correct');
      tearDown();
    });

    test('should use PUT to update an existing file', async () => {
      // Mock getRepoInfo and the PUT call
      global.fetch = async (url, options) => {
        fetchSpy.calls.push({ url, options });
        if (url.includes('/repository/files/')) {
          return { ok: true, json: async () => ({ file_path: 'existing.mmd' }) };
        }
        return { ok: true, json: async () => ({ default_branch: 'main' }) };
      };

      await gitlabAdapter.putContents(owner, repo, 'mermaid/existing.mmd', 'updated content', 'update message', 'old-sha', token);

      assert.strictEqual(fetchSpy.calls.length, 2, 'fetch should be called twice');
      const { options } = fetchSpy.calls[1];
      assert.strictEqual(options.method, 'PUT', 'Method should be PUT for update');
      const body = JSON.parse(options.body);
      assert.strictEqual(body.content, btoa('updated content'), 'Content should be base64 encoded');
      tearDown();
    });
  });

  describe('deleteContents', () => {
    test('should use DELETE to remove a file', async () => {
      // Mock getRepoInfo and the DELETE call
      global.fetch = async (url, options) => {
        fetchSpy.calls.push({ url, options });
        if (options?.method === 'DELETE') {
          return { ok: true, status: 204, json: async () => null };
        }
        return { ok: true, json: async () => ({ default_branch: 'main' }) };
      };

      await gitlabAdapter.deleteContents(owner, repo, 'mermaid/to-delete.mmd', 'delete message', 'any-sha', token);

      assert.strictEqual(fetchSpy.calls.length, 2, 'fetch should be called twice');
      const { url, options } = fetchSpy.calls[1];
      assert.strictEqual(url, `https://gitlab.com/api/v4/projects/${projectId}/repository/files/mermaid%2Fto-delete.mmd`, 'URL should be correct');
      assert.strictEqual(options.method, 'DELETE', 'Method should be DELETE');
      const body = JSON.parse(options.body);
      assert.strictEqual(body.commit_message, 'delete message', 'Commit message should be correct');
      tearDown();
    });
  });

  describe('Rate Limit Handling', () => {
    test('[UNIT] should retry with exponential backoff on a 429 error', async () => {
      let callCount = 0;
      global.fetch = async (url, options) => {
        callCount++;
        fetchSpy.calls.push({ url, options });
        if (callCount < 3) { // Fail the first two times
          return { ok: false, status: 429, json: async () => ({ message: 'Rate limit exceeded' }) };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      // We pass a very short backoff to speed up the test
      const result = await gitlabAdapter.getRepoInfo(owner, repo, token, {}, 3, 10);

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
            status: 429,
            headers: { get: (header) => header === 'Retry-After' ? '1' : null }, // 1 second
            json: async () => ({ message: 'Rate limit exceeded' })
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const startTime = Date.now();
      // Use a long backoff to prove the Retry-After header is being used instead
      await gitlabAdapter.getRepoInfo(owner, repo, token, {}, 2, 5000);
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