import { diagramConcept } from '../../src/concepts/diagramConcept.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

describe('Diagram Concept', () => {
  it('should initialize with a default state', () => {
    diagramConcept.reset();
    const state = diagramConcept.getState();

    assert.ok(Array.isArray(state.diagrams), 'diagrams should be an array');
    assert.strictEqual(state.diagrams.length, 0, 'diagrams should be empty');
    assert.strictEqual(state.currentDiagram, null, 'currentDiagram should be null');
  });

  it("listen('setDiagrams') should update the diagrams array and notify", () => {
    diagramConcept.reset();
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    const newDiagrams = [{ id: 1, name: 'Diagram 1' }];
    diagramConcept.listen('setDiagrams', { diagrams: newDiagrams });

    const state = diagramConcept.getState();
    assert.strictEqual(state.diagrams, newDiagrams, 'State should be updated with new diagrams');

    const notification = received.find(r => r.event === 'diagramsUpdated');
    assert.ok(notification, 'Should have emitted a diagramsUpdated event');
    assert.strictEqual(notification.payload.diagrams, newDiagrams, 'Payload should be the new diagrams array');
  });

  it("listen('setCurrentDiagram') should emit a 'do:loadDiagram' event", () => {
    diagramConcept.reset();
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    const diagramId = 'diag-123';
    diagramConcept.listen('setCurrentDiagram', { diagramId });

    assert.strictEqual(received.length, 1, 'Should have emitted one event');
    assert.strictEqual(received[0].event, 'do:loadDiagram', 'Should emit do:loadDiagram event');
    assert.strictEqual(received[0].payload.diagramId, diagramId, 'Payload should be the diagram ID');
  });

  it("listen('handleDiagramLoaded') should update currentDiagram and notify", () => {
    diagramConcept.reset();
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    const diagram = { id: 'diag-123', name: 'Loaded Diagram', content: 'graph TD' };
    diagramConcept.listen('handleDiagramLoaded', diagram);

    const state = diagramConcept.getState();
    // currentDiagram is now augmented with isDirty: false; compare fields.
    assert.strictEqual(state.currentDiagram.id, 'diag-123');
    assert.strictEqual(state.currentDiagram.name, 'Loaded Diagram');
    assert.strictEqual(state.currentDiagram.content, 'graph TD');
    assert.strictEqual(state.currentDiagram.isDirty, false, 'fresh load is not dirty');

    const notification = received.find(r => r.event === 'diagramContentLoaded');
    assert.ok(notification, 'Should have emitted a diagramContentLoaded event');
    assert.strictEqual(notification.payload.diagram.id, 'diag-123');
    assert.strictEqual(notification.payload.diagram.content, 'graph TD');
  });

  it("listen('updateCurrentDiagramContent') should update content on the currentDiagram state", () => {
    diagramConcept.reset();
    // First, set a diagram in state
    const initialDiagram = { id: 'diag-123', name: 'My Diagram', content: 'graph TD' };
    diagramConcept.listen('handleDiagramLoaded', initialDiagram);

    const newContent = 'graph LR; A-->B;';
    diagramConcept.listen('updateCurrentDiagramContent', { content: newContent });

    const state = diagramConcept.getState();
    assert.strictEqual(state.currentDiagram.content, newContent, 'Diagram content should be updated');
  });

  it("listen('saveCurrentDiagram') should emit a 'do:saveDiagram' event for an existing diagram", () => {
    diagramConcept.reset();
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    const existingDiagram = { id: 'diag-456', name: 'Existing', content: 'A-->B' };
    diagramConcept.listen('handleDiagramLoaded', existingDiagram);

    diagramConcept.listen('saveCurrentDiagram');

    const notification = received.find(r => r.event === 'do:saveDiagram');
    assert.ok(notification, "Should have emitted a 'do:saveDiagram' event");
    assert.strictEqual(notification.payload.diagramData.id, 'diag-456');
    assert.strictEqual(notification.payload.diagramData.name, 'Existing');
    assert.strictEqual(notification.payload.diagramData.content, 'A-->B');
  });

  // --- Autosave tests ---

  describe('Autosave', () => {
    function fakeLocalStorage() {
      const store = new Map();
      global.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, String(v)); },
        removeItem: (k) => { store.delete(k); },
      };
      return store;
    }

    it('setAutoSave persists the choice to localStorage and updates state', () => {
      const store = fakeLocalStorage();
      diagramConcept.reset();

      diagramConcept.listen('setAutoSave', { enabled: true });
      assert.strictEqual(diagramConcept.getState().autoSaveEnabled, true);
      assert.strictEqual(store.get('mermaidide.autoSave'), '1');

      diagramConcept.listen('setAutoSave', { enabled: false });
      assert.strictEqual(diagramConcept.getState().autoSaveEnabled, false);
      assert.strictEqual(store.get('mermaidide.autoSave'), '0');
    });

    it('editing a saved diagram with autosave enabled schedules a timer', () => {
      fakeLocalStorage();
      diagramConcept.reset();
      diagramConcept.listen('setAutoSave', { enabled: true });
      diagramConcept.listen('handleDiagramLoaded', { id: 'd1', name: 'a', content: 'old' });

      assert.strictEqual(diagramConcept._test.isAutoSaveTimerPending(), false, 'no timer before edit');
      diagramConcept.listen('updateCurrentDiagramContent', { content: 'new' });
      assert.strictEqual(diagramConcept._test.isAutoSaveTimerPending(), true, 'timer scheduled after edit');
      assert.strictEqual(diagramConcept.getState().currentDiagram.isDirty, true);
    });

    it('autosave timer fires do:saveDiagram', () => {
      fakeLocalStorage();
      diagramConcept.reset();
      const received = [];
      diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

      diagramConcept.listen('setAutoSave', { enabled: true });
      diagramConcept.listen('handleDiagramLoaded', { id: 'd1', name: 'a', content: 'old' });
      diagramConcept.listen('updateCurrentDiagramContent', { content: 'new' });

      diagramConcept._test.fireAutoSaveTimerNow();

      const save = received.find((r) => r.event === 'do:saveDiagram');
      assert.ok(save, 'autosave should emit do:saveDiagram');
      assert.strictEqual(save.payload.diagramData.content, 'new');
    });

    it('disabling autosave cancels a pending timer', () => {
      fakeLocalStorage();
      diagramConcept.reset();
      diagramConcept.listen('setAutoSave', { enabled: true });
      diagramConcept.listen('handleDiagramLoaded', { id: 'd1', name: 'a', content: 'old' });
      diagramConcept.listen('updateCurrentDiagramContent', { content: 'new' });
      assert.strictEqual(diagramConcept._test.isAutoSaveTimerPending(), true);

      diagramConcept.listen('setAutoSave', { enabled: false });
      assert.strictEqual(diagramConcept._test.isAutoSaveTimerPending(), false);
    });

    it('unsaved diagram (id=null) does NOT schedule autosave on edit', () => {
      fakeLocalStorage();
      diagramConcept.reset();
      diagramConcept.listen('setAutoSave', { enabled: true });
      diagramConcept.listen('initializeUnsavedDiagram', { content: 'scratch' });
      diagramConcept.listen('updateCurrentDiagramContent', { content: 'more scratch' });
      assert.strictEqual(diagramConcept._test.isAutoSaveTimerPending(), false);
    });

    it('switching diagrams (handleDiagramLoaded) cancels a pending timer', () => {
      fakeLocalStorage();
      diagramConcept.reset();
      diagramConcept.listen('setAutoSave', { enabled: true });
      diagramConcept.listen('handleDiagramLoaded', { id: 'd1', name: 'a', content: 'old' });
      diagramConcept.listen('updateCurrentDiagramContent', { content: 'new' });
      assert.strictEqual(diagramConcept._test.isAutoSaveTimerPending(), true);

      diagramConcept.listen('handleDiagramLoaded', { id: 'd2', name: 'b', content: 'other' });
      assert.strictEqual(diagramConcept._test.isAutoSaveTimerPending(), false);
      assert.strictEqual(diagramConcept.getState().currentDiagram.isDirty, false);
    });

    it('handleDiagramSaved of the current diagram clears isDirty and preserves in-flight typing', () => {
      fakeLocalStorage();
      diagramConcept.reset();
      diagramConcept.listen('setAutoSave', { enabled: true });
      diagramConcept.listen('handleDiagramLoaded', { id: 'd1', name: 'a', content: 'old' });

      // Simulate: user types "new" (state.content becomes "new"). Autosave
      // fires (sends diagramData with "new"). Meanwhile the user keeps typing
      // — "newer". When handleDiagramSaved arrives, the user's "newer" is
      // already in memory and must not be overwritten.
      diagramConcept.listen('updateCurrentDiagramContent', { content: 'new' });
      diagramConcept.listen('updateCurrentDiagramContent', { content: 'newer' });
      diagramConcept.listen('handleDiagramSaved', { id: 'd1', name: 'a', content: 'new', dateModified: 't' });

      const state = diagramConcept.getState();
      assert.strictEqual(state.currentDiagram.content, 'newer', 'in-flight typing preserved');
      assert.strictEqual(state.currentDiagram.isDirty, true, 'still dirty because content differs from saved');
    });

    it('handleDiagramSaved of a brand-new diagram with becomeCurrent:true replaces current', () => {
      fakeLocalStorage();
      diagramConcept.reset();
      diagramConcept.listen('handleDiagramLoaded', { id: 'd1', name: 'a', content: 'old' });
      // New-diagram-creation flow tags the save with becomeCurrent:true.
      diagramConcept.listen('handleDiagramSaved', { id: 'd2', name: 'b', content: 'fresh', dateModified: 't', becomeCurrent: true });

      const state = diagramConcept.getState();
      assert.strictEqual(state.currentDiagram.id, 'd2', 'new diagram becomes current');
      assert.strictEqual(state.currentDiagram.content, 'fresh');
      assert.strictEqual(state.currentDiagram.isDirty, false);
    });

    it('handleDiagramSaved of a different diagram WITHOUT becomeCurrent leaves current alone', () => {
      // This is the save-on-switch race: user clicked away while the save was
      // in flight. The new selection must not be clobbered by the late save.
      fakeLocalStorage();
      diagramConcept.reset();
      diagramConcept.listen('handleDiagramLoaded', { id: 'd2', name: 'new', content: 'newContent' });

      // Simulate a late save of the previously-open diagram.
      diagramConcept.listen('handleDiagramSaved', { id: 'd1', name: 'old', content: 'oldEdits', dateModified: 't', becomeCurrent: false });

      const state = diagramConcept.getState();
      assert.strictEqual(state.currentDiagram.id, 'd2', 'current selection preserved');
      assert.strictEqual(state.currentDiagram.content, 'newContent');
    });

    it('setCurrentDiagram with a dirty current fires do:saveDiagram (becomeCurrent:false) before do:loadDiagram', () => {
      fakeLocalStorage();
      diagramConcept.reset();
      const received = [];
      diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

      diagramConcept.listen('handleDiagramLoaded', { id: 'd1', name: 'a', content: 'old' });
      diagramConcept.listen('updateCurrentDiagramContent', { content: 'unsaved edits' });
      assert.strictEqual(diagramConcept.getState().currentDiagram.isDirty, true);

      // Pretend the user clicked another diagram in the sidebar.
      diagramConcept.listen('setCurrentDiagram', { diagramId: 'd2' });

      const save = received.find((r) => r.event === 'do:saveDiagram');
      assert.ok(save, 'do:saveDiagram fired before switch');
      assert.strictEqual(save.payload.diagramData.id, 'd1');
      assert.strictEqual(save.payload.diagramData.content, 'unsaved edits');
      assert.strictEqual(save.payload.becomeCurrent, false, 'background save must not steal selection');

      const load = received.find((r) => r.event === 'do:loadDiagram');
      assert.ok(load, 'do:loadDiagram for the new selection');
      assert.strictEqual(load.payload.diagramId, 'd2');
    });

    it('setDiagrams for a different project saves the dirty current and auto-selects the new first', () => {
      fakeLocalStorage();
      diagramConcept.reset();
      const received = [];
      diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

      // Setup: current diagram belongs to project A, dirty with new edits.
      diagramConcept.listen('handleDiagramLoaded', { id: 'A:x', name: 'x', projectId: 'A', content: 'old' });
      diagramConcept.listen('updateCurrentDiagramContent', { content: 'unsaved A edits' });
      assert.strictEqual(diagramConcept.getState().currentDiagram.isDirty, true);

      // Project switch arrives: setDiagrams for project B with two diagrams.
      diagramConcept.listen('setDiagrams', {
        diagrams: [
          { id: 'B:1', name: 'first', projectId: 'B', content: 'b1' },
          { id: 'B:2', name: 'second', projectId: 'B', content: 'b2' },
        ],
        project: { id: 'B', name: 'Project B', mode: 'idb' },
      });

      // Dirty A should be saved with becomeCurrent:false (background save).
      const save = received.find((r) => r.event === 'do:saveDiagram');
      assert.ok(save, 'project switch must save the dirty current first');
      assert.strictEqual(save.payload.diagramData.id, 'A:x');
      assert.strictEqual(save.payload.diagramData.content, 'unsaved A edits');
      assert.strictEqual(save.payload.becomeCurrent, false);

      // Auto-select: first diagram of B should be loaded.
      const load = received.find((r) => r.event === 'do:loadDiagram');
      assert.ok(load, 'auto-select fires for the first diagram of the new project');
      assert.strictEqual(load.payload.diagramId, 'B:1');
    });

    it('setDiagrams for the same project does NOT clobber the current diagram', () => {
      fakeLocalStorage();
      diagramConcept.reset();
      diagramConcept.listen('handleDiagramLoaded', { id: 'A:x', name: 'x', projectId: 'A', content: 'old' });
      diagramConcept.listen('updateCurrentDiagramContent', { content: 'still editing' });

      const received = [];
      diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

      // Re-list diagrams for the SAME project A (e.g. after a save).
      diagramConcept.listen('setDiagrams', {
        diagrams: [{ id: 'A:x', name: 'x', projectId: 'A', content: 'old' }],
        project: { id: 'A', name: 'Project A', mode: 'idb' },
      });

      // No save, no load, no clear — the user is still on their current diagram.
      assert.ok(!received.find((r) => r.event === 'do:saveDiagram'));
      assert.ok(!received.find((r) => r.event === 'do:loadDiagram'));
      assert.strictEqual(diagramConcept.getState().currentDiagram.id, 'A:x');
      assert.strictEqual(diagramConcept.getState().currentDiagram.content, 'still editing');
    });

    it('setCurrentDiagram with a clean current does NOT trigger a save', () => {
      fakeLocalStorage();
      diagramConcept.reset();
      const received = [];
      diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

      diagramConcept.listen('handleDiagramLoaded', { id: 'd1', name: 'a', content: 'old' });
      // No edits — clean.
      diagramConcept.listen('setCurrentDiagram', { diagramId: 'd2' });

      const save = received.find((r) => r.event === 'do:saveDiagram');
      assert.ok(!save, 'no save when current is not dirty');
    });
  });
});