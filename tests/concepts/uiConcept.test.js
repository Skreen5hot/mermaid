import { uiConcept } from '../../src/concepts/uiConcept.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';
import { installDomMock } from '../shared-test-utils/dom-mock.js';

// --- Mocks for Browser Environment ---

let mockElements = {};

function setupMockDOM() {
    const ids = [
        'code-tab', 'diagram-tab', 'code-view', 'diagram-view', 'code-editor',
        'diagram-container', 'file-info', 'split-view-btn', 'project-sidebar', 'project-selector', 'diagram-list', 'theme-toggle',
        'new-project-btn', 'delete-project-btn', 'new-btn', 'save-btn', 'fullscreen-btn',
        'delete-btn', 'rename-btn', 'new-modal', 'new-name', 'new-cancel-btn',
        'new-create-btn', 'upload-diagrams-input', 'download-project-btn', 'sidebar-resizer',
        'split-view-resizer', 'content-area',
        'export-mmd-btn', 'render-btn',
    ];
    mockElements = installDomMock(ids);
}

const mockMermaid = {
    parse: () => Promise.resolve(),
    render: () => Promise.resolve({ svg: '<svg>mock</svg>' })
};

// --- Tests ---

describe('UI Concept', () => {

    function beforeEach() {
        setupMockDOM();
        uiConcept.reset();
        uiConcept.setMermaid(mockMermaid);
        uiConcept.listen('initialize');
    }

    it("listen('renderProjectSelector') populates option elements with correct values, names, and selection", () => {
        beforeEach();
        const projects = [{ id: 1, name: 'Project A' }, { id: 2, name: 'Project B' }];
        uiConcept.listen('renderProjectSelector', { projects, currentProjectId: 2 });

        const selector = mockElements['project-selector'];
        assert.strictEqual(selector.children.length, 2, 'two option children');

        const optA = selector.children[0];
        assert.strictEqual(optA.tagName, 'OPTION');
        assert.strictEqual(optA.value, 1);
        assert.strictEqual(optA.textContent, 'Project A');
        assert.strictEqual(optA.selected, false);

        const optB = selector.children[1];
        assert.strictEqual(optB.value, 2);
        assert.strictEqual(optB.textContent, 'Project B');
        assert.strictEqual(optB.selected, true);
    });

    it("listen('renderEditor') should update the editor's value", () => {
        beforeEach();
        const newContent = 'graph TD; A-->B;';
        uiConcept.listen('renderEditor', { content: newContent });

        assert.strictEqual(mockElements['code-editor'].value, newContent, "Editor value should be updated");
    });

    it("listen('toggleSplitView') should toggle the split view state", () => {
        beforeEach();
        
        // Turn on split view
        uiConcept.listen('toggleSplitView');
        let state = uiConcept.getState();
        assert.strictEqual(state.activeView, 'split', 'Active view should be "split"');
        assert.ok(mockElements['content-area'].classList.contains('split-view-active'), 'Content area should have split-view-active class');

        // Turn off split view
        uiConcept.listen('toggleSplitView');
        state = uiConcept.getState();
        assert.strictEqual(state.activeView, 'code', 'Active view should revert to the active tab (code)');
        assert.ok(!mockElements['content-area'].classList.contains('split-view-active'), 'Content area should not have split-view-active class');
    });

    it("should notify 'ui:projectSelected' when the project selector is changed", () => {
        beforeEach();
        const received = [];
        uiConcept.subscribe((event, payload) => received.push({ event, payload }));

        // Simulate user changing the dropdown
        const selector = mockElements['project-selector'];
        selector.value = '3'; // Simulate selecting a project with ID 3
        selector._trigger('change');

        assert.strictEqual(received.length, 1, 'Should have emitted one event');
        assert.strictEqual(received[0].event, 'ui:projectSelected', 'Event name should be correct');
        assert.strictEqual(received[0].payload.projectId, '3', 'Payload should contain the selected project ID');
    });

    it('should handle the new diagram flow via modal', () => {
        beforeEach();
        const received = [];
        uiConcept.subscribe((event, payload) => received.push({ event, payload }));

        const newBtn = mockElements['new-btn'];
        const newModal = mockElements['new-modal'];
        const newNameInput = mockElements['new-name'];
        const createBtn = mockElements['new-create-btn'];

        // 1. User clicks "New" button
        newBtn._trigger('click');
        assert.strictEqual(newModal.style.display, 'flex', 'Modal should be displayed');
        assert.ok(createBtn.disabled, 'Create button should be disabled initially');

        // 2. User types a name
        newNameInput.value = 'My New Diagram';
        newNameInput._trigger('input');
        assert.ok(!createBtn.disabled, 'Create button should be enabled after typing a name');

        // 3. User clicks "Create"
        createBtn._trigger('click');
        assert.strictEqual(newModal.style.display, 'none', 'Modal should be hidden after creation');
        const createEvent = received.find(r => r.event === 'ui:createDiagramClicked');
        assert.ok(createEvent, 'Should have emitted a "ui:createDiagramClicked" event');
        assert.strictEqual(createEvent.payload.name, 'My New Diagram', 'Payload should contain the new diagram name');
    });
});

describe('UI Concept - Split View Tabs', () => {
    function beforeEach() {
        setupMockDOM();
        uiConcept.reset();
        uiConcept.setMermaid(mockMermaid);
        uiConcept.listen('initialize');
    }

    it('should gray out Code and Diagram tabs when Split view is active', () => {
        beforeEach();
        const splitViewBtn = mockElements['split-view-btn'];
        const codeTab = mockElements['code-tab'];
        const diagramTab = mockElements['diagram-tab'];

        splitViewBtn._trigger('click'); // Activate split view
        assert.ok(codeTab.classList.contains('split-active-tab'), 'Code tab should be grayed out');
        assert.ok(diagramTab.classList.contains('split-active-tab'), 'Diagram tab should be grayed out');

        splitViewBtn._trigger('click'); // Deactivate split view
        assert.ok(!codeTab.classList.contains('split-active-tab'), 'Code tab should not be grayed out');
        assert.ok(!diagramTab.classList.contains('split-active-tab'), 'Diagram tab should not be grayed out');
    });
});

describe('UI Concept - Fullscreen', () => {
    function beforeEach() {
        setupMockDOM();
        uiConcept.reset();
        uiConcept.setMermaid(mockMermaid);
        uiConcept.listen('initialize');
    }

    it('should toggle fullscreen mode and update the button icon', () => {
        beforeEach();
        const fullscreenBtn = mockElements['fullscreen-btn'];

        fullscreenBtn._trigger('click'); // Enter fullscreen
        assert.ok(global.document.body.classList.contains('fullscreen-active'), 'Body should have fullscreen class');
        assert.strictEqual(fullscreenBtn.textContent, '⛶', 'Button icon should change to exit fullscreen');

        fullscreenBtn._trigger('click'); // Exit fullscreen
        assert.ok(!global.document.body.classList.contains('fullscreen-active'), 'Body should not have fullscreen class');
        assert.strictEqual(fullscreenBtn.textContent, '⇱', 'Button icon should revert to enter fullscreen');
    });
});