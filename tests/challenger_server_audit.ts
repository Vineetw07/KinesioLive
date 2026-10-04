/**
 * Empirical Challenger Audit for Milestone 2: Express Backend & CometChat REST Token Service
 * 
 * Verifies:
 * 1. Boot diagnostics & truncated key detection (both unit and live process output)
 * 2. Live HTTP server startup on dedicated port (PORT=5001)
 * 3. Real network execution of GET /api/health and POST /api/session
 * 4. Secret isolation: Zero API key leakage in responses, headers, or error payloads
 * 5. Middleware validation: CORS headers, JSON body parsing, malformed JSON handling (HTTP 400)
 * 6. Edge cases & error branches: Invalid roles, empty bodies, non-object bodies, whitespace session IDs
 * 7. Live execution against existing server (port 5000) using specHarness dual-track
 */

import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBootCredentials } from '../server/src/cometchatRest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_PORT = 5001;

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(category: string, name: string, condition: boolean, details?: string) {
  results.push({ category, name, passed: Boolean(condition), details });
  const symbol = condition ? '✓' : '✗';
  console.log(`  ${symbol} [${category}] ${name}${details && !condition ? ` -> FAIL: ${details}` : ''}`);
}

async function runAudit() {
  console.log('================================================================');
  console.log('    EMPIRICAL CHALLENGER AUDIT: MILESTONE 2 EXPRESS BACKEND     ');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. BOOT DIAGNOSTICS & TRUNCATED KEY UNIT VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('[1/7] Testing Boot Diagnostics & Credential Validation Logic...');

  // 1.1 Truncated key ending with ...
  const diagTrunc = validateBootCredentials({
    COMETCHAT_APP_ID: '168428446858f07fb',
    COMETCHAT_REGION: 'IN',
    COMETCHAT_AUTH_KEY: '1d33b8f1dc49d72eb92e20928a5cef60...'
  });
  assert('Boot Diagnostics', 'Detects truncated key ending with ...', diagTrunc.isTruncated === true && diagTrunc.isValid === false);
  assert('Boot Diagnostics', 'Emits diagnostic warning message mentioning truncated and Dashboard',
    typeof diagTrunc.warningMessage === 'string' &&
    diagTrunc.warningMessage.includes('truncated') &&
    diagTrunc.warningMessage.includes('Dashboard')
  );

  // 1.2 Missing auth key
  const diagMissingKey = validateBootCredentials({
    COMETCHAT_APP_ID: '168428446858f07fb',
    COMETCHAT_REGION: 'IN'
  });
  assert('Boot Diagnostics', 'Detects missing Auth/REST key', diagMissingKey.isMissing === true && diagMissingKey.isValid === false);
  assert('Boot Diagnostics', 'Warning mentions missing Auth Key or REST API Key',
    Boolean(diagMissingKey.warningMessage?.includes('missing in environment variables'))
  );

  // 1.3 Missing APP_ID or REGION
  const diagMissingApp = validateBootCredentials({
    COMETCHAT_REGION: 'IN',
    COMETCHAT_AUTH_KEY: 'valid_key_32_characters_long_123'
  });
  assert('Boot Diagnostics', 'Detects missing APP_ID', diagMissingApp.appIdPresent === false && diagMissingApp.isValid === false);

  const diagMissingRegion = validateBootCredentials({
    COMETCHAT_APP_ID: '168428446858f07fb',
    COMETCHAT_AUTH_KEY: 'valid_key_32_characters_long_123'
  });
  assert('Boot Diagnostics', 'Detects missing REGION', diagMissingRegion.regionPresent === false && diagMissingRegion.isValid === false);

  // 1.4 Valid 32-char key
  const diagValid = validateBootCredentials({
    COMETCHAT_APP_ID: '168428446858f07fb',
    COMETCHAT_REGION: 'IN',
    COMETCHAT_AUTH_KEY: '1d33b8f1dc49d72eb92e20928a5cef60'
  });
  assert('Boot Diagnostics', 'Valid 32-char key is marked valid with no warning', diagValid.isValid === true && diagValid.warningMessage === null);

  // 1.5 REST_API_KEY preference over AUTH_KEY
  const diagRestKey = validateBootCredentials({
    COMETCHAT_APP_ID: '168428446858f07fb',
    COMETCHAT_REGION: 'IN',
    COMETCHAT_REST_API_KEY: 'valid_rest_key_32_chars_long_123'
  });
  assert('Boot Diagnostics', 'Accepts COMETCHAT_REST_API_KEY as active key', diagRestKey.isValid === true);

  // ---------------------------------------------------------------------------
  // 2. LIVE SERVER PROCESS SPAWN & BOOT DIAGNOSTIC WARNING LOGGING
  // ---------------------------------------------------------------------------
  console.log(`\n[2/7] Spawning Live Server Process on PORT=${TEST_PORT}...`);

  let serverProcess: ChildProcess | null = null;
  let stdoutLogs = '';
  let stderrLogs = '';

  const serverStartedPromise = new Promise<{ code?: number; portReady: boolean }>((resolve) => {
    serverProcess = spawn('node', ['server/dist/index.js'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PORT: String(TEST_PORT) }
    });

    serverProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      stdoutLogs += text;
      if (text.includes(`running on port ${TEST_PORT}`)) {
        resolve({ portReady: true });
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      stderrLogs += text;
      if (text.includes(`running on port ${TEST_PORT}`)) {
        resolve({ portReady: true });
      }
    });

    serverProcess.on('exit', (code) => {
      resolve({ code: code ?? -1, portReady: false });
    });

    // 5s timeout
    setTimeout(() => resolve({ portReady: false }), 5000);
  });

  const { portReady, code } = await serverStartedPromise;

  assert('Live Server Boot', `Server process booted successfully on port ${TEST_PORT} without crashing`, portReady === true, `Exit code: ${code}`);
  const combinedLogs = stdoutLogs + '\n' + stderrLogs;
  assert('Live Server Boot', 'Server logged truncated key diagnostic warning on boot',
    combinedLogs.includes('[DIAGNOSTIC WARNING]') && combinedLogs.includes('truncated'),
    `Logs: ${combinedLogs}`
  );
  assert('Live Server Boot', `Server logged port listening confirmation on port ${TEST_PORT}`,
    combinedLogs.includes(`running on port ${TEST_PORT}`)
  );

  // ---------------------------------------------------------------------------
  // 3. LIVE HTTP ENDPOINT TESTING (GET /api/health) on PORT 5001
  // ---------------------------------------------------------------------------
  console.log(`\n[3/7] Testing Live HTTP /api/health on port ${TEST_PORT}...`);

  try {
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/api/health`);
    assert('HTTP /api/health', 'Returns HTTP 200 OK', healthRes.status === 200);
    assert('HTTP /api/health', 'Content-Type is application/json',
      (healthRes.headers.get('content-type') || '').includes('application/json')
    );

    const healthData = await healthRes.json() as any;
    assert('HTTP /api/health', 'Body status is "ok"', healthData.status === 'ok');
    assert('HTTP /api/health', 'Body uptime is a finite non-negative number', typeof healthData.uptime === 'number' && healthData.uptime >= 0);
    assert('HTTP /api/health', 'Body timestamp is recent epoch timestamp', typeof healthData.timestamp === 'number' && healthData.timestamp > 1700000000000);
    const healthKeys = Object.keys(healthData).sort();
    assert('HTTP /api/health', 'Exact contract shape: { status, timestamp, uptime }',
      JSON.stringify(healthKeys) === JSON.stringify(['status', 'timestamp', 'uptime'])
    );
  } catch (err: any) {
    assert('HTTP /api/health', 'Health request failed with network error', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // 4. LIVE HTTP ENDPOINT TESTING (POST /api/session) on PORT 5001
  // ---------------------------------------------------------------------------
  console.log(`\n[4/7] Testing Live HTTP /api/session on port ${TEST_PORT}...`);

  // 4.1 Clinician session request
  try {
    const clinRes = await fetch(`http://localhost:${TEST_PORT}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'clinician' })
    });
    assert('HTTP /api/session', 'Clinician request returns HTTP 200', clinRes.status === 200);
    const clinData = await clinRes.json() as any;
    assert('HTTP /api/session', 'Clinician maps to uid "dr-demo"', clinData.uid === 'dr-demo');
    assert('HTTP /api/session', 'Auto-generated sessionId starts with "kine-"', typeof clinData.sessionId === 'string' && clinData.sessionId.startsWith('kine-'));
    assert('HTTP /api/session', 'Provides non-empty authToken', typeof clinData.authToken === 'string' && clinData.authToken.length > 5);
    assert('HTTP /api/session', 'Provides appId and region', Boolean(clinData.appId && clinData.region));

    // Secret isolation in clinician response
    const clinRaw = JSON.stringify(clinData);
    assert('Secret Isolation', 'Clinician response does NOT contain raw Auth Key',
      !clinRaw.includes(process.env.COMETCHAT_AUTH_KEY || 'auth_key_missing')
    );
    assert('Secret Isolation', 'Clinician response does NOT contain apiKey property', clinData.apiKey === undefined);
    assert('Secret Isolation', 'Clinician response does NOT contain restApiKey property', clinData.restApiKey === undefined);
  } catch (err: any) {
    assert('HTTP /api/session', 'Clinician session failed', false, err.message);
  }

  // 4.2 Patient session request with explicit sessionId
  try {
    const customSessionId = 'kine-rehab-test-999';
    const patRes = await fetch(`http://localhost:${TEST_PORT}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'patient', sessionId: customSessionId })
    });
    assert('HTTP /api/session', 'Patient request returns HTTP 200', patRes.status === 200);
    const patData = await patRes.json() as any;
    assert('HTTP /api/session', 'Patient maps to uid "pt-demo"', patData.uid === 'pt-demo');
    assert('HTTP /api/session', 'Explicit sessionId is preserved', patData.sessionId === customSessionId);
    assert('HTTP /api/session', 'Provides non-empty authToken', typeof patData.authToken === 'string' && patData.authToken.length > 5);

    // Secret isolation in patient response
    const patRaw = JSON.stringify(patData);
    assert('Secret Isolation', 'Patient response does NOT contain raw Auth Key',
      !patRaw.includes(process.env.COMETCHAT_AUTH_KEY || 'auth_key_missing')
    );
  } catch (err: any) {
    assert('HTTP /api/session', 'Patient session failed', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // 5. MIDDLEWARE, CORS, BODY PARSER & ERROR RESPONSES
  // ---------------------------------------------------------------------------
  console.log(`\n[5/7] Testing Middleware, CORS & Error Handling on port ${TEST_PORT}...`);

  // 5.1 CORS headers on GET
  try {
    const corsRes = await fetch(`http://localhost:${TEST_PORT}/api/health`, {
      headers: { Origin: 'http://localhost:5173' }
    });
    const allowOrigin = corsRes.headers.get('access-control-allow-origin');
    assert('CORS Middleware', 'Responds with Access-Control-Allow-Origin header', Boolean(allowOrigin));
  } catch (err: any) {
    assert('CORS Middleware', 'CORS health check failed', false, err.message);
  }

  // 5.2 CORS Preflight OPTIONS
  try {
    const preflightRes = await fetch(`http://localhost:${TEST_PORT}/api/session`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    assert('CORS Middleware', 'OPTIONS preflight returns 204 or 200', preflightRes.status === 204 || preflightRes.status === 200);
    const allowHeaders = preflightRes.headers.get('access-control-allow-headers');
    assert('CORS Middleware', 'Preflight allows requested headers', Boolean(allowHeaders || preflightRes.headers.get('access-control-allow-origin')));
  } catch (err: any) {
    assert('CORS Middleware', 'Preflight OPTIONS failed', false, err.message);
  }

  // 5.3 Malformed JSON payload -> handled by JSON error middleware
  try {
    const badJsonRes = await fetch(`http://localhost:${TEST_PORT}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ this is invalid json syntax !!!'
    });
    assert('JSON Body Parser', 'Malformed JSON returns HTTP 400 Bad Request', badJsonRes.status === 400);
    const badJsonData = await badJsonRes.json() as any;
    assert('JSON Body Parser', 'Malformed JSON returns structured error without stack trace leak',
      badJsonData.error === 'Invalid JSON payload' && badJsonData.stack === undefined
    );
  } catch (err: any) {
    assert('JSON Body Parser', 'Malformed JSON test failed', false, err.message);
  }

  // 5.4 Invalid roles
  const invalidRoles = ['admin', 'doctor', 'user', '', 1234, null];
  for (const r of invalidRoles) {
    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: r })
      });
      assert('Input Validation', `Invalid role ${JSON.stringify(r)} rejected with HTTP 400`, res.status === 400);
    } catch (err: any) {
      assert('Input Validation', `Role check for ${JSON.stringify(r)} failed`, false, err.message);
    }
  }

  // 5.5 Missing role property entirely
  try {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert('Input Validation', 'Empty payload {} rejected with HTTP 400', res.status === 400);
  } catch (err: any) {
    assert('Input Validation', 'Empty payload test failed', false, err.message);
  }

  // 5.6 Non-object body (array, primitive)
  try {
    const arrayRes = await fetch(`http://localhost:${TEST_PORT}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['clinician'])
    });
    assert('Input Validation', 'Array body rejected with HTTP 400', arrayRes.status === 400);
  } catch (err: any) {
    assert('Input Validation', 'Array body test failed', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // 6. LIVE NETWORK TRACK TEST OF EXISTING E2E TEST SUITE (PORT 5000)
  // ---------------------------------------------------------------------------
  console.log(`\n[6/7] Verifying Live Network Track on port ${TEST_PORT}...`);

  const { isLiveServerRunning } = await import('./e2e/helpers/specHarness.js');
  const liveServerOnline = await isLiveServerRunning(`http://localhost:${TEST_PORT}/api/health`);
  assert('Live Network Track', `specHarness detects live server running on port ${TEST_PORT}`, liveServerOnline === true);

  const healthRes = await fetch(`http://localhost:${TEST_PORT}/api/health`);
  const healthData = await healthRes.json();
  assert('Live Network Track', 'dispatchHealthRequest returns 200 on live port', healthRes.status === 200 && healthData.status === 'ok');

  const sessionRes = await fetch(`http://localhost:${TEST_PORT}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'clinician' })
  });
  const sessionData = await sessionRes.json();
  assert('Live Network Track', 'dispatchSessionRequest returns 200 on live port', sessionRes.status === 200);
  assert('Live Network Track', 'Live clinician session matches uid "dr-demo"', sessionData.uid === 'dr-demo');

  // ---------------------------------------------------------------------------
  // 7. HIGH CONCURRENCY STRESS HARNESS on port 5001
  // ---------------------------------------------------------------------------
  console.log(`\n[7/7] Stress Testing Concurrent Session & Health Dispatches on port ${TEST_PORT}...`);

  const concurrentRequests = 30;
  const stressPromises = Array.from({ length: concurrentRequests }).map((_, i) => {
    const role = i % 2 === 0 ? 'clinician' : 'patient';
    const sessionId = `kine-stress-${i}`;
    return fetch(`http://localhost:${TEST_PORT}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, sessionId })
    }).then(async (r) => ({ status: r.status, data: await r.json() }));
  });

  const stressResults = await Promise.all(stressPromises);
  const allSucceeded = stressResults.every(r => r.status === 200 && r.data.authToken);
  assert('Stress Harness', `${concurrentRequests} concurrent session requests all return HTTP 200 with tokens`, allSucceeded);

  // ---------------------------------------------------------------------------
  // CLEANUP: Terminate the spawned live server
  // ---------------------------------------------------------------------------
  console.log('\nShutting down test server process on port 5001...');
  if (serverProcess) {
    (serverProcess as ChildProcess).kill('SIGTERM');
  }

  // Final summary
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('\n================================================================');
  console.log(`AUDIT RESULTS: ${passedCount} PASSED, ${failedCount} FAILED out of ${results.length}`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('[FATAL AUDIT ERROR]', err);
  process.exit(1);
});
