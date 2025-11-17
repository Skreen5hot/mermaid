import { test } from '../src/utils/testRunner.js';
import { assert } from '../src/utils/assert.js';
import { projectConcept } from '../src/concepts/projectConcept.js';
import { diagramConcept } from '../src/concepts/diagramConcept.js';
import { uiConcept } from '../src/concepts/uiConcept.js';
import { storageConcept } from '../src/concepts/storageConcept.js';

// Initialize the synchronizations by importing the module.
// This ensures all the event listeners between concepts are set up.
import '../src/synchronizations.js';

// --- Mocks and Spies ---

// Simple spy to track function calls
function createSpy() {
    let callCount = 0;
    const calls = [];
    const spy = (...args) => {
        callCount++;
        calls.push(args);
    };
    spy.getCallCount = () => callCount;
    spy.getCall = (index) => calls[index];
    spy.reset = () => {
        callCount = 0;
        calls.length = 0;
    };
    return spy;
}

// Mock FileReader for Node.js environment
global.FileReader = class MockFileReader {
    constructor() {
        this.onload = null;
    }
    readAsText(file) {
        // Simulate async reading and trigger onload
        setTimeout(() => {
            if (this.onload) {
                this.onload({ target: { result: file.content } });
            }
        }, 0);
    }
};

test('synchronizations: ui:uploadMmdClicked should create diagrams in the current project', async () => {
    // --- Setup ---
    // Spy on the downstream concept to see if it gets called
    const diagramListenSpy = createSpy();
    diagramConcept.listen = diagramListenSpy;

    // Mock the project state to have a current project
    projectConcept.getState = () => ({ currentProjectId: 'proj-123' });

    // Mock the console to prevent logs from cluttering test output
    const consoleLogSpy = createSpy();
    const originalConsoleLog = console.log;
    console.log = consoleLogSpy;

    // --- Action ---
    // Simulate a file upload event from the UI
    const mockFiles = [
        { name: 'diagram-one.mmd', content: 'graph TD; A-->B' },
        { name: 'diagram-two.mmd', content: 'sequenceDiagram; A->>B: Hello' }
    ];
    uiConcept.notify('ui:uploadMmdClicked', { files: mockFiles });

    // Wait for FileReader's async onload to fire
    await new Promise(resolve => setTimeout(resolve, 10));

    // --- Assertions ---
    assert.strictEqual(diagramListenSpy.getCallCount(), 2, 'diagramConcept.listen should be called twice for two files');

    const firstCallArgs = diagramListenSpy.getCall(0);
    assert.strictEqual(firstCallArgs[0], 'createDiagram', 'The event should be "createDiagram"');
    assert.strictEqual(firstCallArgs[1].name, 'diagram-one', 'The diagram name should be correctly parsed from the file name');
    assert.strictEqual(firstCallArgs[1].content, 'graph TD; A-->B', 'The diagram content should be passed through');
    assert.strictEqual(firstCallArgs[1].projectId, 'proj-123', 'The diagram should be associated with the current project ID');

    // --- Teardown ---
    console.log = originalConsoleLog; // Restore console.log
});