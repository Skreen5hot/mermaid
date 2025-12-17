/**
 * Trace Concept
 * Manages execution trace logging for agentic observability.
 *
 * FR-51: Execution Trace Logging
 * FR-52: Machine-Readable Error Context
 */

export const traceConcept = {
  state: {
    events: [],              // TraceEvent[]
    sequenceId: 0,
    bufferSize: 100          // Keep last 100 events
  },

  actions: {
    /**
     * Log action to trace
     * @param {string} action - Action type
     * @param {Object} details - Action details
     */
    logAction(action, details) {
      const event = createTraceEvent(action, details, this.state.sequenceId++);

      this.state.events.push(event);

      // Maintain buffer size
      if (this.state.events.length > this.state.bufferSize) {
        this.state.events.shift();
      }

      this.notify('traceEventLogged', { event });
    },

    /**
     * Retrieve last N trace events
     * @param {number} count - Number of events to retrieve
     * @returns {Array} Recent trace events
     */
    getRecentTrace(count = 10) {
      return this.state.events.slice(-count);
    },

    /**
     * Clear trace buffer
     */
    clearTrace() {
      this.state.events = [];
      this.state.sequenceId = 0;
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

// Pure functions for trace concept

/**
 * Create trace event object
 * @param {string} action - Action type
 * @param {Object} details - Action details
 * @param {number} sequenceId - Sequence number
 * @returns {Object} TraceEvent
 */
export function createTraceEvent(action, details, sequenceId) {
  return {
    timestamp: Date.now(),
    sequenceId,
    action,
    selector: details.selector,
    success: details.success !== false,
    duration: details.duration || 0,
    error: details.error ? {
      type: details.error.name,
      message: details.error.message
    } : undefined,
    context: {
      url: details.pageUrl || details.url || '',
      viewport: details.viewport || {},
      elementSnapshot: details.elementSnapshot
    }
  };
}

/**
 * Format trace events for error output
 * @param {Array} events - Trace events
 * @returns {string} Formatted trace
 */
export function formatTraceForError(events) {
  if (!events || events.length === 0) {
    return 'No trace available';
  }

  const lines = ['Last 10 actions:'];
  events.forEach((event, index) => {
    const status = event.success ? '✓' : '✗';
    lines.push(
      `${index + 1}. ${status} ${event.action}${event.selector ? ` "${event.selector}"` : ''} (${event.duration}ms)`
    );
  });

  return lines.join('\n');
}
