import { uiConcept } from '../../src/concepts/uiConcept.js';
import assert from '../framework/assert.js';

/**
 * Creates a mock DOM element with basic properties needed for tests.
 * @param {string} id The ID of the mock element.
 * @returns {object} A mock DOM element.
 */
const createClassListMock = () => {
    const classes = new Set();
    return {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        toggle: (c) => classes.has(c) ? classes.delete(c) : classes.add(c),
        has: (c) => classes.has(c),
    };
};
const createMockElement = (id) => ({
    id,
    innerHTML: '',
    value: '',
    textContent: '',
    classList: createClassListMock(),
    style: {},
    dataset: {},
    appendChild: function(child) { this.innerHTML += child.outerHTML || child.textContent; },
    addEventListener: function(event, callback) {
        this._listeners = this._listeners || {};
        this._listeners[event] = callback;
    },
    // Helper for tests to simulate events
    _simulateClick: function() { this._listeners?.['click']?.(); },
    _simulateChange: function(value) {
        this.value = value;
        this._listeners?.['change']?.({ target: this });
    },
});

/**
 * Sets up a mock DOM environment in the global scope for testing.
 */
function setupMockDOM() {
    const mockElements = {};
    const ids = [
        'code-tab', 'diagram-tab', 'code-view', 'diagram-view', 'code-editor',
        'diagram-container', 'file-info', 'split-view-btn', 'project-sidebar',
        'sidebar-toggle-btn', 'project-selector', 'diagram-list', 'theme-toggle',
        'new-project-btn', 'delete-project-btn', 'new-btn', 'save-btn', 'delete-btn',
        'rename-btn', 'new-modal', 'new-name', 'new-cancel-btn', 'new-create-btn'
    ];
    ids.forEach(id => mockElements[id] = createMockElement(id));

    global.document = {
        getElementById: (id) => mockElements[id],
        createElement: (tag) => ({
            ...createMockElement(null),
            tagName: tag.toUpperCase(),
            outerHTML: `<${tag}></${tag}>`
        }),
        body: { classList: createClassListMock() }
    };

    global.localStorage = {
        _store: {},
        getItem: function(key) { return this._store[key] || null; },
        setItem: function(key, value) { this._store[key] = value; },
        clear: function() { this._store = {}; }
    };

    global.mermaid = {
        initialize: () => {},
        render: () => Promise.resolve({ svg: '<svg></svg>' })
    };

    global.prompt = () => 'Mocked Prompt';
}

/**
 * A helper to capture all events emitted by a concept's event bus during a test.
 */
function captureEvents(concept) {
    const events = [];
    concept.subscribe((event, payload) => {
        events.push({ event, payload });
    });
    return events;
}

describe('uiConcept.js', () => {
    beforeEach(() => {
        // Set up the mock browser environment before each test
        setupMockDOM();
        uiConcept.reset();
        // Initialize the concept to populate elements and attach listeners
        uiConcept.listen('initialize');
    });

    it("listen('renderProjectSelector', ...) should update the project selector's innerHTML", () => {
        const mockProjects = [{ id: 1, name: 'Project One' }, { id: 2, name: 'Project Two' }];
        uiConcept.listen('renderProjectSelector', { projects: mockProjects, currentProjectId: 1 });

        const projectSelector = document.getElementById('project-selector');
        assert.ok(projectSelector.innerHTML.includes('<option value="1">Project One</option>'), 'Should render project options');
        assert.strictEqual(projectSelector.value, 1, 'Should set the correct value');
    });

    it("listen('renderEditor', ...) should set the code editor's value", () => {
        const newContent = 'graph TD; A-->B;';
        uiConcept.listen('renderEditor', { content: newContent });

        const codeEditor = document.getElementById('code-editor');
        assert.strictEqual(codeEditor.value, newContent, 'Editor value should be updated');
    });

    it("listen('toggleSplitView') should toggle the split view state", () => {
        const mainView = { classList: createClassListMock() };
        // A more robust mock would allow querying the DOM tree, but for this we can mock it directly
        global.document.querySelector = () => mainView;

        uiConcept.listen('toggleSplitView');
        assert.ok(mainView.classList.has('split-view-active'), 'Should add active class on first toggle');

        uiConcept.listen('toggleSplitView');
        assert.ok(!mainView.classList.has('split-view-active'), 'Should remove active class on second toggle');
    });

    it("simulating a project selection should emit a 'ui:projectSelected' event", () => {
        const events = captureEvents(uiConcept);
        const projectSelector = document.getElementById('project-selector');

        // Simulate user changing the dropdown
        projectSelector._simulateChange('2');

        const emittedEvent = events.find(e => e.event === 'ui:projectSelected');
        assert.ok(emittedEvent, "Should emit 'ui:projectSelected' event");
        assert.strictEqual(emittedEvent.payload.projectId, '2', 'Payload should contain the selected project ID');
    });

    it("simulating a new project click should emit a 'ui:newProjectClicked' event", () => {
        const events = captureEvents(uiConcept);
        const newProjectBtn = document.getElementById('new-project-btn');

        // Simulate user clicking the new project button
        newProjectBtn._simulateClick();

        const emittedEvent = events.find(e => e.event === 'ui:newProjectClicked');
        assert.ok(emittedEvent, "Should emit 'ui:newProjectClicked' event");
        assert.strictEqual(emittedEvent.payload.name, 'Mocked Prompt', 'Payload should contain the name from the mocked prompt');
    });
});