/**
 * Empirical Challenge Harness for Milestone 2: Express Backend & CometChat REST Token Service
 * Executed independently by teamwork_preview_challenger_m2_1
 *
 * Verifies live HTTP behavior of @kinesio/server:
 * - Boot diagnostics & credential isolation
 * - GET /api/health
 * - POST /api/session (clinician & patient)
 * - Negative inputs & edge cases
 * - High-concurrency stress testing
 */

import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const TEST_PORT = 5055;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, '..');

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  durationMs?: number;
}

const results: TestResult[] = [];

function record(name: string, passed: boolean, details?: string, durationMs?: number) {
  results.push({ name, passed, details, durationMs });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark}: ${name} ${details ? `(${details})` : ''}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.status === 200) return true;
    } catch {
      // Waiting for server to start
    }
    await sleep(150);
  }
  return false;
}

async function runEmpiricalChallenge() {
  console.log('================================================================');
  console.log('       Milestone 2 Empirical Challenge Verification Suite       ');
  console.log('================================================================');
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  // --------------------------------------------------------------------------
  // Phase 1: Boot Live Server Process
  // --------------------------------------------------------------------------
  console.log('--- Phase 1: Booting Live Server Process ---');
  let serverProcess: ChildProcess | null = null;
  let serverOutput = '';

  try {
    serverProcess = spawn('node', ['server/dist/index.js'], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        COMETCHAT_APP_ID: '168428446858f07fb',
        COMETCHAT_REGION: 'IN',
        COMETCHAT_AUTH_KEY: '1d33b8f1dc49d72eb92e20928a5cef60...'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout?.on('data', (d) => {
      serverOutput += d.toString();
    });
    serverProcess.stderr?.on('data', (d) => {
      serverOutput += d.toString();
    });

    const isUp = await waitForServer(BASE_URL);
    record(
      'Server Process Boot on Port ' + TEST_PORT,
      isUp,
      isUp ? 'Server responding to health probe' : 'Server failed to start within timeout'
    );

    if (!isUp) {
      console.error('Server output:\n', serverOutput);
      process.exit(1);
    }

    // Verify boot diagnostic warning for truncated key
    const hasDiagnosticWarning = serverOutput.includes('[DIAGNOSTIC WARNING]') &&
      serverOutput.includes('truncated with trailing ellipsis');
    record(
      'Boot Diagnostic Warning for Truncated Key',
      hasDiagnosticWarning,
      hasDiagnosticWarning ? 'Detected trailing ellipsis warning' : 'Missing diagnostic warning in stdout'
    );

    // --------------------------------------------------------------------------
    // Phase 2: GET /api/health Verification
    // --------------------------------------------------------------------------
    console.log('\n--- Phase 2: GET /api/health Verification ---');
    {
      const start = Date.now();
      const res = await fetch(`${BASE_URL}/api/health`);
      const elapsed = Date.now() - start;
      const json = await res.json() as any;

      record('GET /api/health HTTP 200 Status', res.status === 200, `Status: ${res.status}`, elapsed);
      record(
        'GET /api/health Content-Type is application/json',
        (res.headers.get('content-type') || '').includes('application/json'),
        `Content-Type: ${res.headers.get('content-type')}`
      );
      record('GET /api/health status === "ok"', json?.status === 'ok', `status: ${json?.status}`);
      record(
        'GET /api/health uptime is non-negative number',
        typeof json?.uptime === 'number' && json?.uptime >= 0,
        `uptime: ${json?.uptime}`
      );
      record(
        'GET /api/health timestamp is valid recent epoch',
        typeof json?.timestamp === 'number' && Math.abs(Date.now() - json?.timestamp) < 5000,
        `timestamp: ${json?.timestamp}`
      );
      const keys = Object.keys(json).sort();
      record(
        'GET /api/health strict keys contract { status, timestamp, uptime }',
        JSON.stringify(keys) === JSON.stringify(['status', 'timestamp', 'uptime']),
        `Keys: ${JSON.stringify(keys)}`
      );

      // Monotonicity check
      await sleep(100);
      const res2 = await fetch(`${BASE_URL}/api/health`);
      const json2 = await res2.json() as any;
      record(
        'GET /api/health Monotonic Uptime Progression',
        json2.uptime > json.uptime,
        `uptime1: ${json.uptime}, uptime2: ${json2.uptime}`
      );
    }

    // --------------------------------------------------------------------------
    // Phase 3: POST /api/session Clinician Flow
    // --------------------------------------------------------------------------
    console.log('\n--- Phase 3: POST /api/session Clinician Flow ---');
    let clinicianSessionId = '';
    {
      const start = Date.now();
      const res = await fetch(`${BASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'clinician' })
      });
      const elapsed = Date.now() - start;
      const json = await res.json() as any;

      record('POST /api/session Clinician HTTP 200', res.status === 200, `Status: ${res.status}`, elapsed);
      record('POST /api/session Clinician UID is dr-demo', json?.uid === 'dr-demo', `uid: ${json?.uid}`);
      record(
        'POST /api/session Clinician SessionId auto-generated with kine- prefix',
        typeof json?.sessionId === 'string' && json?.sessionId.startsWith('kine-'),
        `sessionId: ${json?.sessionId}`
      );
      clinicianSessionId = json?.sessionId;
      record(
        'POST /api/session Clinician non-empty authToken (> 5 chars)',
        typeof json?.authToken === 'string' && json?.authToken.length > 5,
        `authToken: ${json?.authToken}`
      );
      record('POST /api/session Clinician appId match', json?.appId === '168428446858f07fb', `appId: ${json?.appId}`);
      record('POST /api/session Clinician region match', json?.region === 'IN', `region: ${json?.region}`);

      // Verify no secrets leaked in response
      const rawText = JSON.stringify(json);
      const leakedAuthKey = rawText.includes('1d33b8f1dc49d72eb92e20928a5cef60');
      record('POST /api/session Zero Secret Leakage', !leakedAuthKey, 'No secret auth key in response body');
    }

    // --------------------------------------------------------------------------
    // Phase 4: POST /api/session Patient Flow (Existing Session ID)
    // --------------------------------------------------------------------------
    console.log('\n--- Phase 4: POST /api/session Patient Flow (Existing Session ID) ---');
    {
      const start = Date.now();
      const res = await fetch(`${BASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'patient', sessionId: clinicianSessionId })
      });
      const elapsed = Date.now() - start;
      const json = await res.json() as any;

      record('POST /api/session Patient Existing Session HTTP 200', res.status === 200, `Status: ${res.status}`, elapsed);
      record('POST /api/session Patient UID is pt-demo', json?.uid === 'pt-demo', `uid: ${json?.uid}`);
      record(
        'POST /api/session Patient Preserves Existing SessionId verbatim',
        json?.sessionId === clinicianSessionId,
        `sessionId: ${json?.sessionId}`
      );
      record(
        'POST /api/session Patient non-empty authToken',
        typeof json?.authToken === 'string' && json?.authToken.length > 5,
        `authToken: ${json?.authToken}`
      );
    }

    // --------------------------------------------------------------------------
    // Phase 5: POST /api/session Patient Flow (Auto-Generated Session ID)
    // --------------------------------------------------------------------------
    console.log('\n--- Phase 5: POST /api/session Patient Flow (Auto-Generated Session ID) ---');
    {
      const res = await fetch(`${BASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'patient' })
      });
      const json = await res.json() as any;

      record('POST /api/session Patient Auto Session HTTP 200', res.status === 200, `Status: ${res.status}`);
      record('POST /api/session Patient UID is pt-demo', json?.uid === 'pt-demo', `uid: ${json?.uid}`);
      record(
        'POST /api/session Patient SessionId starts with kine-',
        typeof json?.sessionId === 'string' && json?.sessionId.startsWith('kine-'),
        `sessionId: ${json?.sessionId}`
      );
    }

    // --------------------------------------------------------------------------
    // Phase 6: Negative Inputs & Error Handling Stress Test
    // --------------------------------------------------------------------------
    console.log('\n--- Phase 6: Negative Inputs & Error Handling Stress Test ---');
    const negativeCases = [
      { name: 'Missing role ({})', body: {}, expectedStatus: 400 },
      { name: 'Empty role string ({"role": ""})', body: { role: '' }, expectedStatus: 400 },
      { name: 'Invalid role "hacker"', body: { role: 'hacker' }, expectedStatus: 400 },
      { name: 'Invalid role "doctor"', body: { role: 'doctor' }, expectedStatus: 400 },
      { name: 'Invalid role "admin"', body: { role: 'admin' }, expectedStatus: 400 },
      { name: 'Numeric role ({"role": 123})', body: { role: 123 }, expectedStatus: 400 },
      { name: 'Boolean role ({"role": true})', body: { role: true }, expectedStatus: 400 },
      { name: 'Null role ({"role": null})', body: { role: null }, expectedStatus: 400 },
      { name: 'Array role ({"role": ["clinician"]})', body: { role: ['clinician'] }, expectedStatus: 400 },
      { name: 'Object role ({"role": {}})', body: { role: {} }, expectedStatus: 400 },
      { name: 'Array payload ([])', body: [], expectedStatus: 400 },
      { name: 'Primitive string payload', body: 'clinician', expectedStatus: 400 },
      { name: 'Null payload', body: null, expectedStatus: 400 }
    ];

    for (const testCase of negativeCases) {
      const res = await fetch(`${BASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.body)
      });
      const data = await res.json().catch(() => ({}));
      record(
        `Negative Test: ${testCase.name}`,
        res.status === testCase.expectedStatus,
        `Status: ${res.status}, error: ${(data as any)?.error}`
      );
    }

    // Malformed JSON (unparseable payload)
    {
      const res = await fetch(`${BASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"role": "clinician", malformed'
      });
      const data = await res.json().catch(() => ({}));
      record(
        'Negative Test: Malformed JSON syntax rejected with 400',
        res.status === 400,
        `Status: ${res.status}, message: ${(data as any)?.error}`
      );
    }

    // Boundary case: Whitespace sessionId -> should auto-generate
    {
      const res = await fetch(`${BASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'clinician', sessionId: '    ' })
      });
      const json = await res.json() as any;
      record(
        'Boundary Test: Whitespace sessionId triggers auto-generation',
        res.status === 200 && json?.sessionId.startsWith('kine-') && !json?.sessionId.includes(' '),
        `sessionId: "${json?.sessionId}"`
      );
    }

    // Boundary case: Extraneous fields ignored safely
    {
      const res = await fetch(`${BASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'patient',
          sessionId: 'safe-room',
          unwantedProperty: 'malicious',
          __proto__: { injected: true }
        })
      });
      const json = await res.json() as any;
      record(
        'Boundary Test: Extraneous fields not reflected or polluting response',
        res.status === 200 && json?.sessionId === 'safe-room' && json?.unwantedProperty === undefined,
        `Keys: ${Object.keys(json).join(', ')}`
      );
    }

    // --------------------------------------------------------------------------
    // Phase 7: High Concurrency Stress Test
    // --------------------------------------------------------------------------
    console.log('\n--- Phase 7: High Concurrency Stress Test ---');
    const CONCURRENT_REQUESTS = 50;
    const concurrentStart = Date.now();

    const tasks = Array.from({ length: CONCURRENT_REQUESTS }).map(async (_, idx) => {
      const isClinician = idx % 2 === 0;
      const role = isClinician ? 'clinician' : 'patient';
      const body = isClinician
        ? { role }
        : { role, sessionId: 'kine-concurrent-bench-room' };

      const tStart = Date.now();
      const res = await fetch(`${BASE_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const tDuration = Date.now() - tStart;
      const json = await res.json() as any;

      return {
        idx,
        status: res.status,
        uid: json?.uid,
        expectedUid: isClinician ? 'dr-demo' : 'pt-demo',
        sessionId: json?.sessionId,
        authToken: json?.authToken,
        tDuration
      };
    });

    const concurrentResults = await Promise.all(tasks);
    const totalConcurrentTime = Date.now() - concurrentStart;

    const allOk = concurrentResults.every((r) => r.status === 200);
    const allUidsCorrect = concurrentResults.every((r) => r.uid === r.expectedUid);
    const allTokensValid = concurrentResults.every(
      (r) => typeof r.authToken === 'string' && r.authToken.length > 5
    );
    const avgLatency = (
      concurrentResults.reduce((acc, r) => acc + r.tDuration, 0) / CONCURRENT_REQUESTS
    ).toFixed(2);

    record(
      `Concurrency: ${CONCURRENT_REQUESTS} Simultaneous POST /api/session Requests Succeeded (HTTP 200)`,
      allOk,
      `All 200: ${allOk}, Total elapsed: ${totalConcurrentTime}ms, Avg request: ${avgLatency}ms`
    );
    record(
      `Concurrency: Zero Role/UID Collisions Across ${CONCURRENT_REQUESTS} Concurrent Sessions`,
      allUidsCorrect,
      `25 dr-demo and 25 pt-demo correctly segregated`
    );
    record(
      `Concurrency: All AuthTokens Valid Under Concurrent Minting`,
      allTokensValid,
      `All tokens non-empty and well-formed`
    );

    // Concurrent Health Polling
    const healthTasks = Array.from({ length: 50 }).map(() => fetch(`${BASE_URL}/api/health`));
    const healthResponses = await Promise.all(healthTasks);
    const allHealthOk = healthResponses.every((r) => r.status === 200);
    record(
      'Concurrency: 50 Simultaneous GET /api/health Polls Succeeded',
      allHealthOk,
      `All 50 health checks returned HTTP 200`
    );

    // --------------------------------------------------------------------------
    // Phase 8: Invalid Route / Method Handling
    // --------------------------------------------------------------------------
    console.log('\n--- Phase 8: Invalid Route / Method Handling ---');
    {
      const resPostHealth = await fetch(`${BASE_URL}/api/health`, { method: 'POST' });
      record(
        'Routing: POST /api/health returns HTTP 404',
        resPostHealth.status === 404,
        `Status: ${resPostHealth.status}`
      );

      const resGetSession = await fetch(`${BASE_URL}/api/session`, { method: 'GET' });
      record(
        'Routing: GET /api/session returns HTTP 404',
        resGetSession.status === 404,
        `Status: ${resGetSession.status}`
      );

      const resUnknown = await fetch(`${BASE_URL}/api/nonexistent`);
      record(
        'Routing: GET /api/nonexistent returns HTTP 404',
        resUnknown.status === 404,
        `Status: ${resUnknown.status}`
      );
    }

  } finally {
    // Graceful shutdown of server process
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await sleep(300);
      serverProcess.kill('SIGKILL');
    }
  }

  // --------------------------------------------------------------------------
  // Phase 9: Secret Scan in Client Codebase
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 9: Secret Scan in Client Codebase ---');
  const clientSrcDir = path.join(PROJECT_ROOT, 'client', 'src');
  let secretFound = false;

  if (fs.existsSync(clientSrcDir)) {
    const walk = (dir: string) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const full = path.join(dir, file.name);
        if (file.isDirectory()) walk(full);
        else {
          const content = fs.readFileSync(full, 'utf8');
          if (/COMETCHAT_AUTH_KEY|COMETCHAT_REST|apiKey/i.test(content)) {
            secretFound = true;
            console.error(`Forbidden secret matched in ${full}`);
          }
        }
      }
    };
    walk(clientSrcDir);
  }
  record(
    'Secret Isolation Boundary: Zero Secret Keywords in client/src',
    !secretFound,
    secretFound ? 'Secret keyword found in client/src!' : 'Clean'
  );

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 CHALLENGE VERIFICATION SUMMARY                 ');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Assertions: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('================================================================');

  if (failed > 0) {
    console.error('\nFAILURES:');
    results.filter((r) => !r.passed).forEach((r) => console.error(`- ${r.name}: ${r.details}`));
    process.exit(1);
  } else {
    console.log('\nALL EMPIRICAL CHALLENGES PASSED SUCCESSFULLY.');
    process.exit(0);
  }
}

runEmpiricalChallenge().catch((err) => {
  console.error('Fatal challenge runner error:', err);
  process.exit(1);
});
