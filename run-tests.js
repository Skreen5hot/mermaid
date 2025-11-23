import { spawn } from 'child_process';
import { readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testsDir = join(__dirname, 'tests');

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
    const child = spawn('node', [file], { stdio: 'pipe' });

    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);

    child.on('close', (code) => {
      resolve({ file, passed: code === 0 });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  let testFiles = [];

  if (args.length > 0) {
    testFiles = args.map(arg => join(__dirname, arg));
  } else {
    testFiles = await findTestFiles(testsDir);
  }
  const results = await Promise.all(testFiles.map(runTest));

  console.log('\n--- Test Summary ---');
  const failedTests = [];
  results.forEach(({ file, passed }) => {
    const result = passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${result}: ${file.replace(__dirname, '')}`);
    if (!passed) {
      failedTests.push(file);
    }
  });

  if (failedTests.length > 0) {
    process.exit(1);
  }
}

main();