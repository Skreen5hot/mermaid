# Chrome DevTools Protocol (CDP) Implementation

This document explains how the browser concept implements CDP communication using raw WebSockets.

## Architecture Overview

The browser concept uses a **direct WebSocket connection** to communicate with Chrome/Chromium via the Chrome DevTools Protocol, avoiding heavyweight libraries like Puppeteer or Playwright.

### Key Components

1. **Process Spawning**: Launches Chromium with `--remote-debugging-port`
2. **WebSocket Connection**: Connects to CDP endpoint for bidirectional communication
3. **Message Protocol**: Implements CDP JSON-RPC message format
4. **Event Handling**: Listens for CDP events and responses

## Implementation Details

### 1. Browser Launch Flow

```javascript
launch(config) →
  ├─ validateConfig()
  ├─ findAvailablePort()              // Find free port for CDP
  ├─ spawn(executablePath, args)      // Start browser process
  ├─ waitForBrowserReady(port)        // Poll until CDP is ready
  ├─ getWebSocketEndpoint(port)       // Fetch WS URL from /json/version
  ├─ connectToCDP()                   // Establish WebSocket connection
  └─ emit('browserLaunched')
```

### 2. CDP WebSocket Connection

The WebSocket endpoint is discovered via HTTP:

```bash
# Browser exposes CDP metadata on this endpoint
GET http://localhost:{port}/json/version

# Response:
{
  "webSocketDebuggerUrl": "ws://localhost:9222/devtools/browser/..."
}
```

### 3. CDP Message Protocol

**Sending Commands:**

```json
{
  "id": 1,
  "method": "Browser.getVersion",
  "params": {}
}
```

**Receiving Responses:**

```json
{
  "id": 1,
  "result": {
    "product": "Chrome/120.0.0.0",
    "userAgent": "Mozilla/5.0..."
  }
}
```

**Receiving Events:**

```json
{
  "method": "Page.loadEventFired",
  "params": {
    "timestamp": 123456.789
  }
}
```

### 4. Message Correlation

Commands are correlated with responses using an incrementing `messageId`:

```javascript
state: {
  messageId: 0,
  pendingMessages: Map {
    1 → { resolve, reject },
    2 → { resolve, reject }
  }
}
```

When a response arrives, we:
1. Check if `message.id` exists in `pendingMessages`
2. Resolve/reject the corresponding promise
3. Remove from pending map

### 5. Error Handling

**Browser Crash Detection:**

```javascript
process.on('exit', (code) => {
  if (code !== 0) {
    emit('browserCrashed', new BrowserCrashError({ ... }))
  }
})

ws.on('close', () => {
  if (process.alive) {
    emit('browserCrashed', ...)
  }
})
```

**Command Timeouts:**

All CDP commands have a 30-second timeout:

```javascript
setTimeout(() => {
  if (pendingMessages.has(id)) {
    pendingMessages.delete(id)
    reject(new Error('CDP command timeout'))
  }
}, 30000)
```

## Pure Functions

The implementation separates pure functions from side effects:

### Pure Functions (testable without I/O)

- `buildLaunchArgs(config)` - Generate CLI flags
- `validateConfig(config)` - Validate configuration

### I/O Functions (require browser instance)

- `findAvailablePort()` - Find free TCP port
- `waitForBrowserReady(port)` - Poll CDP endpoint
- `getWebSocketEndpoint(port)` - Fetch WS URL
- `fetchJSON(url)` - HTTP GET helper

## Example Usage

```javascript
import { browserConcept } from './browserConcept.js';

// Launch browser
const browser = await browserConcept.actions.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  viewport: { width: 1280, height: 720 }
});

// Send CDP command
const version = await browserConcept.actions.sendCDPCommand('Browser.getVersion');
console.log(version.product); // "Chrome/120.0.0.0"

// Close browser
await browserConcept.actions.close();
```

## CDP Commands Used

### Browser Management

- `Browser.getVersion` - Get browser version info
- `Browser.close` - Gracefully close browser

### (To be implemented in other concepts)

- `Target.createBrowserContext` - Create isolated context
- `Target.disposeBrowserContext` - Destroy context
- `Page.navigate` - Navigate to URL
- `Runtime.evaluate` - Execute JavaScript
- `DOM.querySelector` - Query elements
- `Input.dispatchMouseEvent` - Simulate clicks
- `Input.dispatchKeyEvent` - Simulate typing

## Performance Characteristics

- **Browser Launch**: < 2 seconds (headless)
- **CDP Connection**: < 100ms (localhost WebSocket)
- **Command Latency**: < 50ms (simple commands)
- **Context Creation**: < 100ms

## Dependencies

**Required:**
- Node.js `child_process` - Process spawning
- Node.js `http` - CDP endpoint discovery
- `ws` package - WebSocket client

**Optional:**
- `chrome-remote-interface` - Alternative CDP transport (not currently used)

## Testing

**Unit Tests** ([tests/browserConcept.test.js](../../tests/browserConcept.test.js)):
- Pure function tests
- Configuration validation

**Integration Tests** ([tests/browserConcept.integration.test.js](../../tests/browserConcept.integration.test.js)):
- Full launch/close cycle
- CDP command execution
- Event emission verification

Run tests:
```bash
npm test                                    # Unit tests only
node tests/browserConcept.integration.test.js  # Integration tests
```

## Debugging

Enable CDP protocol logging:

```javascript
browserConcept.subscribe((event, payload) => {
  if (event === 'cdpEvent') {
    console.log('CDP Event:', payload.method, payload.params);
  }
});
```

## Future Enhancements

1. **Connection Pooling**: Reuse browser instances across test suites
2. **Retry Logic**: Auto-reconnect on transient WebSocket failures
3. **Protocol Domains**: Lazy-load CDP domains (Page, DOM, Network, etc.)
4. **Parallel Sessions**: Multiple CDP sessions in one browser instance

## References

- [Chrome DevTools Protocol Documentation](https://chromedevtools.github.io/devtools-protocol/)
- [WebSocket RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)
- [Chromium Command Line Switches](https://peter.sh/experiments/chromium-command-line-switches/)
