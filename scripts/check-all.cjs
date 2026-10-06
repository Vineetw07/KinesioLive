#!/usr/bin/env node

/**
 * Monorepo Unified Check Runner
 * Enforces Verification Triad: Hygiene -> Typecheck -> Unit/E2E Tests
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n==================================================');
console.log(' 🚀 Running KinesioLive Verification Guardrail');
console.log('==================================================\n');

// Step 1: Workspace Hygiene Check
console.log('▶ [1/3] Checking client workspace hygiene...');
const clientSrc = path.resolve(__dirname, '../client/src');
if (fs.existsSync(clientSrc)) {
  const dirtyFiles = fs.readdirSync(clientSrc).filter(f => f.endsWith('.js') || f.endsWith('.d.ts'));
  if (dirtyFiles.length > 0) {
    console.error(`❌ [HYGIENE ERROR] Found ${dirtyFiles.length} stray compiled files in client/src:`, dirtyFiles);
    console.error('Run "pnpm run clean:src" to remove them.\n');
    process.exit(1);
  }
}
console.log('  ✔ client/src is clean of compiled artifacts.\n');

// Step 2: Monorepo Typecheck
console.log('▶ [2/3] Running TypeScript typecheck across monorepo...');
const typecheckResult = spawnSync('pnpm', ['-r', 'run', 'typecheck'], {
  stdio: 'inherit',
  shell: true
});
if (typecheckResult.status !== 0) {
  console.error('\n❌ [TYPECHECK ERROR] TypeScript typecheck failed.');
  process.exit(typecheckResult.status || 1);
}
console.log('  ✔ TypeScript typecheck passed cleanly.\n');

// Step 3: Automated Test Suites
console.log('▶ [3/3] Running automated Vitest test suites...');
const testResult = spawnSync('pnpm', ['test'], {
  stdio: 'inherit',
  shell: true
});
if (testResult.status !== 0) {
  console.error('\n❌ [TEST ERROR] Vitest test suites failed.');
  process.exit(testResult.status || 1);
}

console.log('\n==================================================');
console.log(' ✅ ALL VERIFICATION GATES PASSED (100% HEALTHY)');
console.log('==================================================\n');
process.exit(0);
