# Expected Console Output for OntoGrade Button Click

**Date:** January 8, 2026
**Purpose:** Document the complete expected console output when clicking "🎓 OntoGrade"

---

## Complete Flow

When a user clicks the "🎓 OntoGrade" button with an active diagram loaded:

### 1. UI Event Handler
**Source:** [uiConcept.js:476](../src/concepts/uiConcept.js#L476)
```
[UI] OntoGrade button clicked
```

### 2. Synchronization Triggered
**Source:** [synchronizations.js:1001](../src/synchronizations.js#L1001)
```
[Sync] OntoGrade evaluation requested
```

### 3. Mermaid Lifter Action
**Source:** [mermaidLifter.js:38](../src/concepts/ontograde/mermaidLifter.js#L38)
```
[mermaidLifter] Lifting diagram {diagramId}...
```

### 4. Successful Lifting (Synchronization)
**Source:** [synchronizations.js:1051-1052](../src/synchronizations.js#L1051-L1052)
```
[Sync] Diagram lifted successfully: {diagramId}
[Sync] RDF Graph size: {count} triples
```

### 5. User Notification
**Visual:** Green notification banner
```
OntoGrade: Diagram parsed successfully. Found {count} RDF triples.
```

---

## Example Output

For `person_pass.mmd` (diagram ID: 5, 34 triples):

```
[UI] OntoGrade button clicked
[Sync] OntoGrade evaluation requested
[mermaidLifter] Lifting diagram 5...
[Sync] Diagram lifted successfully: 5
[Sync] RDF Graph size: 34 triples
```

**Notification:**
```
✅ OntoGrade: Diagram parsed successfully. Found 34 RDF triples.
```

---

## Error Scenarios

### Scenario 1: No Active Diagram

**Output:**
```
[UI] OntoGrade button clicked
[Sync] OntoGrade evaluation requested
```

**Notification:**
```
❌ No active diagram to evaluate. Please select a diagram first.
```

### Scenario 2: Parse Error

**Output:**
```
[UI] OntoGrade button clicked
[Sync] OntoGrade evaluation requested
[mermaidLifter] Lifting diagram 5...
[mermaidLifter] Lifting failed: Error: No valid nodes or edges found in Mermaid diagram
[Sync] Mermaid lifting failed: {error object}
```

**Notification:**
```
❌ OntoGrade Error: Invalid Mermaid syntax. Please check your diagram structure.
```

### Scenario 3: Large Graph Warning

For diagrams with >100 nodes:

**Output:**
```
[UI] OntoGrade button clicked
[Sync] OntoGrade evaluation requested
[mermaidLifter] Lifting diagram 5...
[Sync] Large diagram detected: 150 nodes
[Sync] Diagram lifted successfully: 5
[Sync] RDF Graph size: 450 triples
```

**Notifications:**
```
ℹ️ Large diagram detected (150 nodes). Evaluation may take longer.
✅ OntoGrade: Diagram parsed successfully. Found 450 RDF triples.
```

---

## Verification Checklist

To verify OntoGrade is working correctly:

- [ ] Open browser DevTools Console (F12)
- [ ] Clear console
- [ ] Load a diagram (e.g., person_pass.mmd)
- [ ] Click "🎓 OntoGrade" button
- [ ] Verify ALL 5 console logs appear in order
- [ ] Verify green notification appears
- [ ] Verify notification shows correct triple count

---

## Debugging Missing Logs

If you see only:
```
[mermaidLifter] Lifting diagram 5...
[Sync] Diagram lifted successfully: 5
[Sync] RDF Graph size: 34 triples
```

**Missing logs:**
- `[UI] OntoGrade button clicked`
- `[Sync] OntoGrade evaluation requested`

### Possible Causes:

1. **Console Filter Active**
   - Check DevTools filter settings
   - Ensure "All levels" is selected
   - Clear any search/filter text

2. **Code Not Deployed**
   - The deployed version might be outdated
   - Check latest commit is deployed to GitHub Pages
   - Clear browser cache (Ctrl+Shift+R)

3. **Logs Scrolled Out of View**
   - Console may auto-scroll and hide earlier logs
   - Click "Preserve log" in DevTools
   - Scroll up to see earlier entries

4. **Event Emission Timing**
   - Logs might appear so quickly they're batched
   - Use "Timestamps" option in DevTools

---

## Testing Locally vs Deployed

### Local Testing (npx serve)
```bash
npx serve
# Open http://localhost:3000
# Open DevTools Console
# Load person_pass.mmd
# Click OntoGrade
```

**Expected:** All 5 logs appear

### Deployed Testing (GitHub Pages)
```
https://skreen5hot.github.io/mermaid/dev/
# Open DevTools Console
# Load person_pass.mmd
# Click OntoGrade
```

**Expected:** Same as local

---

## Code References

| Log Statement | File | Line |
|--------------|------|------|
| `[UI] OntoGrade button clicked` | [uiConcept.js](../src/concepts/uiConcept.js) | 476 |
| `[Sync] OntoGrade evaluation requested` | [synchronizations.js](../src/synchronizations.js) | 1001 |
| `[mermaidLifter] Lifting diagram...` | [mermaidLifter.js](../src/concepts/ontograde/mermaidLifter.js) | 38 |
| `[Sync] Diagram lifted successfully...` | [synchronizations.js](../src/synchronizations.js) | 1051 |
| `[Sync] RDF Graph size...` | [synchronizations.js](../src/synchronizations.js) | 1052 |

---

## Next Steps

Once console output is verified:

1. **Confirm all 5 logs appear** ✅
2. **Test with person_pass.mmd** (expect 34 triples) ✅
3. **Test with person_fail.mmd** (expect 30 triples) ✅
4. **Test error handling** (empty diagram, invalid syntax) ✅
5. **Ready for Iteration 2** 🎯

---

**Status:** Documentation Complete
**Last Updated:** January 8, 2026
