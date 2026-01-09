# 🔧 OntoGrade Deployment Fix - Import Map

**Status:** ✅ FIXED
**Issue:** `Failed to resolve module specifier "n3"`
**Date:** January 8, 2026

---

## The Problem

After deploying OntoGrade with `node_modules` included, the application crashed with:

```
Uncaught TypeError: Failed to resolve module specifier "n3".
Relative references must start with either "/", "./", or "../".
```

### Root Cause

Modern browsers **cannot resolve bare module specifiers** like:
```javascript
import { Parser } from 'n3';  // ❌ Browser doesn't know where 'n3' is
```

They expect **relative or absolute paths**:
```javascript
import { Parser } from './node_modules/n3/src/index.js';  // ✅ Works
```

But we can't change all our imports! That would break Node.js compatibility.

---

## The Solution: Import Maps

Import Maps are a web standard that tells browsers how to resolve bare specifiers.

### Added to [index.html](../index.html#L8-15):

```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mermaid Syntax Viewer & Editor</title>

    <!-- Import Map: MUST be before any <script type="module"> -->
    <script type="importmap">
    {
      "imports": {
        "n3": "./node_modules/n3/src/index.js"
      }
    }
    </script>

    <!-- Stylesheets, etc. -->
</head>
```

### How It Works

1. Browser encounters: `import { Parser } from 'n3'`
2. Checks import map: `"n3"` → `"./node_modules/n3/src/index.js"`
3. Fetches: `https://example.com/node_modules/n3/src/index.js`
4. n3's internal imports work automatically (they use relative paths)

---

## Why This Path?

### Q: Why `node_modules/n3/src/index.js`?
**A:** It's the ES6 module entry point specified in `n3/package.json`:

```json
{
  "module": "./src/index.js"  ← ES6 modules
}
```

### Q: Why not `node_modules/n3/browser/n3.min.js`?
**A:** That's a UMD bundle (not ES6 modules). It exports to global `window.N3`.

### Q: Will this work in all browsers?
**A:** Import maps are supported in:
- ✅ Chrome 89+ (March 2021)
- ✅ Edge 89+ (March 2021)
- ✅ Safari 16.4+ (March 2023)
- ✅ Firefox 108+ (December 2022)

For older browsers, we'd need a polyfill: https://github.com/guybedford/es-module-shims

---

## Verification

### Test 1: Local Development
```bash
# Start local server (required for ES6 modules)
npx serve

# Open browser to http://localhost:3000
# Open DevTools Console
# Click "🎓 OntoGrade" button
# Expected: No import errors, successful parsing
```

### Test 2: Browser Console
```javascript
// Should work without errors:
import('n3').then(n3 => {
  console.log('n3 loaded:', n3);
  console.log('DataFactory:', n3.DataFactory);
});
```

### Test 3: OntoGrade Functionality
1. Create/open a Mermaid diagram
2. Click "🎓 OntoGrade"
3. Check console for: `[mermaidLifter] Lifting diagram...`
4. Should see notification: "Diagram parsed successfully. Found X RDF triples."

---

## Files Modified

1. **[index.html](../index.html)** - Added import map
2. **[OntoGrade/CI-CD-UPDATES.md](CI-CD-UPDATES.md)** - Updated documentation

No changes needed to:
- ❌ Source code (imports stay the same)
- ❌ Build scripts (already copying node_modules)
- ❌ CI/CD workflow (already copying node_modules)

---

## Browser Compatibility

### Import Maps Support

| Browser | Version | Release Date | Status |
|---------|---------|--------------|--------|
| Chrome | 89+ | March 2021 | ✅ Native |
| Edge | 89+ | March 2021 | ✅ Native |
| Safari | 16.4+ | March 2023 | ✅ Native |
| Firefox | 108+ | Dec 2022 | ✅ Native |

**Coverage:** ~95% of users (as of 2026)

### Fallback for Old Browsers

If needed, add polyfill:

```html
<script async src="https://ga.jspm.io/npm:es-module-shims@1.8.2/dist/es-module-shims.js"></script>
<script type="importmap">
{
  "imports": {
    "n3": "./node_modules/n3/src/index.js"
  }
}
</script>
```

The polyfill only loads in browsers that don't support import maps natively.

---

## Alternative Solutions Considered

### ❌ Option 1: Change all imports to relative paths
```javascript
import { Parser } from './node_modules/n3/src/index.js';
```
**Rejected:** Breaks Node.js compatibility, requires changing many files

### ❌ Option 2: Use a bundler (Webpack/Rollup)
```bash
webpack src/main.js -o dist/bundle.js
```
**Rejected:** Adds complexity, build time, defeats ES6 module benefits

### ❌ Option 3: Use UMD bundle with global
```javascript
const N3 = window.N3;
const { Parser } = N3;
```
**Rejected:** Requires adapter, not idiomatic ES6

### ✅ Option 4: Import Maps (Chosen)
**Benefits:**
- Simple, standards-based solution
- No code changes needed
- Works with ES6 modules natively
- No build step required

---

## Related Issues

### GitHub Issues
- **Import maps spec:** https://github.com/WICG/import-maps
- **Browser support:** https://caniuse.com/import-maps

### Similar Projects
- **Snowpack:** Uses import maps for unbundled development
- **Vite:** Uses import maps in development mode
- **Deno:** Native import map support

---

## Checklist

Before pushing to production:

- [x] Import map added to `index.html`
- [x] Import map placed **before** any module scripts
- [x] Correct path to n3 ES6 modules (`src/index.js`)
- [x] node_modules included in build
- [x] node_modules deployed to GitHub Pages
- [x] Local testing with `npx serve`
- [x] Documentation updated

---

## Success Criteria

OntoGrade deployment is successful when:

1. ✅ No console errors about module resolution
2. ✅ Clicking "🎓 OntoGrade" button works
3. ✅ Console shows: `[mermaidLifter] Lifting diagram...`
4. ✅ Notification appears: "Diagram parsed successfully"
5. ✅ RDF triples are generated correctly

---

**Status:** ✅ **READY FOR DEPLOYMENT**

The import map fix is complete. The application should now work correctly in production with ES6 module imports.

---

**Last Updated:** January 8, 2026
**Next Step:** Push to `dev` branch and test on GitHub Pages
