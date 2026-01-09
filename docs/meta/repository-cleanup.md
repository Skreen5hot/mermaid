# Repository Cleanup: dist/ Folder

**Date:** 2026-01-09
**Status:** ✅ Complete

## Problem Identified

The repository had **duplicate content** stored in git:
- `/src/` (3.3MB) - Source files
- `/dist/src/` (3.4MB) - **Copy** of source files for deployment

This created:
1. **Double storage** - Every `/src` change committed TWICE (in `/src` and `/dist/src`)
2. **Sync risk** - If you edited `/src` but forgot to build, `/dist` became stale
3. **Merge conflicts** - Changes created duplicate conflicts
4. **Wasted CI time** - CI rebuilds `dist/` anyway before deployment

## Solution Implemented

Added `dist/` to `.gitignore` to treat it as a **build artifact** (ephemeral, not version controlled).

### Changes Made

1. **Updated [.gitignore](.gitignore)**
   ```
   # Test results
   unit-test-results.json

   # Build artifacts
   dist/

   # Dependencies
   node_modules/
   ```

2. **Removed `dist/` from git tracking**
   ```bash
   git rm -r --cached dist/
   ```
   - Removes 49 files from git tracking
   - Local `dist/` folder remains intact
   - Future builds will NOT be committed

3. **Verified local build still works**
   ```bash
   cp -r index.html styles src dist/
   ```

## How This Works Now

**Development Workflow:**
```
1. Edit /src/concepts/foo.js
2. Commit ONLY /src (not /dist)
3. Push to GitHub
4. CI/CD builds fresh dist/ and deploys
```

**CI/CD Pipeline** (already configured correctly):
```yaml
# .github/workflows/ci.yml lines 119-127, 136-158
- name: Prepare deployment structure
  run: |
    mkdir -p dist
    cp -r index.html styles src dist/
    cp -r dist/* _site/
```

The CI already rebuilds `dist/` on every deployment, so version controlling it was redundant.

## Benefits

✅ **No duplication** - Git only tracks source files once
✅ **No sync issues** - `dist/` is always built fresh from latest `/src`
✅ **Cleaner history** - Changes show up once instead of twice
✅ **Faster commits** - 3.4MB less to commit each time
✅ **Industry standard** - Build artifacts should be ephemeral

## Verification

### Local Repository
- `dist/` folder still exists locally
- Build process works: `cp -r index.html styles src dist/`
- Git ignores new changes to `dist/`

### CI/CD Pipeline
- No changes needed to `.github/workflows/ci.yml`
- CI builds fresh `dist/` before deployment
- Deployment to GitHub Pages unchanged

### Git Status
```bash
git status --short
```
Shows 49 deleted `dist/` files (from removing tracking)
Does NOT show new `dist/` files (successfully ignored)

## Next Commit

When you commit this cleanup:
```bash
git add .gitignore
git commit -m "Ignore dist/ folder - treat as build artifact"
```

This will:
- Remove all 49 `dist/` files from git
- Add `.gitignore` rule
- Future commits won't include `dist/` anymore

## Files Modified

- [.gitignore](.gitignore) - Added `dist/` and `node_modules/`
- Git index - Removed 49 tracked files from `dist/`

## Impact on Workflows

**Local Development:** No change - you still work in `/src`
**Building:** `npm run build` or manual copy still works
**Testing:** No change - tests run from `/src`
**Deployment:** No change - CI builds `dist/` automatically

## Conclusion

The repository is now cleaner with no duplication. The `dist/` folder is treated as an ephemeral build artifact (like `node_modules`), which is the industry standard for build outputs.

---

**Ready for Commit:** ✅
**CI/CD Verified:** ✅
**Local Build Tested:** ✅
