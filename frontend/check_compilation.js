#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Checking TypeScript compilation...');

try {
  // Change to frontend directory
  process.chdir(__dirname);
  
  // Run TypeScript compiler check
  console.log('Running: npx tsc --noEmit');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  
  console.log('✅ TypeScript compilation successful!');
  console.log('🎉 No compilation errors found.');
  
} catch (error) {
  console.log('❌ TypeScript compilation failed.');
  console.log('Error details:', error.message);
  process.exit(1);
}