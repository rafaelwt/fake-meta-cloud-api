const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'good_token';
process.env.WEBHOOK_URL = 'http://127.0.0.1:9/';
process.env.DELAY_SENT_MIN = '1';
process.env.DELAY_SENT_MAX = '2';
process.env.DELAY_DELIVERED_MIN = '3';
process.env.DELAY_DELIVERED_MAX = '4';
process.env.READ_PROBABILITY = '0';
process.env.SYNC_ERROR_PATTERNS = '+11111:130429,+22222:131056,+33333:500,+66666:503,+55555:503x2';
process.env.RESPONSE_DELAY_PATTERNS = '+44444:300';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-sync-errors-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');

let app;
const auth = { authorization: 'Bearer good_token' };

test.before(() => {
  const { createServer } = require('../src/server');
  app = createServer();
});

test.after(async () => {
  // Let the accepted messages finish their webhook flow before closing the db
  await new Promise(resolve => setTimeout(resolve, 100));
  await app.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

function sendText(to) {
  return app.inject({
    method: 'POST',
    url: '/v26.0/123/messages',
    headers: auth,
    payload: { messaging_product: 'whatsapp', to, type: 'text', text: { body: 'hi' } }
  });
}

async function storedCount() {
  const res = await app.inject({ method: 'GET', url: '/v26.0/123/messages/stats', headers: auth });
  return res.json().total_messages;
}

test('throughput pattern answers 429 with code 130429 and stores nothing', async () => {
  const before = await storedCount();
  const res = await sendText('+5491111100');

  assert.equal(res.statusCode, 429);
  const { error } = res.json();
  assert.equal(error.code, 130429);
  assert.equal(error.type, 'OAuthException');
  assert.equal(error.message, '(#130429) Rate limit hit');
  assert.equal(error.error_data.messaging_product, 'whatsapp');
  assert.ok(error.fbtrace_id);
  assert.equal(await storedCount(), before);
});

test('pair rate limit pattern answers 400 with code 131056', async () => {
  const res = await sendText('+5492222200');
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error.code, 131056);
});

test('500 and 503 patterns answer transient server errors', async () => {
  const internal = await sendText('+5493333300');
  assert.equal(internal.statusCode, 500);
  assert.equal(internal.json().error.code, 1);
  assert.equal(internal.json().error.is_transient, true);

  const unavailable = await sendText('+5496666600');
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.json().error.code, 2);
  assert.equal(unavailable.json().error.is_transient, true);
});

test('xN pattern fails N times, then accepts, then starts over', async () => {
  const to = '+5495555500';
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await sendText(to)).statusCode);

  assert.deepEqual(statuses, [503, 503, 200, 503, 503, 200]);
});

test('xN counters are per recipient', async () => {
  assert.equal((await sendText('+5495555511')).statusCode, 503);
  assert.equal((await sendText('+5495555522')).statusCode, 503);
  assert.equal((await sendText('+5495555511')).statusCode, 503);
  assert.equal((await sendText('+5495555511')).statusCode, 200);
});

test('response delay pattern answers after the configured time', async () => {
  const start = Date.now();
  const res = await sendText('+5494444400');

  assert.equal(res.statusCode, 200);
  assert.ok(Date.now() - start >= 290, `answered after ${Date.now() - start} ms`);
});

test('numbers without a pattern are accepted as before', async () => {
  const res = await sendText('+5490000000');
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().messages[0].message_status, 'accepted');
});

test('template validation is off by default: any template name is accepted', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/123/messages',
    headers: auth,
    payload: { messaging_product: 'whatsapp', to: '+5490000001', type: 'template', template: { name: 'not_created', language: { code: 'es' } } }
  });
  assert.equal(res.statusCode, 200);
});
