import { describe, test, assert, beforeEach } from '../test-utils.js';
import { diagramConcept } from '../../src/concepts/diagramConcept.js';

describe('Diagram Concept', () => {

  beforeEach(() => {
    // Reset state before each test
    diagramConcept.state.diagrams = [];
    diagramConcept.state.activeDiagram = null;
    // Clear subscribers
    const subscribers = diagramConcept.subscribe(() => {});
    if (subscribers) subscribers.clear();
  });

  test('should have a default state', () => {
    assert.deepStrictEqual(diagramConcept.state.diagrams, [], 'diagrams should be an empty array');
    assert.strictEqual(diagramConcept.state.activeDiagram, null, 'activeDiagram should be null');
  });

  test("actions.setDiagrams() should update the diagrams array and notify", () => {
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    const newDiagrams = [{ id: 1, name: 'Diagram 1' }];
    diagramConcept.actions.setDiagrams(newDiagrams);

    assert.strictEqual(diagramConcept.state.diagrams, newDiagrams, 'State should be updated with new diagrams');

    const notification = received.find(r => r.event === 'diagramsLoaded');
    assert.ok(notification, 'Should have emitted a diagramsLoaded event');
    assert.strictEqual(notification.payload, newDiagrams, 'Payload should be the new diagrams array');
  });

  test("actions.loadDiagramContent() should emit a 'diagramContentLoadRequested' event", () => {
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    const diagramId = 'diag-123';
    diagramConcept.actions.loadDiagramContent({ diagramId });

    assert.strictEqual(received.length, 1, 'Should have emitted one event');
    assert.strictEqual(received[0].event, 'diagramContentLoadRequested', 'Should emit diagramContentLoadRequested event');
    assert.strictEqual(received[0].payload.diagramId, diagramId, 'Payload should be the diagram ID');
  });

  test("actions.setActiveDiagram() should update activeDiagram and notify", () => {
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    const diagram = { id: 'diag-123', name: 'Loaded Diagram', content: 'graph TD' };
    diagramConcept.actions.setActiveDiagram(diagram);

    assert.strictEqual(diagramConcept.state.activeDiagram, diagram, 'State should be updated with the loaded diagram');

    const notification = received.find(r => r.event === 'activeDiagramSet');
    assert.ok(notification, 'Should have emitted an activeDiagramSet event');
    assert.strictEqual(notification.payload, diagram, 'Payload should be the loaded diagram');
  });

  test("actions.updateActiveDiagramContent() should update content on the activeDiagram state", () => {
    // First, set a diagram in state
    const initialDiagram = { id: 'diag-123', name: 'My Diagram', content: 'graph TD' };
    diagramConcept.actions.setActiveDiagram(initialDiagram);

    const newContent = 'graph LR; A-->B;';
    diagramConcept.actions.updateActiveDiagramContent(newContent);

    assert.strictEqual(diagramConcept.state.activeDiagram.content, newContent, 'Diagram content should be updated');
  });

  test("actions.saveActiveDiagram() should emit a 'diagramSaveRequested' event for an existing diagram", () => {
    const received = [];
    diagramConcept.subscribe((event, payload) => received.push({ event, payload }));

    // Set an existing diagram (it has an ID)
    const existingDiagram = { id: 'diag-456', name: 'Existing', content: 'A-->B' };
    diagramConcept.actions.setActiveDiagram(existingDiagram);

    // Now trigger the save
    diagramConcept.actions.saveActiveDiagram();

    const notification = received.find(r => r.event === 'diagramSaveRequested');
    assert.ok(notification, "Should have emitted a 'diagramSaveRequested' event");
    assert.strictEqual(notification.payload.diagram, existingDiagram, 'Payload should be the current diagram data');
  });
});