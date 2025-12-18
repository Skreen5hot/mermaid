/**
 * Context Concept
 * Manages isolated browser contexts for test isolation.
 *
 * FR-3: Context Isolation
 */

import { browserConcept } from './browserConcept.js';

export const contextConcept = {
  state: {
    contexts: new Map(),     // contextId -> { browserContextId, targetId, sessionId, created }
    activeContext: null
  },

  actions: {
    /**
     * Create isolated browser context via CDP
     * @param {Object} options - Context options
     * @returns {Promise<string>} Context ID (internal UUID)
     */
    async createContext(options = {}) {
      const self = contextConcept;

      // 1. Generate unique context ID
      const contextId = generateContextId();
      const startTime = Date.now();

      try {
        // 2. Send CDP Target.createBrowserContext command
        const result = await browserConcept.actions.sendCDPCommand('Target.createBrowserContext', {
          disposeOnDetach: true,
          proxyServer: options.proxyServer,
          proxyBypassList: options.proxyBypassList
        });

        const browserContextId = result.browserContextId;

        // 3. Create a page target in this context
        const targetResult = await browserConcept.actions.sendCDPCommand('Target.createTarget', {
          url: 'about:blank',
          browserContextId
        });

        const targetId = targetResult.targetId;

        // 4. Attach to the target to get session
        const sessionId = await browserConcept.actions.attachToTarget(targetId);

        // 5. Store context info in state
        self.state.contexts.set(contextId, {
          browserContextId,
          targetId,
          sessionId,
          created: Date.now(),
          options
        });

        // Set as active if it's the first context
        if (!self.state.activeContext) {
          self.state.activeContext = contextId;
        }

        // 6. Emit contextCreated event
        self.notify('contextCreated', {
          contextId,
          browserContextId,
          targetId,
          sessionId,
          duration: Date.now() - startTime
        });

        return contextId;

      } catch (err) {
        self.notify('contextCreationFailed', {
          contextId,
          error: err,
          duration: Date.now() - startTime
        });
        throw new Error(`Failed to create browser context: ${err.message}`);
      }
    },

    /**
     * Destroy browser context and cleanup
     * @param {string} contextId - Context to destroy
     * @returns {Promise<void>}
     */
    async destroyContext(contextId) {
      const self = contextConcept;

      // 1. Validate context exists
      if (!self.state.contexts.has(contextId)) {
        throw new Error(`Context ${contextId} does not exist`);
      }

      const context = self.state.contexts.get(contextId);
      const startTime = Date.now();

      try {
        // 2. Send CDP Target.disposeBrowserContext command
        await browserConcept.actions.sendCDPCommand('Target.disposeBrowserContext', {
          browserContextId: context.browserContextId
        });

        // 3. Remove from state
        self.state.contexts.delete(contextId);

        // 4. Clear active context if this was it
        if (self.state.activeContext === contextId) {
          // Set to another context if available, or null
          const remainingContexts = Array.from(self.state.contexts.keys());
          self.state.activeContext = remainingContexts[0] || null;
        }

        // 5. Emit contextDestroyed event
        self.notify('contextDestroyed', {
          contextId,
          browserContextId: context.browserContextId,
          duration: Date.now() - startTime
        });

      } catch (err) {
        self.notify('contextDestructionFailed', {
          contextId,
          error: err,
          duration: Date.now() - startTime
        });
        throw new Error(`Failed to destroy context ${contextId}: ${err.message}`);
      }
    },

    /**
     * Switch active context
     * @param {string} contextId - Context to activate
     */
    switchContext(contextId) {
      const self = contextConcept;

      if (!self.state.contexts.has(contextId)) {
        throw new Error(`Context ${contextId} does not exist`);
      }

      const previousContext = self.state.activeContext;
      self.state.activeContext = contextId;

      self.notify('contextSwitched', {
        from: previousContext,
        to: contextId
      });
    },

    /**
     * Get active context info
     * @returns {Object|null} Active context data
     */
    getActiveContext() {
      const self = contextConcept;

      if (!self.state.activeContext) {
        return null;
      }

      return {
        contextId: self.state.activeContext,
        ...self.state.contexts.get(self.state.activeContext)
      };
    },

    /**
     * Get context by ID
     * @param {string} contextId - Context ID
     * @returns {Object|null} Context data
     */
    getContext(contextId) {
      const self = contextConcept;

      if (!self.state.contexts.has(contextId)) {
        return null;
      }

      return {
        contextId,
        ...self.state.contexts.get(contextId)
      };
    },

    /**
     * List all contexts
     * @returns {Array} Array of context info
     */
    listContexts() {
      const self = contextConcept;

      return Array.from(self.state.contexts.entries()).map(([contextId, data]) => ({
        contextId,
        ...data,
        isActive: contextId === self.state.activeContext
      }));
    },

    /**
     * Destroy all contexts
     * @returns {Promise<void>}
     */
    async destroyAllContexts() {
      const self = contextConcept;
      const contextIds = Array.from(self.state.contexts.keys());

      for (const contextId of contextIds) {
        try {
          await self.actions.destroyContext(contextId);
        } catch (err) {
          // Continue destroying other contexts even if one fails
          console.error(`Failed to destroy context ${contextId}:`, err);
        }
      }
    }
  },

  _subscribers: [],

  notify(event, payload) {
    this._subscribers.forEach(fn => fn(event, payload));
  },

  subscribe(fn) {
    this._subscribers.push(fn);
  }
};

// Pure functions for context concept

/**
 * Generate unique context ID
 * @returns {string} UUID v4
 */
export function generateContextId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
