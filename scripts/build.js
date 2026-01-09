#!/usr/bin/env node

/**
 * Cross-platform build script
 * Copies necessary files to dist/ directory for deployment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build script is in scripts/, so go up one level to project root
const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

// Clean dist directory
console.log('🧹 Cleaning dist directory...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// Copy files
// Note: node_modules NOT included - using CDN for n3 library
const itemsToCopy = [
  'index.html',
  'styles',
  'src'
];

console.log('📦 Copying files to dist/...');

for (const item of itemsToCopy) {
  const src = path.join(projectRoot, item);
  const dest = path.join(distDir, item);

  if (!fs.existsSync(src)) {
    console.warn(`⚠️  Warning: ${item} not found, skipping...`);
    continue;
  }

  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    console.log(`  📁 ${item}/`);
    fs.cpSync(src, dest, { recursive: true });
  } else {
    console.log(`  📄 ${item}`);
    fs.copyFileSync(src, dest);
  }
}

console.log('✅ Build complete!');
console.log(`📦 Output: ${distDir}`);
