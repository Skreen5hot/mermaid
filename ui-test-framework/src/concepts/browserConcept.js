/**
 * Browser Concept
 * Manages browser lifecycle and Chrome DevTools Protocol (CDP) connection.
 *
 * FR-1: Browser Lifecycle Management
 * FR-4: Chrome DevTools Protocol Integration
 */

import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import http from 'http';
import { BrowserCrashError } from '../errors/index.js';

export const browserConcept = {
  state: {
    browser: null,           // Browser instance handle
    wsEndpoint: null,        // WebSocket endpoint URL
    ws: null,                // WebSocket connection
    process: null,           // Browser process reference
    cdpPort: null,           // CDP debugging port
    messageId: 0,            // CDP message ID counter
    pendingMessages: new Map(), // Pending CDP responses
    config: {
      executablePath: '',
      headless: true,
      devtools: false,
      viewport: { width: 1280, height: 720 }
    }
  },

  actions: {
    /**
     * Launch browser process and establish CDP connection
     * @param {Object} config - Browser configuration
     * @returns {Promise<Object>} Browser instance
     */
    async launch(config) {
      const self = browserConcept;

      // 1. Validate config
      validateConfig(config);

      // 2. Merge config with defaults
      self.state.config = {
        ...self.state.config,
        ...config
      };

      // 3. Build launch arguments
      const args = buildLaunchArgs(self.state.config);

      // 4. Find available port for CDP
      self.state.cdpPort = await findAvailablePort();
      args.push(`--remote-debugging-port=${self.state.cdpPort}`);

      // 5. Spawn browser process
      self.state.process = spawn(self.state.config.executablePath, args, {
        stdio: 'pipe',
        detached: false
      });

      // Handle process exit
      self.state.process.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          const error = new BrowserCrashError({
            message: `Browser process exited with code ${code}`,
            exitCode: code,
            signal,
            pid: self.state.process?.pid
          });
          self.notify('browserCrashed', error);
        }
      });

      // Handle process errors
      self.state.process.on('error', (err) => {
        const error = new BrowserCrashError({
          message: `Browser process error: ${err.message}`,
          pid: self.state.process?.pid,
          lastAction: 'launch'
        });
        self.notify('browserCrashed', error);
      });

      // 6. Wait for browser to be ready
      await waitForBrowserReady(self.state.cdpPort);

      // 7. Get WebSocket endpoint
      self.state.wsEndpoint = await getWebSocketEndpoint(self.state.cdpPort);

      // 8. Connect to CDP via WebSocket
      await self.actions.connectToCDP();

      // 9. Create browser instance handle
      self.state.browser = {
        wsEndpoint: self.state.wsEndpoint,
        pid: self.state.process.pid,
        port: self.state.cdpPort
      };

      // 10. Emit browserLaunched event
      self.notify('browserLaunched', {
        wsEndpoint: self.state.wsEndpoint,
        pid: self.state.process.pid,
        port: self.state.cdpPort
      });

      return self.state.browser;
    },

    /**
     * Connect to CDP via WebSocket
     * @returns {Promise<void>}
     */
    async connectToCDP() {
      const self = browserConcept;

      return new Promise((resolve, reject) => {
        self.state.ws = new WebSocket(self.state.wsEndpoint);

        self.state.ws.on('open', () => {
          resolve();
        });

        self.state.ws.on('error', (err) => {
          reject(new Error(`CDP WebSocket error: ${err.message}`));
        });

        self.state.ws.on('message', (data) => {
          self.actions.handleCDPMessage(data);
        });

        self.state.ws.on('close', () => {
          // WebSocket closed - browser may have crashed
          if (self.state.process && !self.state.process.killed) {
            self.notify('browserCrashed', new BrowserCrashError({
              message: 'CDP WebSocket connection closed unexpectedly',
              pid: self.state.process?.pid
            }));
          }
        });
      });
    },

    /**
     * Handle incoming CDP message
     * @param {string|Buffer} data - WebSocket message data
     */
    handleCDPMessage(data) {
      const self = browserConcept;

      try {
        const message = JSON.parse(data.toString());

        // Handle response to our command
        if (message.id !== undefined && self.state.pendingMessages.has(message.id)) {
          const { resolve, reject } = self.state.pendingMessages.get(message.id);
          self.state.pendingMessages.delete(message.id);

          if (message.error) {
            reject(new Error(`CDP Error: ${message.error.message}`));
          } else {
            resolve(message.result);
          }
        }

        // Handle CDP events (method field indicates event)
        if (message.method) {
          self.notify('cdpEvent', {
            method: message.method,
            params: message.params
          });
        }
      } catch (err) {
        // Invalid JSON - ignore
      }
    },

    /**
     * Send CDP command
     * @param {string} method - CDP method name
     * @param {Object} params - Command parameters
     * @returns {Promise<Object>} Command result
     */
    async sendCDPCommand(method, params = {}) {
      const self = browserConcept;

      if (!self.state.ws || self.state.ws.readyState !== WebSocket.OPEN) {
        throw new Error('CDP WebSocket not connected');
      }

      const id = ++self.state.messageId;
      const message = { id, method, params };

      return new Promise((resolve, reject) => {
        self.state.pendingMessages.set(id, { resolve, reject });

        self.state.ws.send(JSON.stringify(message), (err) => {
          if (err) {
            self.state.pendingMessages.delete(id);
            reject(new Error(`Failed to send CDP command: ${err.message}`));
          }
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          if (self.state.pendingMessages.has(id)) {
            self.state.pendingMessages.delete(id);
            reject(new Error(`CDP command timeout: ${method}`));
          }
        }, 30000);
      });
    },

    /**
     * Gracefully close browser and cleanup resources
     * @returns {Promise<void>}
     */
    async close() {
      const self = browserConcept;

      if (!self.state.process) {
        return; // Already closed or never launched
      }

      try {
        // 1. Send CDP close command
        if (self.state.ws && self.state.ws.readyState === WebSocket.OPEN) {
          try {
            await self.actions.sendCDPCommand('Browser.close');
          } catch (err) {
            // Ignore - browser may already be closing
          }

          // Close WebSocket connection
          self.state.ws.close();
        }

        // 2. Wait for process to exit gracefully
        const exitPromise = new Promise((resolve) => {
          if (!self.state.process || self.state.process.killed) {
            resolve();
            return;
          }

          self.state.process.once('exit', (code) => {
            resolve(code);
          });

          // Timeout after 5 seconds and force kill
          setTimeout(() => {
            if (self.state.process && !self.state.process.killed) {
              self.state.process.kill('SIGKILL');
            }
          }, 5000);
        });

        const exitCode = await exitPromise;

        // 3. Emit browserClosed event
        self.notify('browserClosed', {
          exitCode,
          pid: self.state.browser?.pid
        });

      } finally {
        // 4. Cleanup state
        self.state.browser = null;
        self.state.ws = null;
        self.state.wsEndpoint = null;
        self.state.process = null;
        self.state.cdpPort = null;
        self.state.pendingMessages.clear();
      }
    },

    /**
     * Get WebSocket endpoint for CDP connection
     * @returns {string} WebSocket URL
     */
    getWSEndpoint() {
      return browserConcept.state.wsEndpoint;
    }
  },

  // Event subscription registry
  _subscribers: [],

  /**
   * Emit event to subscribers
   * @param {string} event - Event name
   * @param {Object} payload - Event data
   */
  notify(event, payload) {
    this._subscribers.forEach(fn => fn(event, payload));
  },

  /**
   * Subscribe to events
   * @param {Function} fn - Callback function (event, payload) => void
   */
  subscribe(fn) {
    this._subscribers.push(fn);
  }
};

// Pure functions for browser concept

/**
 * Build command-line arguments for Chromium launch
 * @param {Object} config - Browser configuration
 * @returns {string[]} Array of CLI flags
 */
export function buildLaunchArgs(config) {
  const args = [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ];

  if (config.headless) {
    args.push('--headless');
  }

  if (config.viewport) {
    args.push(`--window-size=${config.viewport.width},${config.viewport.height}`);
  }

  return args;
}

/**
 * Validate browser configuration
 * @param {Object} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
export function validateConfig(config) {
  if (!config.executablePath) {
    throw new Error('Browser executable path is required');
  }

  if (config.viewport) {
    if (typeof config.viewport.width !== 'number' || config.viewport.width <= 0) {
      throw new Error('Invalid viewport width');
    }
    if (typeof config.viewport.height !== 'number' || config.viewport.height <= 0) {
      throw new Error('Invalid viewport height');
    }
  }
}

/**
 * Find an available port for CDP
 * @returns {Promise<number>} Available port number
 */
export async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();

    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });

    server.on('error', reject);
  });
}

/**
 * Wait for browser to be ready and accepting CDP connections
 * @param {number} port - CDP port
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
export async function waitForBrowserReady(port, timeout = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await fetchJSON(`http://localhost:${port}/json/version`);
      return; // Browser is ready
    } catch (err) {
      // Not ready yet, wait and retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Browser did not become ready within ${timeout}ms`);
}

/**
 * Get WebSocket endpoint URL from CDP
 * @param {number} port - CDP port
 * @returns {Promise<string>} WebSocket endpoint URL
 */
export async function getWebSocketEndpoint(port) {
  try {
    const version = await fetchJSON(`http://localhost:${port}/json/version`);
    return version.webSocketDebuggerUrl;
  } catch (err) {
    throw new Error(`Failed to get WebSocket endpoint: ${err.message}`);
  }
}

/**
 * Fetch JSON from HTTP endpoint
 * @param {string} url - URL to fetch
 * @returns {Promise<Object>} Parsed JSON response
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', reject);
  });
}
