# Dual-Environment GitHub Pages Deployment

A strategy for serving both **production** (`main`) and **preview** (`dev`) builds from a single GitHub Pages site using branch-based routing and dynamic base path injection.

---

## Overview

| | Production | Development |
|---|---|---|
| **Branch** | `main` | `dev` |
| **URL** | `https://<user>.github.io/<repo>/` | `https://<user>.github.io/<repo>/dev/` |
| **Purpose** | Stable release | Feature preview |
| **Trigger** | Push to `main` | Push to `dev` |

Both environments are deployed as a single GitHub Pages artifact. Production lives at the site root; dev lives in a `/dev/` subdirectory. No custom domains, no separate repositories, no additional infrastructure.

## How It Works

### The Core Idea

GitHub Pages serves static files from a single directory tree. We build both branches into one directory structure:

```
_site/                          <-- GitHub Pages artifact
  index.html                    <-- from main branch (production)
  styles/
  src/
  dev/                          <-- subdirectory for dev branch
    index.html                  <-- from dev branch (preview)
    styles/
    src/
  environments.html             <-- navigation page (generated)
```

The key challenge is **path resolution**. When the app runs at `/dev/`, relative paths like `./styles/style.css` resolve to `/dev/styles/style.css`. When it runs at `/`, they resolve to `/styles/style.css`. Since the source code uses relative paths throughout, no code changes are needed -- we just inject a `<base>` tag for the dev build.

### Deployment Pipeline

```
Push to main or dev
        |
        v
  [build-and-test]
  - npm ci
  - npm test
  - npm run test:ontograde
  - npm run security-check
  - UI tests (headless Chrome)
        |
        v (tests pass)
  [deploy]
  - Build _site/ directory
  - Upload Pages artifact
  - Deploy to GitHub Pages
```

## Implementation

### Workflow File

File: `.github/workflows/ci.yml`

#### Triggers

```yaml
on:
  push:
    branches: [ "main", "dev" ]
  pull_request:
    branches: [ "main" ]
```

Pull requests run tests only (no deployment). Pushes to `main` or `dev` run tests, then deploy.

#### Deploy Job (Conditional)

```yaml
deploy:
  if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/dev'
  needs: build-and-test
  runs-on: ubuntu-latest
  permissions:
    pages: write
    id-token: write
    contents: read
```

The deploy job only runs after `build-and-test` succeeds, and only for direct pushes to `main` or `dev`.

#### Branch-Specific Build Logic

**When `main` is pushed:**

```bash
npm run build
cp -r dist/* _site/
```

Simple -- build and copy to the artifact root.

**When `dev` is pushed:**

```bash
# 1. Build main branch for the root path
git fetch origin main
git checkout origin/main
npm install
npm run build
cp -r dist/* _site/

# 2. Switch back to dev and build for /dev/ path
git checkout -f -
npm ci
npm run build
mkdir -p _site/dev
cp -r dist/* _site/dev/

# 3. Inject <base> tag into dev's index.html
REPO_NAME="${{ github.repository }}"
REPO_NAME="${REPO_NAME#*/}"
BASE_PATH="/${REPO_NAME}/dev/"

awk -v base="$BASE_PATH" \
  '/<\/title>/ {print; print "    <base href=\"" base "\">"; next} 1' \
  _site/dev/index.html > _site/dev/index.html.tmp
mv _site/dev/index.html.tmp _site/dev/index.html
```

This is the clever part: when dev is deployed, it also rebuilds main so both versions are always current. The `awk` command inserts a `<base>` tag immediately after `</title>`, ensuring all relative URLs resolve correctly from the `/dev/` subdirectory.

### The `<base>` Tag

This is the single most important piece of the strategy.

**Problem:** Your app uses relative paths everywhere:

```html
<link rel="stylesheet" href="styles/style.css">
<script type="module">
  import { initializeApp } from './src/synchronizations.js';
</script>
```

At the root (`/`), these resolve fine. At `/dev/`, the browser would look for `/styles/style.css` instead of `/dev/styles/style.css`.

**Solution:** Inject `<base href="/mermaid/dev/">` into the dev build's `<head>`:

```html
<head>
  <title>Mermaid IDE</title>
  <base href="/mermaid/dev/">      <!-- injected by CI/CD -->
  <link rel="stylesheet" href="styles/style.css">
  <!-- now resolves to /mermaid/dev/styles/style.css -->
</head>
```

The `<base>` tag tells the browser: "resolve all relative URLs from this path." No source code changes required.

**What it affects:**
- `href` attributes on links and stylesheets
- `src` attributes on scripts and images
- ES module `import` statements with relative paths
- Import map entries with relative paths

**What it does NOT affect:**
- Absolute URLs (`https://cdn.example.com/...`)
- URLs beginning with `/` (already absolute)

### Import Maps

If your app uses bare module specifiers (e.g., `import { Parser } from 'n3'`), you need an import map:

```html
<script type="importmap">
{
  "imports": {
    "n3": "./node_modules/n3/src/index.js"
  }
}
</script>
```

The relative path `./node_modules/...` is resolved against the `<base>` tag, so it works at both `/` and `/dev/` without modification.

**Alternative:** Use a CDN to avoid bundling `node_modules` entirely:

```html
<script type="importmap">
{
  "imports": {
    "n3": "https://esm.sh/n3@1.17.2"
  }
}
</script>
```

### Environments Navigation Page

The workflow generates a simple navigation page at `/environments.html`:

```html
<a href="/">Production (MAIN)</a>
<a href="/dev/">Development (DEV)</a>
```

This is optional but useful for quickly switching between environments.

### GitHub Pages Configuration

In your repository settings:

1. **Settings > Pages > Source**: Set to "GitHub Actions"
2. No `CNAME` file needed (uses default `*.github.io` domain)
3. No `_config.yml` or `.nojekyll` file needed

The workflow uses the official GitHub Actions for Pages:

```yaml
- uses: actions/configure-pages@v5
- uses: actions/upload-pages-artifact@v3
  with:
    path: './_site'
- uses: actions/deploy-pages@v4
```

### Required Permissions

The deploy job needs these permissions:

```yaml
permissions:
  pages: write       # Deploy to GitHub Pages
  id-token: write    # OIDC token for Pages deployment
  contents: read     # Read repository contents
```

## Adapting This for Your Project

### Minimal Setup (No Build Step)

If your project is plain HTML/CSS/JS with no build step:

```yaml
- name: Prepare deployment
  run: |
    mkdir -p _site

    if [ "${{ github.ref }}" == "refs/heads/main" ]; then
      # Copy everything to root
      cp -r index.html styles/ src/ _site/
    else
      # Copy main to root
      git fetch origin main
      git checkout origin/main
      cp -r index.html styles/ src/ _site/

      # Copy dev to /dev/
      git checkout -f -
      mkdir -p _site/dev
      cp -r index.html styles/ src/ _site/dev/

      # Inject base tag
      REPO_NAME="${{ github.repository }}"
      REPO_NAME="${REPO_NAME#*/}"
      BASE_PATH="/${REPO_NAME}/dev/"
      awk -v base="$BASE_PATH" \
        '/<\/title>/ {print; print "    <base href=\"" base "\">"; next} 1' \
        _site/dev/index.html > _site/dev/index.html.tmp
      mv _site/dev/index.html.tmp _site/dev/index.html
    fi
```

### With a Bundler (Vite, Webpack, etc.)

If you use a bundler, set the base path at build time instead of injecting it post-build:

```yaml
# Vite example
- name: Build dev
  run: npx vite build --base /${REPO_NAME}/dev/
```

```yaml
# Webpack / Create React App
- name: Build dev
  run: PUBLIC_URL=/${REPO_NAME}/dev/ npm run build
```

This approach is cleaner because the bundler handles all asset path rewriting.

### With a Framework (React Router, Vue Router, etc.)

For SPAs with client-side routing, you also need a 404 fallback. GitHub Pages doesn't support server-side rewrites, but you can use a `404.html` trick:

```bash
# Copy index.html as 404.html so GitHub Pages serves it for all routes
cp _site/dev/index.html _site/dev/404.html
```

And configure your router with the base path:

```js
// React Router
<BrowserRouter basename="/repo-name/dev">

// Vue Router
const router = createRouter({
  history: createWebHistory('/repo-name/dev/'),
})
```

## Gotchas

### 1. Dev deployment rebuilds main every time

When you push to `dev`, the workflow checks out and builds `main` too. This ensures both environments are always consistent but adds ~30 seconds to deploy time.

### 2. `<base>` affects ALL relative URLs

The `<base>` tag is global. If any part of your app constructs URLs manually (e.g., `window.location.pathname + '/api'`), those paths will NOT be affected by `<base>`. Only HTML-resolved references are affected.

### 3. Import maps must come before module scripts

```html
<!-- This order matters -->
<script type="importmap">{ ... }</script>    <!-- FIRST -->
<script type="module">import ...</script>    <!-- AFTER -->
```

Browsers will error if a module script loads before its import map is parsed.

### 4. No server-side routing

GitHub Pages is purely static. You cannot do server-side redirects, rewrites, or API proxying. All routing must be client-side (hash-based or with the 404.html fallback).

### 5. Caching

GitHub Pages applies aggressive caching. After a deploy, users may need to hard-refresh (`Ctrl+Shift+R`) to see changes. Consider adding cache-busting query strings or version hashes to critical assets if this becomes an issue.

## Development Workflow

```
1. Work on feature branch (branched from dev)
2. Merge to dev
3. Push triggers CI: tests + deploy to /dev/
4. Preview at https://<user>.github.io/<repo>/dev/
5. When ready, create PR from dev to main
6. Merge to main
7. Push triggers CI: tests + deploy to /
8. Live at https://<user>.github.io/<repo>/
```

## File Reference

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI/CD pipeline with dual deployment logic |
| `scripts/build.js` | Build script (copies files to `dist/`) |
| `index.html` | App entry point (uses relative paths) |
| `package.json` | `build`, `test`, `security-check` scripts |

---

**This strategy requires zero changes to application source code.** The only deployment-specific logic lives in the CI/CD workflow, making it easy to adopt for any static site or SPA.
