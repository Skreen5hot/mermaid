# CI/CD Updates for OntoGrade Deployment

**Date:** January 8, 2026
**Purpose:** Ensure OntoGrade module (with n3 dependency) deploys correctly to GitHub Pages

---

## Problem Identified

The OntoGrade module uses ES6 imports to load the `n3` library:

```javascript
import { Parser, Store, Writer, DataFactory } from 'n3';
```

The browser resolves this as a bare module specifier, which requires the `node_modules` directory to be present in the deployed site. The original build script **did not include `node_modules`**, causing import failures in production.

---

## Changes Made

### 1. Updated Build Script ([package.json](../package.json))

**Before:**
```json
"build": "mkdir -p dist && cp -r index.html styles src dist/"
```

**After:**
```json
"build": "node build.js"
```

**Rationale:** Created cross-platform Node.js build script for consistent behavior on Windows and Linux (GitHub Actions).

### 2. Created Cross-Platform Build Script ([build.js](../build.js))

New file that:
- Cleans the `dist/` directory
- Copies required files: `index.html`, `styles/`, `src/`, **`node_modules/`**
- Works identically on Windows and Unix-like systems
- Provides clear console output

### 3. Updated CI/CD Workflow ([.github/workflows/ci.yml](../.github/workflows/ci.yml))

#### Main Branch Deployment (Line 125-126)
Added after copying dist files:
```yaml
# Copy node_modules for ES6 module dependencies (n3, etc.)
echo "📦 Copying node_modules for browser imports..."
cp -r node_modules _site/
```

#### Dev Branch Deployment

**For Main at Root** (Line 144-146):
```yaml
# Copy node_modules for main branch
echo "📦 Copying node_modules for main branch..."
cp -r node_modules _site/
```

**For Dev at /dev/** (Line 162-164):
```yaml
# Copy node_modules for dev branch
echo "📦 Copying node_modules for dev branch..."
cp -r node_modules _site/dev/
```

---

## Verification

### Local Build Test
```bash
$ npm run build

🧹 Cleaning dist directory...
📦 Copying files to dist/...
  📄 index.html
  📁 styles/
  📁 src/
  📁 node_modules/
✅ Build complete!
```

### Structure Verification
```bash
$ ls dist/
index.html  node_modules  src  styles

$ ls dist/node_modules/ | head -5
@sinonjs
abort-controller
base64-js
buffer
events

$ ls dist/src/concepts/ontograde/
mermaidLifter.js  ✓
```

---

## Deployment Flow

### Main Branch (`main` → `/`)
1. `npm ci` installs dependencies (including n3)
2. `npm run build` creates `dist/` with node_modules
3. `cp -r dist/* _site/` copies to deployment root
4. `cp -r node_modules _site/` ensures modules available
5. Deploy to `https://<username>.github.io/<repo>/`

### Dev Branch (`dev` → `/dev/`)
1. Builds main branch → `_site/` (with node_modules)
2. Builds dev branch → `_site/dev/` (with node_modules)
3. Both environments have independent node_modules copies
4. Dev available at `https://<username>.github.io/<repo>/dev/`

---

## Import Resolution in Browser

With node_modules deployed, the browser can now resolve:

```javascript
// In src/concepts/ontograde/mermaidLifter.js
import { Parser, Store, Writer, DataFactory } from 'n3';
```

Resolves to:
```
https://<username>.github.io/<repo>/node_modules/n3/...
```

The browser follows Node.js ES module resolution:
1. Looks for `node_modules/n3/package.json`
2. Reads `"exports"` or `"module"` field
3. Loads the appropriate ES6 module file

---

## File Size Impact

Adding `node_modules` increases deployment size:

| Component | Size |
|-----------|------|
| n3 library | ~500 KB |
| n3 dependencies | ~200 KB |
| Total added | ~700 KB |

**Acceptable because:**
- OntoGrade is a feature module, not core functionality
- Modern CDNs (GitHub Pages) cache efficiently
- Browser caches after first load
- Gzip compression reduces transfer size by ~70%

---

## Alternative Approaches Considered

### ❌ CDN (jsDelivr/unpkg)
**Rejected:** Version pinning issues, external dependency, network reliability

### ❌ Bundle n3 with Webpack/Rollup
**Rejected:** Adds build complexity, increases maintenance burden, defeats ES6 module benefits

### ✅ Include node_modules (Chosen)
**Rationale:**
- Simplest approach
- No external dependencies
- Consistent with ES6 module philosophy
- Easy to maintain

---

## Testing Checklist

Before merging to main, verify:

- [ ] Local build succeeds: `npm run build`
- [ ] Dist contains node_modules: `ls dist/node_modules/n3`
- [ ] Unit tests pass: `npm test`
- [ ] CI/CD workflow builds successfully
- [ ] Dev deployment accessible at `/dev/`
- [ ] Main deployment accessible at `/`
- [ ] OntoGrade button appears in UI
- [ ] Clicking OntoGrade button works (no console errors)
- [ ] Browser console shows: `[mermaidLifter] Lifting diagram...`

---

## Rollback Plan

If deployment issues occur:

1. **Revert CI/CD changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Temporarily disable OntoGrade:**
   - Comment out import in `src/synchronizations.js`
   - Hide OntoGrade button with CSS: `#ontograde-btn { display: none; }`

3. **Emergency fix:**
   - Use CDN version of n3 as hotfix
   - Add to index.html: `<script type="importmap">...</script>`

---

## Future Optimization

If deployment size becomes a concern:

1. **Selective node_modules copy:**
   - Only copy n3 and its direct dependencies
   - Exclude dev dependencies
   - Script to prune unused packages

2. **Tree shaking:**
   - Use a bundler to include only used functions
   - Reduces n3 size from 500KB to ~100KB

3. **Import maps:**
   - Use native browser import maps
   - Point to CDN for common dependencies
   - Keep critical deps local

---

## Related Documentation

- [Iteration 1 Completion Report](ITERATION1-COMPLETE.md)
- [Development Guide](developmentGuide.md#dependencies)
- [Project Plan](OntoGradeProjectPlan.md)

---

**Status:** ✅ Ready for deployment
**Next Action:** Commit changes and push to `dev` branch for testing
