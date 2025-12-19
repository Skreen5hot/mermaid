import { describe, it, assert, beforeEach } from '../test-utils.js';
import { uiConcept } from '../../src/concepts/uiConcept.js';
import { projectConcept } from '../../src/concepts/projectConcept.js';
import { securityConcept } from '../../src/concepts/securityConcept.js';

// --- Mocks for Browser Environment ---

let mockElements = {};

function setupMockDOM() {
    mockElements = {};
    const ids = [
        'project-selector', 'code-editor', 'new-modal', 'new-name', 'new-create-btn',
        'connect-project-modal', 'connect-provider', 'connect-repo-path', 'connect-token',
        'connect-password', 'connect-password-confirm', 'connect-password-error',
        'connect-submit-btn', 'connect-local-project-name', 'connect-local-project-name-group',
        'connect-git-fields-group', 'connect-master-password-group',
        'connect-password-single', 'connect-password-creation-group',
        'unlock-session-modal', 'unlock-project-name', 'unlock-password', 'unlock-error', 
        'unlock-submit-btn',
        'toast-container', 'split-view-btn',
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
            listeners: {}, // For addEventListener
            _inputListeners: [], // For input event
            _changeListeners: [], // For change event
            addEventListener: function(event, callback) {
                if (!this.listeners[event]) this.listeners[event] = [];
                this.listeners[event].push(callback);
            },
            // Helper to simulate event trigger
            _trigger: function(event, eventData = {}) {
                (this.listeners[event] || []).forEach(cb => cb({ target: this, ...eventData }));
            },
            focus: () => { this._isFocused = true; },
            // Specific for input/select elements
            get value() { return this._value; },
            set value(val) { this._value = val; }
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

    describe('Connect Project Modal Logic', () => {
        let connectProviderSelect, connectLocalProjectNameInput, connectLocalProjectNameGroup,
            connectGitFieldsGroup, connectMasterPasswordGroup, connectRepoPathInput, connectTokenInput,
            connectPasswordInput, connectPasswordConfirmInput, connectPasswordError, connectSubmitBtn, connectPasswordSingle, connectPasswordCreationGroup;

        beforeEach(() => {
            // Cache elements for easier access in these tests
            connectProviderSelect = mockElements['connect-provider'];
            connectLocalProjectNameInput = mockElements['connect-local-project-name'];
            connectLocalProjectNameGroup = mockElements['connect-local-project-name-group'];
            connectGitFieldsGroup = mockElements['connect-git-fields-group'];
            connectMasterPasswordGroup = mockElements['connect-master-password-group'];
            connectRepoPathInput = mockElements['connect-repo-path'];
            connectTokenInput = mockElements['connect-token'];
            connectPasswordInput = mockElements['connect-password'];
            connectPasswordConfirmInput = mockElements['connect-password-confirm'];
            connectPasswordError = mockElements['connect-password-error'];
            connectSubmitBtn = mockElements['connect-submit-btn'];
            connectPasswordSingle = mockElements['connect-password-single'];
            connectPasswordCreationGroup = mockElements['connect-password-creation-group'];

            // Ensure modal is shown and initial state is set
            uiConcept.actions.showConnectProjectModal();
        });

        it('[UNIT] should initially show Git fields and hide Local fields', () => {
            assert.strictEqual(connectProviderSelect.value, 'github', 'Default provider should be github');
            assert.strictEqual(connectLocalProjectNameGroup.style.display, 'none', 'Local name group should be hidden');
            assert.strictEqual(connectGitFieldsGroup.style.display, 'block', 'Git fields group should be visible');
            assert.strictEqual(connectMasterPasswordGroup.style.display, 'block', 'Master password group should be visible');
            assert.strictEqual(connectPasswordSingle.style.display, 'none', 'Single password field should be hidden');
            assert.strictEqual(connectPasswordCreationGroup.style.display, 'block', 'Password creation group should be visible');
        });

        it('[UI-STATE] should show a single password field if other Git projects exist but session is locked', () => {
            // Arrange: Simulate a locked session with an existing Git project
            securityConcept.state.sessionPassword = null;
            projectConcept.state.projects = [{ id: 1, name: 'Existing Git Project', gitProvider: 'github' }];

            // Act: Show the modal
            uiConcept.actions.showConnectProjectModal();

            // Assert
            assert.strictEqual(connectMasterPasswordGroup.style.display, 'block', 'Master password group should be visible');
            assert.strictEqual(connectPasswordSingle.style.display, 'block', 'Single password field should be visible');
            assert.strictEqual(connectPasswordCreationGroup.style.display, 'none', 'Password creation group should be hidden');
        });

        it('[UI-STATE] should reset to the default Git view when re-opened after being in the Local view', () => {
            // Arrange: First, switch the modal to the "Local" state
            connectProviderSelect.value = 'local';
            connectProviderSelect._trigger('change');
            assert.strictEqual(connectGitFieldsGroup.style.display, 'none', 'Pre-condition: Git fields should be hidden');

            // Act: Hide and then re-show the modal
            uiConcept.actions.hideConnectProjectModal();
            uiConcept.actions.showConnectProjectModal();

            // Assert: The modal should be reset to its default Git state
            assert.strictEqual(connectProviderSelect.value, 'github', 'Provider should reset to github');
            assert.strictEqual(connectGitFieldsGroup.style.display, 'block', 'Git fields should become visible again');
            assert.strictEqual(connectLocalProjectNameGroup.style.display, 'none', 'Local name group should be hidden again');
        });

        it('[UI-STATE] should HIDE password fields when a session password already exists', () => {
            // Arrange: Set a session password, simulating an already-unlocked session
            securityConcept.state.sessionPassword = 'my-global-password';
    
            // Act: Re-show the modal to trigger the visibility logic
            uiConcept.actions.showConnectProjectModal();
    
            // Assert
            assert.strictEqual(connectMasterPasswordGroup.style.display, 'none', 'Password fields should be hidden');
        });

        it('[UI-STATE] should SHOW password fields when no session password exists', () => {
            securityConcept.state.sessionPassword = null;
            uiConcept.actions.showConnectProjectModal();
            assert.strictEqual(connectMasterPasswordGroup.style.display, 'block', 'Password fields should be visible');
        });

        it('[UNIT] should show Local fields and hide Git fields when "Local" is selected', () => {
            connectProviderSelect.value = 'local';
            connectProviderSelect._trigger('change');

            assert.strictEqual(connectLocalProjectNameGroup.style.display, 'block', 'Local name group should be visible');
            assert.strictEqual(connectGitFieldsGroup.style.display, 'none', 'Git fields group should be hidden');
            assert.strictEqual(connectMasterPasswordGroup.style.display, 'none', 'Master password group should be hidden');
        });

        it('[UNIT] should disable submit button for local project if name is empty', () => {
            connectProviderSelect.value = 'local';
            connectProviderSelect._trigger('change'); // Update visibility and button state
            connectLocalProjectNameInput.value = '';
            connectLocalProjectNameInput._trigger('input'); // Trigger input event

            assert.isTrue(connectSubmitBtn.disabled, 'Submit button should be disabled if local name is empty');
        });

        it('[UNIT] should enable submit button for local project if name is filled', () => {
            connectProviderSelect.value = 'local';
            connectProviderSelect._trigger('change');
            connectLocalProjectNameInput.value = 'My Local Project';
            connectLocalProjectNameInput._trigger('input');

            assert.isFalse(connectSubmitBtn.disabled, 'Submit button should be enabled if local name is filled');
        });

        it('[UNIT] should disable submit button for Git project if fields are empty', () => {
            connectProviderSelect.value = 'github';
            connectProviderSelect._trigger('change');
            connectRepoPathInput.value = ''; // Ensure empty
            connectTokenInput.value = '';
            connectPasswordInput.value = '';
            connectPasswordConfirmInput.value = '';
            connectRepoPathInput._trigger('input'); // Trigger an input event

            assert.isTrue(connectSubmitBtn.disabled, 'Submit button should be disabled if Git fields are empty');
        });

        it('[UNIT] should disable submit button for Git project if passwords do not match', () => {
            connectProviderSelect.value = 'github';
            connectProviderSelect._trigger('change');
            connectRepoPathInput.value = 'owner/repo';
            connectTokenInput.value = 'token';
            connectPasswordInput.value = 'pass1';
            connectPasswordConfirmInput.value = 'pass2';
            connectPasswordConfirmInput._trigger('input'); // Trigger input event

            assert.isTrue(connectSubmitBtn.disabled, 'Submit button should be disabled if passwords do not match');
            assert.strictEqual(connectPasswordError.style.display, 'block', 'Password error should be visible');
        });

        it('[UNIT] should enable submit button for Git project if all fields are filled and passwords match', () => {
            connectProviderSelect.value = 'github';
            connectProviderSelect._trigger('change');
            connectRepoPathInput.value = 'owner/repo';
            connectTokenInput.value = 'token';
            connectPasswordInput.value = 'password';
            connectPasswordConfirmInput.value = 'password';
            connectPasswordConfirmInput._trigger('input'); // Trigger input event

            assert.isFalse(connectSubmitBtn.disabled, 'Submit button should be enabled if all Git fields are valid');
            assert.strictEqual(connectPasswordError.style.display, 'none', 'Password error should be hidden');
        });

        it('[UI-STATE] should enable submit button for Git project if session is unlocked and fields are filled', () => {
            // Arrange: Simulate an unlocked session
            securityConcept.state.sessionPassword = 'my-global-password';
            uiConcept.actions.showConnectProjectModal(); // Re-show modal to apply state

            // Act
            connectRepoPathInput.value = 'owner/repo';
            connectTokenInput.value = 'token';
            connectTokenInput._trigger('input'); // Trigger input event

            // Assert
            assert.isFalse(connectSubmitBtn.disabled, 'Submit button should be enabled without password input');
        });

        it('[UNIT] should notify with correct payload for local project creation', () => {
            let notifiedPayload = null;
            uiConcept.subscribe((event, payload) => { if (event === 'ui:connectProjectClicked') notifiedPayload = payload; });

            connectProviderSelect.value = 'local';
            connectProviderSelect._trigger('change');
            connectLocalProjectNameInput.value = 'My Local Project';
            connectLocalProjectNameInput._trigger('input');
            connectSubmitBtn._trigger('click');

            assert.deepStrictEqual(notifiedPayload, { gitProvider: 'local', name: 'My Local Project' }, 'Payload for local project should be correct');
            assert.strictEqual(mockElements['connect-project-modal'].style.display, 'none', 'Connect modal should be hidden');
        });

        // Git project payload is already covered by an existing integration test in synchronizations.test.js
        // and the ui:connectProjectClicked event listener in uiConcept.js now relies on the button's disabled state.
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