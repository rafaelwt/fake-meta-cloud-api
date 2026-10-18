const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'default_token';
process.env.ADMIN_TOKEN = 'admin_token';
process.env.PHONE_NUMBER_ID = '100100';
process.env.WABA_ID = '200200';
process.env.WEBHOOK_URL = 'http://127.0.0.1:9/';
process.env.TEMPLATE_REVIEW_DELAY_MS = '100000';
process.env.DELAY_SENT_MIN = '1';
process.env.DELAY_SENT_MAX = '2';
process.env.DELAY_DELIVERED_MIN = '3';
process.env.DELAY_DELIVERED_MAX = '4';
process.env.READ_PROBABILITY = '0';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-reset-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');

let app;
const admin = { authorization: 'Bearer admin_token' };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test.before(() => {
  const { createServer } = require('../src/server');
  app = createServer();
});

test.after(async () => {
  await wait(50);
  await app.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

function raw(sql, ...params) {
  const Database = require('better-sqlite3');
  const db = new Database(process.env.DB_PATH, { readonly: true });
  try {
    return db.prepare(sql).get(...params);
  } finally {
    db.close();
  }
}

const count = (table, column, value) => raw(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`, value).n;

async function seedActivity(phoneId, token) {
  const headers = { authorization: `Bearer ${token}` };
  await app.inject({
    method: 'POST', url: `/v26.0/${phoneId}/messages`, headers,
    payload: { messaging_product: 'whatsapp', to: '+5491100000001', type: 'text', text: { body: 'hi' } }
  });
  await app.inject({
    method: 'POST', url: `/v26.0/${phoneId}/simulate/inbound`, headers,
    payload: { from: '5491100000002', text: { body: 'hola' } }
  });
  await wait(30);
}

function reset(body, headers = admin) {
  return app.inject({ method: 'POST', url: '/fake/reset', headers, payload: body });
}

test('reset requires ADMIN_TOKEN', async () => {
  assert.equal((await reset({ phone_number_id: '100100' }, {})).statusCode, 401);
  assert.equal((await reset({ phone_number_id: '100100' }, { authorization: 'Bearer default_token' })).statusCode, 401);
});

test('reset by phone number clears only that number', async () => {
  await seedActivity('100100', 'default_token');
  await seedActivity('300300', 'default_token');
  assert.ok(count('messages', 'waba_id', '100100') > 0);
  assert.ok(count('webhook_events', 'message_id', raw("SELECT id FROM messages WHERE waba_id = '100100'").id) > 0);

  const res = await reset({ phone_number_id: '100100' });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.deleted.messages, 1);
  assert.equal(body.deleted.inbound_messages, 1);
  assert.ok(body.deleted.webhook_events >= 1);

  assert.equal(count('messages', 'waba_id', '100100'), 0);
  assert.equal(count('inbound_messages', 'waba_id', '100100'), 0);
  assert.equal(count('messages', 'waba_id', '300300'), 1);
  assert.equal(count('inbound_messages', 'waba_id', '300300'), 1);
});

test('reset by WABA clears its templates and its numbers, then seeds come back', async () => {
  await app.inject({
    method: 'POST',
    url: '/v26.0/200200/message_templates',
    headers: { authorization: 'Bearer default_token' },
    payload: { name: 'to_reset', language: 'en_US', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hi' }] }
  });
  await seedActivity('100100', 'default_token');
  assert.equal(count('message_templates', 'waba_id', '200200'), 5);

  const res = await reset({ waba_id: '200200' });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json().deleted.templates, 5);
  assert.equal(res.json().deleted.messages, 1);
  assert.equal(count('message_templates', 'waba_id', '200200'), 0);
  assert.equal(count('messages', 'waba_id', '100100'), 0);

  const list = await app.inject({
    method: 'GET', url: '/v26.0/200200/message_templates?fields=name', headers: { authorization: 'Bearer default_token' }
  });
  assert.deepEqual(list.json().data.map(t => t.name).sort(), ['hello_world', 'order_update', 'promo_image', 'welcome_named']);
});

test('reset by WABA includes registered numbers of that WABA, and keeps the registry', async () => {
  await app.inject({
    method: 'POST', url: '/fake/tenants', headers: admin,
    payload: { phone_number_id: '555001', waba_id: '777001', access_token: 'token_a' }
  });
  await seedActivity('555001', 'token_a');

  const res = await reset({ waba_id: '777001' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().deleted.messages, 1);
  assert.equal(count('messages', 'waba_id', '555001'), 0);
  assert.equal(count('tenants', 'phone_number_id', '555001'), 1);
});

test('reset needs exactly one of phone_number_id or waba_id', async () => {
  for (const body of [{}, { phone_number_id: '1', waba_id: '2' }, { phone_number_id: 'abc' }]) {
    const res = await reset(body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(res.json().error.code, 100);
  }
});

test('reset during a pending status flow cancels it and keeps the server alive', async () => {
  const http = require('node:http');
  const hooks = [];
  const receiver = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => { hooks.push(JSON.parse(raw)); res.end('ok'); });
  });
  await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve));

  await app.inject({
    method: 'POST', url: '/fake/tenants', headers: admin,
    payload: {
      phone_number_id: '555010', waba_id: '777010', access_token: 'token_r',
      webhook_url: `http://127.0.0.1:${receiver.address().port}/`,
      status_delays: { sent: { min: 60, max: 60 }, delivered: { min: 80, max: 80 }, read: { min: 90, max: 90 } },
      read_probability: 1
    }
  });

  const sent = await app.inject({
    method: 'POST', url: '/v26.0/555010/messages', headers: { authorization: 'Bearer token_r' },
    payload: { messaging_product: 'whatsapp', to: '+5491100000003', type: 'text', text: { body: 'hi' } }
  });
  assert.equal(sent.statusCode, 200);

  const res = await reset({ phone_number_id: '555010' });
  assert.equal(res.statusCode, 200);
  await wait(200);
  receiver.close();

  assert.equal(hooks.length, 0, 'statuses were sent after the reset');
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);
});

test('reset by an unregistered WABA ID also clears messages sent from that ID', async () => {
  await seedActivity('888888', 'default_token');
  assert.equal(count('messages', 'waba_id', '888888'), 1);

  const res = await reset({ waba_id: '888888' });
  assert.equal(res.statusCode, 200);
  assert.equal(count('messages', 'waba_id', '888888'), 0);
});
