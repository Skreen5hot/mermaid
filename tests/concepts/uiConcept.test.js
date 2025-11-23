import { describe, it, assert, beforeEach } from '../test-utils.js';
import { uiConcept } from '../../src/concepts/uiConcept.js';

// --- Mocks for Browser Environment ---

let mockElements = {};

function setupMockDOM() {
    mockElements = {};
    const ids = [
        'project-selector', 'code-editor', 'new-modal', 'new-name', 'new-create-btn',
        'connect-project-modal', 'unlock-session-modal', 'toast-container', 'split-view-btn',
        'content-area', 'code-tab', 'diagram-tab', 'code-view', 'diagram-view', 'fullscreen-btn'
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
                    } else if (force === false || (force === undefined && this._classes.has(className))) {
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
            },
            focus: () => { this._isFocused = true; }
        };
    });

    // Mock document
    global.document = {
        getElementById: (id) => mockElements[id] || null,
        body: {
            classList: {
                _classes: new Set(),
                toggle: function(className, force) {
                    if (force === true || (force === undefined && !this._classes.has(className))) {
                        this._classes.add(className);
                    } else if (force === false || (force === undefined && this._classes.has(className))) {
                        this._classes.delete(className);
                    }
                },
                contains: function(className) { return this._classes.has(className) }
            },
            appendChild: (el) => { /* no-op */ },
        },
    };
}

const mockMermaid = {
    parse: () => Promise.resolve(),
    render: () => Promise.resolve({ svg: '<svg>mock</svg>' })
};

// --- Tests ---

describe('UI Concept', () => {

    beforeEach(() => {
        setupMockDOM();
        uiConcept.setMermaid(mockMermaid);
        // Initialize caches elements and attaches listeners
        uiConcept.actions.initialize();
    });

    describe('Render Actions', () => {
        it('[UNIT] renderProjectSelector: should update the project selector HTML', () => {
            const projects = [{ id: 1, name: 'Project A' }, { id: 2, name: 'Project B' }];
            uiConcept.actions.renderProjectSelector({ projects, activeProjectId: 2 });

            const selector = mockElements['project-selector'];
            assert.include(selector.innerHTML, '<option value="1" >Project A</option>', 'Should contain Project A');
            assert.include(selector.innerHTML, '<option value="2" selected>Project B</option>', 'Should contain and select Project B');
        });

        it("[UNIT] renderEditor: should update the editor's value", () => {
            const newContent = 'graph TD; A-->B;';
            uiConcept.actions.renderEditor({ content: newContent });

            assert.strictEqual(mockElements['code-editor'].value, newContent, "Editor value should be updated");
        });
    });

    describe('Modal Actions', () => {
        it('[UNIT] showNewDiagramModal: should display the modal', () => {
            const newModal = mockElements['new-modal'];
            assert.notStrictEqual(newModal.style.display, 'flex', 'Pre-condition: modal should be hidden');

            uiConcept.actions.showNewDiagramModal();

            assert.strictEqual(newModal.style.display, 'flex', 'Modal style.display should be "flex"');
        });

        it('[UNIT] showConnectProjectModal: should display the modal', () => {
            const connectModal = mockElements['connect-project-modal'];
            assert.notStrictEqual(connectModal.style.display, 'flex', 'Pre-condition: modal should be hidden');

            uiConcept.actions.showConnectProjectModal();

            assert.strictEqual(connectModal.style.display, 'flex', 'Modal style.display should be "flex"');
        });

        it('[UNIT] showUnlockSessionModal: should display the modal', () => {
            const unlockModal = mockElements['unlock-session-modal'];
            assert.notStrictEqual(unlockModal.style.display, 'flex', 'Pre-condition: modal should be hidden');

            uiConcept.actions.showUnlockSessionModal({ projectName: 'Test Project' });

            assert.strictEqual(unlockModal.style.display, 'flex', 'Modal style.display should be "flex"');
        });
    });

    describe('Event Listeners', () => {
        it("[UNIT] should notify 'ui:projectSelected' when the project selector is changed", () => {
            let notifiedEvent = null;
            let notifiedPayload = null;
            uiConcept.subscribe((event, payload) => {
                notifiedEvent = event;
                notifiedPayload = payload;
            });

            // Simulate user changing the dropdown
            const selector = mockElements['project-selector'];
            selector.value = '3'; // Simulate selecting a project with ID 3
            selector._trigger('change');

            assert.strictEqual(notifiedEvent, 'ui:projectSelected', 'Event name should be correct');
            assert.deepStrictEqual(notifiedPayload, { projectId: 3 }, 'Payload should contain the selected project ID');
        });

        it("[UNIT] should notify 'ui:createDiagramClicked' when the new diagram modal is submitted", () => {
            let notifiedEvent = null;
            let notifiedPayload = null;
            uiConcept.subscribe((event, payload) => {
                notifiedEvent = event;
                notifiedPayload = payload;
            });

            const newNameInput = mockElements['new-name'];
            const createBtn = mockElements['new-create-btn'];

            newNameInput.value = 'My New Diagram';
            createBtn._trigger('click');

            assert.strictEqual(notifiedEvent, 'ui:createDiagramClicked', 'Event name should be correct');
            assert.deepStrictEqual(notifiedPayload, { name: 'My New Diagram' }, 'Payload should contain the new diagram name');
        });
    });

    describe('View Toggles', () => {
        it('[UNIT] toggleSplitView: should toggle the split view state', () => {
            // Turn on split view
            uiConcept.actions.toggleSplitView();
            let state = uiConcept.getState();
            assert.strictEqual(state.activeView, 'split', 'Active view should be "split"');
            assert.isTrue(mockElements['content-area'].classList.contains('split-view-active'), 'Content area should have split-view-active class');
            assert.isTrue(mockElements['code-tab'].classList.contains('split-active-tab'), 'Code tab should be grayed out');

            // Turn off split view
            uiConcept.actions.toggleSplitView();
            state = uiConcept.getState();
            assert.strictEqual(state.activeView, 'code', 'Active view should revert to the active tab (code)');
            assert.isFalse(mockElements['content-area'].classList.contains('split-view-active'), 'Content area should not have split-view-active class');
            assert.isFalse(mockElements['code-tab'].classList.contains('split-active-tab'), 'Code tab should not be grayed out');
        });

        it('[UNIT] toggleFullscreen: should toggle fullscreen mode and update the button icon', () => {
            const fullscreenBtn = mockElements['fullscreen-btn'];
            const body = global.document.body;

            // Enter fullscreen
            uiConcept.actions.toggleFullscreen();
            assert.isTrue(body.classList.contains('fullscreen-active'), 'Body should have fullscreen class');
            assert.strictEqual(fullscreenBtn.textContent, '⛶', 'Button icon should change to exit fullscreen');
            
            // Exit fullscreen
            uiConcept.actions.toggleFullscreen();
            assert.isFalse(body.classList.contains('fullscreen-active'), 'Body should not have fullscreen class');
            assert.strictEqual(fullscreenBtn.textContent, '⇱', 'Button icon should revert to enter fullscreen');
        });
    });
});