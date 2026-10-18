const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'default_token';
process.env.ADMIN_TOKEN = 'admin_token';
// Global flow is slow: overrides must win
process.env.DELAY_SENT_MIN = '5000';
process.env.DELAY_SENT_MAX = '5000';
process.env.DELAY_DELIVERED_MIN = '6000';
process.env.DELAY_DELIVERED_MAX = '6000';
process.env.DELAY_READ_MIN = '7000';
process.env.DELAY_READ_MAX = '7000';
process.env.READ_PROBABILITY = '0';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-flow-overrides-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');

const received = [];
const receiver = http.createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    received.push(JSON.parse(raw));
    res.end('ok');
  });
});

let app;
const admin = { authorization: 'Bearer admin_token' };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test.before(async () => {
  await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve));
  process.env.WEBHOOK_URL = `http://127.0.0.1:${receiver.address().port}/`;
  const { createServer } = require('../src/server');
  app = createServer();
});

test.after(async () => {
  require('../src/events/emitter').cancelAllFlows();
  await wait(50);
  await app.close();
  receiver.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

function statusesFor(messageId) {
  return received
    .map(body => body.entry[0].changes[0].value.statuses?.[0])
    .filter(s => s && s.id === messageId)
    .map(s => s.status);
}

async function send(phoneId, token, to = '+5491100000001') {
  const res = await app.inject({
    method: 'POST',
    url: `/v26.0/${phoneId}/messages`,
    headers: { authorization: `Bearer ${token}` },
    payload: { messaging_product: 'whatsapp', to, type: 'text', text: { body: 'hi' } }
  });
  assert.equal(res.statusCode, 200, res.body);
  return res.json().messages[0].id;
}

function forceStatus(phoneId, token, body) {
  return app.inject({
    method: 'POST',
    url: `/v26.0/${phoneId}/simulate/status`,
    headers: { authorization: `Bearer ${token}` },
    payload: body
  });
}

test('a tenant can override status delays and read probability', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/fake/tenants',
    headers: admin,
    payload: {
      phone_number_id: '555001',
      waba_id: '777001',
      access_token: 'token_a',
      status_delays: { sent: { min: 5, max: 10 }, delivered: { min: 20, max: 30 }, read: { min: 40, max: 50 } },
      read_probability: 1
    }
  });
  assert.equal(res.statusCode, 201, res.body);
  assert.deepEqual(res.json().status_delays, { sent: { min: 5, max: 10 }, delivered: { min: 20, max: 30 }, read: { min: 40, max: 50 } });
  assert.equal(res.json().read_probability, 1);

  const messageId = await send('555001', 'token_a');
  await wait(200);
  assert.deepEqual(statusesFor(messageId), ['sent', 'delivered', 'read']);
});

test('partial overrides keep the global values for the rest', async () => {
  await app.inject({
    method: 'POST',
    url: '/fake/tenants',
    headers: admin,
    payload: { phone_number_id: '555002', waba_id: '777001', access_token: 'token_b', status_delays: { sent: { min: 5, max: 10 } } }
  });

  const messageId = await send('555002', 'token_b');
  await wait(200);
  // sent uses the override; delivered keeps the slow global delay; read probability 0
  assert.deepEqual(statusesFor(messageId), ['sent']);
});

test('invalid overrides are rejected with code 100', async () => {
  for (const extra of [
    { read_probability: 2 },
    { status_delays: { sent: { min: 10, max: 5 } } },
    { status_delays: { sent: { min: -1, max: 5 } } },
    { status_delays: { bogus: { min: 1, max: 2 } } }
  ]) {
    const res = await app.inject({
      method: 'POST',
      url: '/fake/tenants',
      headers: admin,
      payload: { phone_number_id: '555003', waba_id: '777001', access_token: 'token_c', ...extra }
    });
    assert.equal(res.statusCode, 400, JSON.stringify(extra));
    assert.equal(res.json().error.code, 100);
  }
});

test('simulate/status forces a status now and cancels the pending flow', async () => {
  const messageId = await send('100100', 'default_token', '+5491100000002');

  const res = await forceStatus('100100', 'default_token', { message_id: messageId, status: 'read' });
  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(res.json(), { success: true });
  await wait(50);
  assert.deepEqual(statusesFor(messageId), ['read']);

  const stored = await app.inject({
    method: 'GET', url: `/v26.0/100100/webhooks/events?messageId=${messageId}`, headers: { authorization: 'Bearer default_token' }
  });
  assert.deepEqual(stored.json().events.map(e => e.event_type), ['read']);
});

test('simulate/status can fail a message with an error code', async () => {
  const messageId = await send('100100', 'default_token', '+5491100000003');

  const res = await forceStatus('100100', 'default_token', { message_id: messageId, status: 'failed', error_code: 131047 });
  assert.equal(res.statusCode, 200, res.body);
  await wait(50);

  const failed = received
    .map(body => body.entry[0].changes[0].value.statuses?.[0])
    .find(s => s && s.id === messageId);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.errors[0].code, 131047);
});

test('simulate/status only accepts messages sent by that number', async () => {
  const messageId = await send('100100', 'default_token', '+5491100000004');

  const otherNumber = await forceStatus('555001', 'token_a', { message_id: messageId, status: 'read' });
  assert.equal(otherNumber.statusCode, 400);
  assert.equal(otherNumber.json().error.code, 100);

  const unknown = await forceStatus('100100', 'default_token', { message_id: 'wamid.nope', status: 'read' });
  assert.equal(unknown.statusCode, 400);

  const badStatus = await forceStatus('100100', 'default_token', { message_id: messageId, status: 'accepted' });
  assert.equal(badStatus.statusCode, 400);

  const wrongToken = await forceStatus('100100', 'token_a', { message_id: messageId, status: 'read' });
  assert.equal(wrongToken.statusCode, 401);
});
