# Vendored third-party scripts

Same-origin copies of the runtime dependencies the app loads in the browser.
Pinned by major version (mermaid@11) or exact version (jszip).

| File | Version | Source |
|------|---------|--------|
| `mermaid.min.js` | 11.15.0 | `https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js` |
| `jszip.min.js`   | 3.10.1  | `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js` |

These are vendored (not pulled from a CDN at runtime) so the strict CSP can
use `script-src 'self'` without allowlisting third-party origins. A
compromised CDN can't backdoor a single user's session.

## Refreshing

```bash
curl -sSL "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js" -o vendor/mermaid.min.js
curl -sSL "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" -o vendor/jszip.min.js
```

Then verify the version of mermaid:

```bash
curl -sSL "https://cdn.jsdelivr.net/npm/mermaid@11/package.json" | grep '"version"'
```

Update this README's version table before committing.

## Why not npm install?

The app has no build step; it serves source directly. Vendoring keeps that
property while still giving us a fixed-content audit surface that's smaller
than `node_modules/`.
