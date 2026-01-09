# Repository Reorganization Plan

**Date:** 2026-01-09
**Purpose:** Clean up root directory clutter and organize documentation for better discoverability

## Current Problems

### Root Directory is Cluttered
```
Root contains:
- 10 test files (test-*.js)
- 13 documentation files (*.md)
- 2 build scripts (build.js, run-tests.js, parse-edges.js)
- Multiple organizational directories (docs/, OntoGrade/, tests/, unit-tests/)
```

**Issues:**
1. **Test files scattered** - Some in root, some in `/tests`, some in `/unit-tests`
2. **Documentation fragmented** - Some in root, 17 files in `/OntoGrade`, empty `/docs`
3. **Hard for Claude to find** - Documentation spread across multiple locations
4. **Unclear purpose** - Which tests are examples vs. CI tests vs. development tests?

---

## Proposed Structure

### Goal: Clear, Organized, Discoverable

```
mermaid/
├── docs/                          # ALL documentation (Claude looks here first)
│   ├── README.md                  # Main project documentation
│   ├── development/               # Development guides
│   │   ├── agentic-development.md
│   │   ├── data-architecture-refactor.md
│   │   ├── security-justification.md
│   │   ├── security-strategy.md
│   │   ├── test-strategy.md
│   │   └── ui-testing-framework.md
│   ├── git/                       # Git-specific docs
│   │   └── git-workflow.md
│   ├── ontograde/                 # OntoGrade feature docs
│   │   ├── README.md              # OntoGrade overview
│   │   ├── project-plan.md
│   │   ├── functional-requirements.md
│   │   ├── development-guide.md
│   │   ├── iteration-1-complete.md
│   │   ├── iteration-2-complete.md
│   │   ├── iteration-2-summary.md
│   │   ├── iteration-3-complete.md
│   │   ├── iteration-4-complete.md
│   │   ├── iteration-5-complete.md
│   │   ├── iteration-5-summary.md
│   │   ├── cdn-solution.md
│   │   ├── ci-cd-updates.md
│   │   ├── deployment-fix.md
│   │   ├── expected-console-output.md
│   │   ├── final-status.md
│   │   └── testing-guide.md
│   └── meta/                      # Repository maintenance docs
│       ├── repository-cleanup.md
│       └── repository-reorganization.md (this file)
│
├── tests/                         # Unit tests (automated via npm test)
│   ├── concepts/
│   ├── utils/
│   └── run-tests.js              # Test runner
│
├── examples/                      # Example tests & demonstrations
│   ├── ontograde/                # OntoGrade validation examples
│   │   ├── test-all-violations.js
│   │   ├── test-bfo-violations.js
│   │   ├── test-pattern-violations.js
│   │   ├── test-logic-violations.js
│   │   └── test-perfect-score.js
│   └── diagrams/                 # Example Mermaid diagrams
│       ├── perfect-score.mmd
│       ├── bfo-violations.mmd
│       ├── pattern-violations.mmd
│       └── logic-violations.mmd
│
├── scripts/                       # Build and utility scripts
│   ├── build.js
│   └── parse-edges.js
│
├── src/                          # Application source code
├── styles/                       # CSS files
├── .github/                      # CI/CD workflows
├── .claude/                      # Claude Code settings
├── .husky/                       # Git hooks
├── index.html                    # Main entry point
├── package.json                  # Dependencies & scripts
└── README.md                     # Top-level project readme
```

---

## File Mapping

### Move Test Files: Root → examples/ontograde/

**Current (Root):**
```
test-all-violations.js
test-full-logic.js
test-iteration4.js
test-iteration5-modal.js
test-logic-fresh.js
test-logic-manual.js
test-logic-violations.js
test-patterns-fresh.js
test-patterns-quick.js
```

**New Location:**
```
examples/ontograde/test-all-violations.js
examples/ontograde/test-bfo-violations.js         (renamed from test-iteration4.js)
examples/ontograde/test-pattern-violations.js     (renamed from test-patterns-fresh.js)
examples/ontograde/test-logic-violations.js       (keep)
examples/ontograde/test-perfect-score.js          (renamed from test-iteration5-modal.js)
```

**Delete Duplicates:**
- `test-full-logic.js` (duplicate of test-logic-violations.js)
- `test-logic-fresh.js` (old version)
- `test-logic-manual.js` (old version)
- `test-patterns-quick.js` (old version)

---

### Move Documentation: Root → docs/

**Current (Root):**
```
agenticDevlopment.md → docs/development/agentic-development.md
DataArchitectRefactor.md → docs/development/data-architecture-refactor.md
GITREADME.md → docs/git/git-workflow.md
ITERATION5-COMPLETE.md → docs/ontograde/iteration-5-complete.md
ITERATION5-SUMMARY.md → docs/ontograde/iteration-5-summary.md
Mermaid IDB Devlpment Plan.md → docs/development/idb-development-plan.md
README.md → README.md (stays in root)
REPOSITORY-CLEANUP.md → docs/meta/repository-cleanup.md
securityJustification.md → docs/development/security-justification.md
securityStratagy.md → docs/development/security-strategy.md
test-plan.md → docs/ontograde/test-plan.md
testStrategy.md → docs/development/test-strategy.md
uiTestingFramework.md → docs/development/ui-testing-framework.md
```

**Current (OntoGrade/):**
Move ALL 17 files to `docs/ontograde/`:
```
OntoGrade/CDN-SOLUTION.md → docs/ontograde/cdn-solution.md
OntoGrade/CI-CD-UPDATES.md → docs/ontograde/ci-cd-updates.md
OntoGrade/DEPLOYMENT-FIX.md → docs/ontograde/deployment-fix.md
OntoGrade/developmentGuide.md → docs/ontograde/development-guide.md
OntoGrade/EXPECTED-CONSOLE-OUTPUT.md → docs/ontograde/expected-console-output.md
OntoGrade/FINAL-STATUS.md → docs/ontograde/final-status.md
OntoGrade/functionalRequirements.md → docs/ontograde/functional-requirements.md
OntoGrade/ITERATION1-COMPLETE.md → docs/ontograde/iteration-1-complete.md
OntoGrade/ITERATION2-COMPLETE.md → docs/ontograde/iteration-2-complete.md
OntoGrade/ITERATION2-SUMMARY.md → docs/ontograde/iteration-2-summary.md
OntoGrade/ITERATION3-COMPLETE.md → docs/ontograde/iteration-3-complete.md
OntoGrade/ITERATION3-SUMMARY.md → docs/ontograde/iteration-3-summary.md
OntoGrade/ITERATION4-COMPLETE.md → docs/ontograde/iteration-4-complete.md
OntoGrade/ITERATION4-SUMMARY.md → docs/ontograde/iteration-4-summary.md
OntoGrade/OntoGradeProjectPlan.md → docs/ontograde/project-plan.md
OntoGrade/README.md → docs/ontograde/README.md
OntoGrade/testingGuide.md → docs/ontograde/testing-guide.md
```

---

### Move Build Scripts: Root → scripts/

**Current (Root):**
```
build.js → scripts/build.js
parse-edges.js → scripts/parse-edges.js
run-tests.js → tests/run-tests.js (test-specific)
```

**Update package.json scripts:**
```json
{
  "scripts": {
    "build": "node scripts/build.js",
    "test": "node tests/run-tests.js"
  }
}
```

---

### Move Test Diagrams: Root → examples/diagrams/

**Current (Root via dist):**
```
Test Violations.mmd → examples/diagrams/bfo-violations.mmd
Test Pattern Violations.mmd → examples/diagrams/pattern-violations.mmd
Test Logic Violations.mmd → examples/diagrams/logic-violations.mmd
CCO example.mmd → examples/diagrams/perfect-score.mmd
```

---

### Update .gitignore

Keep ignoring:
```
dist/
node_modules/
unit-test-results.json
```

---

### Clean Up Empty/Redundant Directories

**Delete:**
- `OntoGrade/` (moved to docs/ontograde/)
- `gitDataPOC/` (if no longer needed - check first)
- `shared-test-utils/` (if empty or redundant)
- `ui-test-framework/` (if empty or redundant)
- `-p/` (looks like accidental folder)

**Keep:**
- `tests/` (unit tests)
- `unit-tests/` (might be duplicate of tests/ - need to check)

---

## Benefits for Claude

### Before (Current State):
```
Claude needs to check:
- /README.md
- /OntoGrade/*.md (17 files)
- /docs/ (empty)
- Root *.md (13 files)
- Scattered test files for examples
```

**Problems:**
- Fragmented documentation
- No clear hierarchy
- Hard to find specific topics
- Test files mixed with docs

### After (Proposed State):
```
Claude checks:
- /README.md (project overview)
- /docs/ontograde/README.md (OntoGrade overview)
- /docs/ontograde/*.md (all OntoGrade docs in one place)
- /docs/development/*.md (development guides)
- /examples/ontograde/*.js (working examples)
```

**Benefits:**
✅ **Single source of truth** - All docs in `/docs`
✅ **Clear hierarchy** - Organized by topic (ontograde, development, git, meta)
✅ **Easy discovery** - Claude can glob `/docs/**/*.md`
✅ **Contextual grouping** - Related docs together
✅ **Examples separate** - Test files clearly marked as examples

---

## Implementation Steps

### Phase 1: Create New Structure
1. Create directories:
   ```bash
   mkdir -p docs/development
   mkdir -p docs/git
   mkdir -p docs/ontograde
   mkdir -p docs/meta
   mkdir -p examples/ontograde
   mkdir -p examples/diagrams
   mkdir -p scripts
   ```

### Phase 2: Move Files
2. Move test files to examples/
3. Move documentation to docs/
4. Move build scripts to scripts/
5. Move test diagrams to examples/diagrams/

### Phase 3: Update References
6. Update package.json scripts
7. Update CI/CD workflows if needed
8. Update README.md with new structure
9. Create docs/ontograde/README.md as entry point

### Phase 4: Clean Up
10. Delete duplicate test files
11. Delete empty directories
12. Run tests to verify nothing broke

### Phase 5: Commit
13. Commit with descriptive message

---

## Risk Assessment

**Low Risk:**
- Moving documentation (no code dependencies)
- Moving example tests (not in CI/CD)
- Creating new directories

**Medium Risk:**
- Moving build.js (referenced in package.json)
- Moving test diagrams (referenced by test files)

**Mitigation:**
- Update package.json scripts
- Update test file paths
- Test locally before committing

---

## Verification Checklist

After reorganization:
- [ ] `npm run build` works
- [ ] `npm test` works
- [ ] `npm run test:ontograde` works
- [ ] CI/CD pipeline passes
- [ ] Documentation is discoverable
- [ ] Examples run successfully
- [ ] No broken links in docs

---

## Next Steps

**Option 1: Full Reorganization (Recommended)**
- Implement all phases above
- Clean, organized repository
- Better for long-term maintenance

**Option 2: Incremental Approach**
- Phase 1: Move documentation only
- Phase 2: Move tests later
- Phase 3: Move scripts last
- Less disruptive but takes longer

**Option 3: Minimal Cleanup**
- Just move docs to docs/ontograde/
- Keep everything else as-is
- Quick win but doesn't solve root clutter

---

## Recommendation

**I recommend Option 1 (Full Reorganization)** because:

1. **One-time effort** - Get it right now, maintain easily forever
2. **Clear structure** - Everyone (including Claude) knows where to find things
3. **Industry standard** - Follows common repository organization patterns
4. **Low risk** - Changes are mostly file moves, not code changes
5. **Easy rollback** - Git history preserves everything if needed

The proposed structure makes it crystal clear:
- `/src` = production code
- `/tests` = automated unit tests
- `/examples` = demonstration code
- `/docs` = all documentation
- `/scripts` = build/utility scripts

This is the standard layout for modern projects and makes the repository much more maintainable.

---

**Ready to proceed?** I can execute this reorganization if you approve.
