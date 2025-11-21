import { uiConcept } from '../../src/concepts/uiConcept.js';
import { describe, it } from '../test-helpers.js';
import assert from '../../src/assert.js';

// --- Mocks for Browser Environment ---

let mockElements = {};

function setupMockDOM() {
    mockElements = {};
    const ids = [
        'code-tab', 'diagram-tab', 'code-view', 'diagram-view', 'code-editor',
        'diagram-container', 'file-info', 'split-view-btn', 'project-sidebar',
        'sidebar-toggle-btn', 'project-selector', 'diagram-list', 'theme-toggle',
        'new-project-btn', 'delete-project-btn', 'new-btn', 'save-btn',
        'delete-btn', 'rename-btn', 'new-modal', 'new-name', 'new-cancel-btn',
        'new-create-btn', 'upload-diagrams-input', 'download-project-btn', 'sidebar-resizer',
        'split-view-resizer', 'content-area',
        'export-mmd-btn', 'render-btn'
    ];

    ids.forEach(id => {
        mockElements[id] = {
            id: id,
            value: '',
            innerHTML: '',
            textContent: '',
            style: {},
            classList: {
                _classes: new Set(),
                add: function(...classNames) { classNames.forEach(c => this._classes.add(c)) },
                remove: function(className) { this._classes.delete(className) },
                toggle: function(className, force) {
                    if (force === true || (force === undefined && !this._classes.has(className))) {
                        this._classes.add(className);
                    } else {
                        this._classes.delete(className);
                    }
                },
                contains: function(className) { return this._classes.has(className) }
            },
            listeners: {},
            addEventListener: function(event, callback) {
                if (!this.listeners[event]) this.listeners[event] = [];
                this.listeners[event].push(callback);
            },
            // Helper to simulate event trigger
            _trigger: function(event, eventData = {}) {
                (this.listeners[event] || []).forEach(cb => cb({ target: this, ...eventData }));
            }
        };
        // Add focus mock
        mockElements[id].focus = () => {
            mockElements[id]._isFocused = true;
        };
    });

    // Mock document
    global.document = {
        getElementById: (id) => mockElements[id] || null,
        body: { style: {}, userSelect: '' },
        addEventListener: () => {},
        removeEventListener: () => {},
    };
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

    it("listen('renderProjectSelector') should update the project selector HTML", () => {
        beforeEach();
        const projects = [{ id: 1, name: 'Project A' }, { id: 2, name: 'Project B' }];
        uiConcept.listen('renderProjectSelector', { projects, currentProjectId: 2 });

        const selector = mockElements['project-selector'];
        assert.ok(selector.innerHTML.includes('<option value="1" >Project A</option>'), 'Should contain Project A');
        assert.ok(selector.innerHTML.includes('<option value="2" selected>Project B</option>'), 'Should contain and select Project B');
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

    it("should toggle the 'closed' class on the sidebar and toggle button when clicked", () => {
        beforeEach();
        const sidebar = mockElements['project-sidebar'];
        const toggleBtn = mockElements['sidebar-toggle-btn'];

        // Simulate the first click to close the sidebar
        toggleBtn._trigger('click');

        assert.ok(sidebar.classList.contains('closed'), 'Sidebar should have the "closed" class after first click');
        assert.ok(toggleBtn.classList.contains('closed'), 'Toggle button should have the "closed" class after first click');

        // Simulate the second click to open the sidebar
        toggleBtn._trigger('click');
        assert.ok(!sidebar.classList.contains('closed'), 'Sidebar should not have the "closed" class after second click');
        assert.ok(!toggleBtn.classList.contains('closed'), 'Toggle button should not have the "closed" class after second click');
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