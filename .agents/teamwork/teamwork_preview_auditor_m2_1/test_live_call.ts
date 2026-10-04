import { upsertUser, mintAuthToken } from '../../../server/src/cometchatRest.js';

async function run() {
  process.env.COMETCHAT_APP_ID = '168428446858f07fb';
  process.env.COMETCHAT_REGION = 'IN';
  process.env.COMETCHAT_REST_API_KEY = '11111111111111111111111111111111';

  console.log('[AUDIT TEST] Calling upsertUser with 32-char key to verify real network call...');
  const res = await upsertUser('test-uid', 'Test User');
  console.log('[AUDIT TEST] Upsert result:', JSON.stringify(res));

  console.log('[AUDIT TEST] Calling mintAuthToken with 32-char key...');
  const token = await mintAuthToken('test-uid', 'kine-test');
  console.log('[AUDIT TEST] Token result:', token);
}

run().catch((err) => {
  console.error('[AUDIT TEST] Error:', err);
  process.exit(1);
});
