import { app } from '../../../server/src/index.js';
import http from 'node:http';

async function main() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[STRESS TEST] Test server listening on ${baseUrl}`);

  let passes = 0;
  let fails = 0;

  function assert(desc: string, cond: boolean) {
    if (cond) {
      console.log(`  PASS: ${desc}`);
      passes++;
    } else {
      console.error(`  FAIL: ${desc}`);
      fails++;
    }
  }

  // 1. Health endpoint concurrent polling
  console.log('\n--- 1. Testing GET /api/health ---');
  const healthPromises = Array.from({ length: 30 }, () =>
    fetch(`${baseUrl}/api/health`).then(async (r) => {
      const json = await r.json();
      return { status: r.status, json, contentType: r.headers.get('content-type') };
    })
  );
  const healthResults = await Promise.all(healthPromises);
  assert('All 30 concurrent health calls returned HTTP 200', healthResults.every(r => r.status === 200));
  assert('All health calls returned status "ok"', healthResults.every(r => r.json.status === 'ok'));
  assert('All health calls returned numeric uptime & timestamp', healthResults.every(r => typeof r.json.uptime === 'number' && typeof r.json.timestamp === 'number'));
  assert('Content-type is application/json', healthResults.every(r => r.contentType?.includes('application/json')));

  // 2. POST /api/session input validation & edge cases
  console.log('\n--- 2. Testing POST /api/session Validation ---');
  
  // Empty body
  const emptyRes = await fetch(`${baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert('Empty body returns HTTP 400', emptyRes.status === 400);

  // Invalid roles
  for (const badRole of ['admin', 'superadmin', 'doctor', '', null, 123, true]) {
    const res = await fetch(`${baseUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: badRole })
    });
    assert(`Invalid role "${badRole}" returns HTTP 400`, res.status === 400);
  }

  // Array body
  const arrayRes = await fetch(`${baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ role: 'clinician' }])
  });
  assert('Array body returns HTTP 400', arrayRes.status === 400);

  // 3. POST /api/session valid flows
  console.log('\n--- 3. Testing POST /api/session Happy Paths ---');
  
  // Clinician without sessionId
  const clinRes = await fetch(`${baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'clinician' })
  });
  assert('Clinician session returns HTTP 200', clinRes.status === 200);
  const clinData = await clinRes.json();
  assert('Clinician UID is "dr-demo"', clinData.uid === 'dr-demo');
  assert('Generated sessionId starts with "kine-"', typeof clinData.sessionId === 'string' && clinData.sessionId.startsWith('kine-'));
  assert('Auth token is non-empty string', typeof clinData.authToken === 'string' && clinData.authToken.length > 5);
  assert('AppId and region match env or config', clinData.appId === '168428446858f07fb' && clinData.region === 'IN');

  // Patient with existing sessionId
  const ptRes = await fetch(`${baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'patient', sessionId: clinData.sessionId })
  });
  assert('Patient session returns HTTP 200', ptRes.status === 200);
  const ptData = await ptRes.json();
  assert('Patient UID is "pt-demo"', ptData.uid === 'pt-demo');
  assert('Patient session matches clinician sessionId', ptData.sessionId === clinData.sessionId);
  assert('Patient auth token is non-empty string', typeof ptData.authToken === 'string' && ptData.authToken.length > 5);

  // 4. Secret leakage in payload
  console.log('\n--- 4. Secret Leakage Verification ---');
  const serializedClin = JSON.stringify(clinData);
  const serializedPt = JSON.stringify(ptData);
  assert('Clinician response does not contain COMETCHAT_AUTH_KEY', !serializedClin.includes(process.env.COMETCHAT_AUTH_KEY || ''));
  assert('Patient response does not contain COMETCHAT_AUTH_KEY', !serializedPt.includes(process.env.COMETCHAT_AUTH_KEY || ''));
  assert('Response does not contain "apiKey" key', !Object.keys(clinData).includes('apiKey') && !Object.keys(ptData).includes('apiKey'));
  assert('Response does not contain "authKey" key', !Object.keys(clinData).includes('authKey') && !Object.keys(ptData).includes('authKey'));

  // 5. Concurrency stress test
  console.log('\n--- 5. Concurrency Stress Test (20 parallel session requests) ---');
  const concurrentSessionRequests = Array.from({ length: 20 }, (_, i) =>
    fetch(`${baseUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: i % 2 === 0 ? 'clinician' : 'patient', sessionId: `stress-session-${i}` })
    }).then(r => r.json())
  );
  const concurrentResults = await Promise.all(concurrentSessionRequests);
  assert('All 20 concurrent session calls succeeded', concurrentResults.every(r => r.sessionId && r.authToken && r.uid));

  server.close();
  console.log(`\n========================================`);
  console.log(`TOTAL PASSES: ${passes}, FAILS: ${fails}`);
  console.log(`========================================\n`);

  if (fails > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
