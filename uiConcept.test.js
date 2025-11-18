import { uiConcept } from '../../src/concepts/uiConcept.js';
import assert from '../framework/assert.js';

describe('uiConcept.js', () => {

    beforeEach(() => {
        // To test the UI concept, we need to mock the DOM.
        // We create a simple object that mimics the structure of a real HTML button.
        const mockSaveBtn = { disabled: false };
        const mockDeleteBtn = { disabled: false };
        const mockRenameBtn = { disabled: false };

        // We can't use `document.getElementById` in Node.js, so we'll manually
        // inject these mock elements into the concept for testing purposes.
        // This is a common pattern for testing UI components in isolation.
        uiConcept.setTestElements({
            saveDiagramBtn: mockSaveBtn,
            deleteDiagramBtn: mockDeleteBtn,
            renameDiagramBtn: mockRenameBtn,
        });
    });

    it('should DISABLE buttons when currentDiagram has no ID (initial state)', () => {
        // This simulates the initial "unsaved" diagram state.
        const unsavedDiagram = { id: null, name: '', content: 'graph TD; A-->B;' };

        // Call the action we want to test.
        uiConcept.listen('updateButtonStates', { currentDiagram: unsavedDiagram });

        // Retrieve the mock elements to check their state.
        const { saveDiagramBtn, deleteDiagramBtn } = uiConcept.getTestElements();

        // Assert that the 'disabled' property was set to true.
        assert.strictEqual(saveDiagramBtn.disabled, true, 'Save button should be disabled for new diagrams');
        assert.strictEqual(deleteDiagramBtn.disabled, true, 'Delete button should be disabled for new diagrams');
    });

    it('should ENABLE buttons when currentDiagram has an ID (saved state)', () => {
        // This simulates a diagram that has been loaded from the database.
        const savedDiagram = { id: 123, name: 'My Saved Diagram', content: '...' };

        // Call the action.
        uiConcept.listen('updateButtonStates', { currentDiagram: savedDiagram });

        // Retrieve the mock elements.
        const { saveDiagramBtn, deleteDiagramBtn } = uiConcept.getTestElements();

        // Assert that the 'disabled' property was set to false.
        assert.strictEqual(saveDiagramBtn.disabled, false, 'Save button should be enabled for saved diagrams');
        assert.strictEqual(deleteDiagramBtn.disabled, false, 'Delete button should be enabled for saved diagrams');
    });

});