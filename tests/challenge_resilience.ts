/**
 * Targeted Resilience & Live Fallback Challenge
 * Verifies that when a full (non-truncated) Auth Key is provided,
 * if CometChat upstream returns 401 Unauthorized or network fails,
 * the server does NOT crash, does NOT hang indefinitely, and gracefully falls back.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const TEST_PORT = 5056;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, '..');

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.status === 200) return true;
    } catch {
      // Waiting
    }
    await sleep(150);
  }
  return false;
}

async function testResilience() {
  console.log('Testing upstream failure resilience on port 5056...');
  let proc: ChildProcess | null = null;
  try {
    proc = spawn('node', ['server/dist/index.js'], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        COMETCHAT_APP_ID: '168428446858f07fb',
        COMETCHAT_REGION: 'IN',
        // Provide an untruncated 32-character key that will fail upstream with 401
        COMETCHAT_AUTH_KEY: '11112222333344445555666677778888'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const isUp = await waitForServer(BASE_URL);
    if (!isUp) {
      console.error('Server failed to boot on port 5056');
      process.exit(1);
    }

    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'clinician' })
    });
    const elapsed = Date.now() - t0;
    const json = await res.json() as any;

    console.log(`Response status: ${res.status} (${elapsed}ms)`);
    console.log(`Response json:`, json);

    if (res.status === 200 && json.uid === 'dr-demo' && json.authToken) {
      console.log('✅ Resilience PASS: Gracefully handled upstream 401 without crashing or hanging.');
      process.exit(0);
    } else {
      console.error('❌ Resilience FAIL:', res.status, json);
      process.exit(1);
    }
  } finally {
    if (proc) {
      proc.kill('SIGKILL');
    }
  }
}

testResilience();
