# Vendored third-party scripts

Same-origin copies of the runtime dependencies the app loads in the browser.
Pinned by major version (mermaid@11) or exact version (jszip).

| File | Version | Source |
|------|---------|--------|
| `mermaid.min.js` | 11.14.0 | `https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.min.js` (pinned exactly — see note below) |
| `jszip.min.js`   | 3.10.1  | `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js` |

These are vendored (not pulled from a CDN at runtime) so the strict CSP can
use `script-src 'self'` without allowlisting third-party origins. A
compromised CDN can't backdoor a single user's session.

## Note on the mermaid pin

We pin mermaid to an **exact** version, not the `@11` major range. The
floating major form was used initially but mermaid 11.15.0 regressed CSS
generation for classDefs whose names contain `:` — a `classDef X:Y` source
that worked in 11.14.0 throws `Failed to execute 'insertRule' on
'CSSStyleSheet'` in 11.15.0. Pinning lets us avoid those regressions until
we choose to take a new version.

## Refreshing

```bash
# Replace the exact version below when bumping intentionally
curl -sSL "https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.min.js" -o vendor/mermaid.min.js
curl -sSL "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" -o vendor/jszip.min.js
```

To see what's available upstream:

```bash
curl -sSL "https://data.jsdelivr.com/v1/package/npm/mermaid" | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log('latest:', d.tags.latest); console.log('top 5:', d.versions.filter(v=>v.startsWith('11.')).slice(0,5));"
```

Update this README's version table before committing.

## Why not npm install?

The app has no build step; it serves source directly. Vendoring keeps that
property while still giving us a fixed-content audit surface that's smaller
than `node_modules/`.
