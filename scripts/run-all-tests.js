/**
 * The main entry point for running all tests.
 * It loads the test runner, discovers all test files, and executes them.
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import TestRunner from '../unit-tests/framework/test-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = path.join(__dirname, '..', 'unit-tests');

/**
 * Recursively finds all files ending with .test.js in a directory.
 * @param {string} dir The directory to search.
 * @returns {string[]} An array of full file paths.
 */
function findTestFiles(dir) {
    let testFiles = [];
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            testFiles = testFiles.concat(findTestFiles(fullPath));
        } else if (file.endsWith('.test.js')) {
            testFiles.push(fullPath);
        }
    }
    return testFiles;
}

const allTestFiles = findTestFiles(testDir);

// We use an async IIFE (Immediately Invoked Function Expression) to handle dynamic imports.
(async () => {
    // Use Promise.all to load all test files asynchronously.
    // The dynamic import() can handle both CommonJS and ES Modules.
    // On Windows, we must convert absolute paths to file:// URLs for dynamic import.
    const importPromises = allTestFiles.map(file => import(pathToFileURL(file).href));
    await Promise.all(importPromises);

    // Once all test files are loaded and have registered their suites, run the tests.
    TestRunner.run();
})();