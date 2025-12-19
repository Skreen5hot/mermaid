import { spawn } from 'child_process';
import { readdir, stat, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testsDir = join(__dirname, 'unit-tests');

async function findTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        return findTestFiles(fullPath);
      }
      if (entry.isFile() && entry.name.endsWith('.test.js')) {
        return fullPath;
      }
      return [];
    })
  );
  return files.flat();
}

async function runTest(file) {
  return new Promise((resolve) => {
    console.log(`\nRunning: ${file.replace(__dirname, '')}`);
    const startTime = Date.now();
    const child = spawn('node', [file], { stdio: 'pipe' });

    let stdout = '';
    let stderr = '';

    // Capture output for test counting
    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;

      // Count individual tests from output
      const passMatches = stdout.match(/✓ PASS:/g);
      const failMatches = stdout.match(/✗ FAIL:/g) || stderr.match(/✗ FAIL:/g);
      const testsPassed = passMatches ? passMatches.length : 0;
      const testsFailed = failMatches ? failMatches.length : 0;
      const testsTotal = testsPassed + testsFailed;

      resolve({
        file,
        passed: code === 0,
        duration,
        testsTotal,
        testsPassed,
        testsFailed
      });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes('--json');
  const writeJson = jsonOnly || args.includes('--write-json');

  let testFiles = [];

  if (args.length > 0) {
    // Filter out flags from file arguments
    const fileArgs = args.filter(arg => !arg.startsWith('--'));
    if (fileArgs.length > 0) {
      testFiles = fileArgs.map(arg => join(__dirname, arg));
    } else {
      testFiles = await findTestFiles(testsDir);
    }
  } else {
    testFiles = await findTestFiles(testsDir);
  }

  const startTime = Date.now();
  const results = await Promise.all(testFiles.map(runTest));
  const totalDuration = Date.now() - startTime;

  const filesPassedCount = results.filter(r => r.passed).length;
  const filesFailedCount = results.filter(r => !r.passed).length;
  const filePassRate = ((filesPassedCount / results.length) * 100).toFixed(1);

  // Calculate individual test metrics
  const totalTests = results.reduce((sum, r) => sum + r.testsTotal, 0);
  const totalTestsPassed = results.reduce((sum, r) => sum + r.testsPassed, 0);
  const totalTestsFailed = results.reduce((sum, r) => sum + r.testsFailed, 0);
  const testPassRate = totalTests > 0 ? ((totalTestsPassed / totalTests) * 100).toFixed(1) : 0;

  // Console output (unless --json flag)
  if (!jsonOnly) {
    console.log('\n--- Test Summary ---');
    results.forEach(({ file, passed, duration, testsTotal, testsPassed, testsFailed }) => {
      const result = passed ? '✅ PASSED' : '❌ FAILED';
      const testInfo = testsTotal > 0 ? ` [${testsPassed}/${testsTotal} tests]` : '';
      console.log(`${result}: ${file.replace(__dirname, '')} (${duration}ms)${testInfo}`);
    });

    console.log(`\n📊 File Results: ${filesPassedCount}/${results.length} passed (${filePassRate}%)`);
    if (totalTests > 0) {
      console.log(`📋 Test Results: ${totalTestsPassed}/${totalTests} individual tests passed (${testPassRate}%)`);
    }
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  }

  // JSON report generation
  if (writeJson) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        files: {
          total: results.length,
          passed: filesPassedCount,
          failed: filesFailedCount,
          passRate: parseFloat(filePassRate)
        },
        tests: {
          total: totalTests,
          passed: totalTestsPassed,
          failed: totalTestsFailed,
          passRate: parseFloat(testPassRate)
        },
        duration: totalDuration
      },
      results: results.map(({ file, passed, duration, testsTotal, testsPassed, testsFailed }) => ({
        file: file.replace(__dirname, '').replace(/\\/g, '/'),
        status: passed ? 'passed' : 'failed',
        duration,
        tests: {
          total: testsTotal,
          passed: testsPassed,
          failed: testsFailed
        }
      }))
    };

    const reportPath = join(__dirname, 'unit-test-results.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2));

    if (jsonOnly) {
      // Output JSON to stdout for CI/CD parsing
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`\n💾 JSON report written to: unit-test-results.json`);
    }
  }

  if (filesFailedCount > 0) {
    process.exit(1);
  }
}

main();