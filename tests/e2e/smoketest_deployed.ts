// tests/e2e/smoketest_deployed.ts
// Run: node --experimental-strip-types tests/e2e/smoketest_deployed.ts
// Or:  DEPLOYED_URL=https://kinesiolive.onrender.com node --experimental-strip-types tests/e2e/smoketest_deployed.ts

const BASE = (process.env.DEPLOYED_URL || 'http://localhost:5000').replace(/\/$/, '');
let passed = 0;
let failed = 0;

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e: any) {
    console.error(`  ❌ ${label} — ${e.message}`);
    failed++;
  }
}

async function run() {
  console.log(`\nKinesioLive Smoke Test → ${BASE}\n`);

  await check('GET /api/health returns 200', async () => {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/health`);
    const ms = Date.now() - t0;
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    if (ms > 5000) throw new Error(`Response took ${ms}ms (limit: 5000ms)`);
    const data = await res.json() as any;
    if (data.status !== 'ok') throw new Error(`status is "${data.status}", expected "ok"`);
  });

  await check('GET / returns HTML (SPA served)', async () => {
    const res = await fetch(`${BASE}/`);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes('<!DOCTYPE html') && !text.includes('<html')) {
      throw new Error('Response does not contain HTML');
    }
  });

  await check('POST /api/session clinician returns authToken + uid=dr-demo', async () => {
    const res = await fetch(`${BASE}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'clinician' }),
    });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    if (!data.authToken || data.authToken.length < 5) throw new Error('authToken missing or too short');
    if (data.uid !== 'dr-demo') throw new Error(`uid is "${data.uid}", expected "dr-demo"`);
  });

  await check('POST /api/session response does not leak COMETCHAT_AUTH_KEY value', async () => {
    const authKeyValue = process.env.COMETCHAT_AUTH_KEY;
    if (!authKeyValue) return; // Skip if not set in this environment
    const res = await fetch(`${BASE}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'clinician' }),
    });
    const body = await res.text();
    if (body.includes(authKeyValue)) throw new Error('COMETCHAT_AUTH_KEY value found in response body');
  });

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
