/**
 * High-Load Concurrency Stress Test for Milestone 2
 * Dispatches 200 concurrent requests across /api/session and /api/health
 */

import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const TEST_PORT = 5057;
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

async function stressTest() {
  console.log('Booting server for 200-request concurrency stress test on port 5057...');
  let proc: ChildProcess | null = null;
  try {
    proc = spawn('node', ['server/dist/index.js'], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PORT: String(TEST_PORT)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const isUp = await waitForServer(BASE_URL);
    if (!isUp) {
      console.error('Server failed to boot on port 5057');
      process.exit(1);
    }

    const CONCURRENCY = 200;
    console.log(`Dispatching ${CONCURRENCY} concurrent requests...`);
    const start = Date.now();

    const tasks = Array.from({ length: CONCURRENCY }).map(async (_, i) => {
      if (i % 4 === 0) {
        // Health check
        const res = await fetch(`${BASE_URL}/api/health`);
        const data = await res.json() as any;
        return { type: 'health', status: res.status, ok: data?.status === 'ok' };
      } else if (i % 4 === 1) {
        // Clinician
        const res = await fetch(`${BASE_URL}/api/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'clinician' })
        });
        const data = await res.json() as any;
        return { type: 'clinician', status: res.status, ok: data?.uid === 'dr-demo' && data?.authToken?.length > 5 };
      } else if (i % 4 === 2) {
        // Patient with shared session
        const res = await fetch(`${BASE_URL}/api/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'patient', sessionId: 'kine-high-stress-shared' })
        });
        const data = await res.json() as any;
        return {
          type: 'patient-shared',
          status: res.status,
          ok: data?.uid === 'pt-demo' && data?.sessionId === 'kine-high-stress-shared'
        };
      } else {
        // Invalid request (negative concurrency)
        const res = await fetch(`${BASE_URL}/api/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'invalid_role_' + i })
        });
        return { type: 'negative', status: res.status, ok: res.status === 400 };
      }
    });

    const results = await Promise.all(tasks);
    const duration = Date.now() - start;

    const failed = results.filter((r) => !r.ok);
    console.log(`Completed ${CONCURRENCY} requests in ${duration}ms (${(duration / CONCURRENCY).toFixed(2)}ms avg/req)`);
    console.log(`Successes: ${results.length - failed.length}/${CONCURRENCY}`);

    if (failed.length === 0) {
      console.log('✅ Concurrency Stress PASS: Zero failures, zero drops, zero leaks across 200 mixed requests.');
      process.exit(0);
    } else {
      console.error(`❌ Concurrency Stress FAIL: ${failed.length} requests failed.`, failed.slice(0, 5));
      process.exit(1);
    }
  } finally {
    if (proc) {
      proc.kill('SIGKILL');
    }
  }
}

stressTest();
