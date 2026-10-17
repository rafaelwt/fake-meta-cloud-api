const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'good_token';
process.env.APP_SECRET = 'inbound_secret';
process.env.SERVICE_WINDOW_ENFORCED = 'true';
process.env.DELAY_SENT_MIN = '1';
process.env.DELAY_SENT_MAX = '2';
process.env.DELAY_DELIVERED_MIN = '5';
process.env.DELAY_DELIVERED_MAX = '6';
process.env.READ_PROBABILITY = '0';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-inbound-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');

const received = [];
const receiver = http.createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    received.push({ body: JSON.parse(raw), signature: req.headers['x-hub-signature-256'] });
    res.end('ok');
  });
});

let app;
const auth = { authorization: 'Bearer good_token' };

test.before(async () => {
  await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve));
  process.env.WEBHOOK_URL = `http://127.0.0.1:${receiver.address().port}/`;
  const { createServer } = require('../src/server');
  app = createServer();
});

test.after(async () => {
  await app.close();
  receiver.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function statusesFor(messageId) {
  return received
    .map(r => r.body.entry[0].changes[0].value.statuses?.[0])
    .filter(s => s && s.id === messageId);
}

function sendText(to) {
  return app.inject({
    method: 'POST',
    url: '/v26.0/123/messages',
    headers: auth,
    payload: { messaging_product: 'whatsapp', to, type: 'text', text: { body: 'hi' } }
  });
}

test('simulate inbound requires a token', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/123/simulate/inbound',
    payload: { from: '+5491111111111', text: { body: 'hola' } }
  });

  assert.equal(res.statusCode, 401);
});

test('simulate inbound validates the body', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/123/simulate/inbound',
    headers: auth,
    payload: { text: { body: 'hola' } }
  });

  assert.equal(res.statusCode, 400);
});

test('simulate inbound sends a signed messages webhook like Meta', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/123/simulate/inbound',
    headers: auth,
    payload: { from: '+5491111111111', name: 'Ana', text: { body: 'hola' } }
  });

  assert.equal(res.statusCode, 200);
  const messageId = res.json().messages[0].id;
  assert.match(messageId, /^wamid\./);

  await wait(50);
  const hook = received.find(r => r.body.entry[0].changes[0].value.messages?.[0]?.id === messageId);
  assert.ok(hook, 'inbound webhook was not received');
  assert.match(hook.signature, /^sha256=[0-9a-f]{64}$/);

  const value = hook.body.entry[0].changes[0].value;
  assert.deepEqual(value.contacts, [{ profile: { name: 'Ana' }, wa_id: '5491111111111' }]);
  assert.equal(value.messages[0].from, '5491111111111');
  assert.equal(value.messages[0].type, 'text');
  assert.deepEqual(value.messages[0].text, { body: 'hola' });
  assert.match(value.messages[0].timestamp, /^\d+$/);
});

test('free-form message inside the window is delivered', async () => {
  const res = await sendText('+5491111111111');
  const messageId = res.json().messages[0].id;

  await wait(50);
  assert.deepEqual(statusesFor(messageId).map(s => s.status), ['sent', 'delivered']);
});

test('free-form message outside the window fails with 131047', async () => {
  const res = await sendText('+5492222222222');

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().messages[0].message_status, 'accepted');

  const messageId = res.json().messages[0].id;
  await wait(50);
  const failed = statusesFor(messageId).find(s => s.status === 'failed');
  assert.ok(failed, 'failed webhook was not received');
  assert.equal(failed.errors[0].code, 131047);
});

test('template message outside the window is delivered', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/123/messages',
    headers: auth,
    payload: {
      messaging_product: 'whatsapp',
      to: '+5493333333333',
      type: 'template',
      template: { name: 'promo', language: { code: 'es' } }
    }
  });
  const messageId = res.json().messages[0].id;

  await wait(50);
  assert.deepEqual(statusesFor(messageId).map(s => s.status), ['sent', 'delivered']);
});
