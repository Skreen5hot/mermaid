/**
 * Report Concept Test
 * Tests report generation including directory creation
 */

import { reportConcept } from './src/concepts/reportConcept.js';
import { readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';

async function test() {
  console.log('🧪 Testing Report Concept\n');

  try {
    console.log('1️⃣ Testing console report output...');

    const mockResults = {
      stats: {
        total: 10,
        passed: 8,
        failed: 2,
        duration: 5432
      },
      tests: [
        {
          name: 'Test 1',
          suite: 'Suite A',
          status: 'passed',
          duration: 123
        },
        {
          name: 'Test 2',
          suite: 'Suite A',
          status: 'failed',
          duration: 456,
          error: {
            message: 'Expected 5 to equal 10',
            stack: 'Error: Expected 5 to equal 10\n  at test.js:10:5'
          }
        },
        {
          name: 'Test 3',
          suite: 'Suite B',
          status: 'passed',
          duration: 89
        }
      ]
    };

    // Capture console output
    const originalLog = console.log;
    let consoleOutput = '';
    console.log = (...args) => {
      consoleOutput += args.join(' ') + '\n';
      originalLog(...args);
    };

    await reportConcept.actions.generateReport(mockResults);

    console.log = originalLog;

    if (!consoleOutput.includes('Test Results')) {
      throw new Error('Console output should include "Test Results"');
    }

    console.log('✅ Console report output works\n');

    console.log('2️⃣ Testing JSON file generation with directory creation...');

    // Use a nested directory path that doesn't exist
    const testOutputDir = './test-output/nested/results';
    reportConcept.state.outputDir = testOutputDir;

    const testData = {
      timestamp: Date.now(),
      results: mockResults
    };

    await reportConcept.actions.writeResultsFile(testData);

    const expectedFilePath = `${testOutputDir}/results.json`;
    if (!existsSync(expectedFilePath)) {
      throw new Error(`Results file not created at ${expectedFilePath}`);
    }

    console.log(`✅ Directory created and file written to: ${expectedFilePath}\n`);

    console.log('3️⃣ Verifying file content...');

    const fileContent = await readFile(expectedFilePath, 'utf-8');
    const parsedContent = JSON.parse(fileContent);

    if (parsedContent.timestamp !== testData.timestamp) {
      throw new Error('File content does not match written data');
    }

    if (parsedContent.results.stats.total !== 10) {
      throw new Error('Results data not correctly written');
    }

    console.log('✅ File content is correct\n');

    console.log('4️⃣ Testing overwrite of existing file...');

    const updatedResults = {
      ...mockResults,
      stats: { ...mockResults.stats, total: 15 }
    };

    const updatedData = {
      timestamp: Date.now(),
      results: updatedResults
    };

    await reportConcept.actions.writeResultsFile(updatedData);

    const updatedContent = await readFile(expectedFilePath, 'utf-8');
    const parsedUpdated = JSON.parse(updatedContent);

    if (parsedUpdated.results.stats.total !== 15) {
      throw new Error('File not correctly overwritten');
    }

    console.log('✅ File overwrite works\n');

    console.log('5️⃣ Cleaning up test files...');

    await rm('./test-output', { recursive: true, force: true });
    console.log('✅ Test files cleaned up\n');

    console.log('🎉 All report tests passed!');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test failed!');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);

    // Cleanup on error
    try {
      await rm('./test-output', { recursive: true, force: true });
    } catch (e) {
      // Ignore
    }

    process.exit(1);
  }
}

console.log('='.repeat(60));
console.log('  Report Concept Test');
console.log('='.repeat(60));
console.log();

test();
