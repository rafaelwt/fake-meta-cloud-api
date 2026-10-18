const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'default_token';
process.env.APP_SECRET = 'default_secret';
process.env.PHONE_NUMBER_ID = '100100';
process.env.WABA_ID = '200200';
process.env.DISPLAY_PHONE_NUMBER = '+10000000000';
process.env.ADMIN_TOKEN = 'admin_token';
process.env.TEMPLATE_VALIDATION_ENFORCED = 'true';
process.env.TEMPLATE_REVIEW_DELAY_MS = '20';
process.env.DELAY_SENT_MIN = '1';
process.env.DELAY_SENT_MAX = '2';
process.env.DELAY_DELIVERED_MIN = '3';
process.env.DELAY_DELIVERED_MAX = '4';
process.env.READ_PROBABILITY = '0';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-tenants-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');

function receiver() {
  const received = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      received.push({ raw, body: JSON.parse(raw), signature: req.headers['x-hub-signature-256'] });
      res.end('ok');
    });
  });
  return { server, received };
}

const defaultHook = receiver();
const tenantHook = receiver();
let app;
let tenantUrl;

const admin = { authorization: 'Bearer admin_token' };
const tenantA = {
  phone_number_id: '555001',
  waba_id: '777001',
  display_phone_number: '+5491155550001',
  verified_name: 'Tenant A',
  access_token: 'token_a',
  app_secret: 'secret_a'
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const sign = (raw, secret) => 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');

test.before(async () => {
  await new Promise(resolve => defaultHook.server.listen(0, '127.0.0.1', resolve));
  await new Promise(resolve => tenantHook.server.listen(0, '127.0.0.1', resolve));
  process.env.WEBHOOK_URL = `http://127.0.0.1:${defaultHook.server.address().port}/`;
  tenantUrl = `http://127.0.0.1:${tenantHook.server.address().port}/hook`;
  const { createServer } = require('../src/server');
  app = createServer();
});

test.after(async () => {
  await wait(100);
  await app.close();
  defaultHook.server.close();
  tenantHook.server.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

function registerTenant(body, headers = admin) {
  return app.inject({ method: 'POST', url: '/fake/tenants', headers, payload: body });
}

function sendText(sender, token, to = '+5491100000001') {
  return app.inject({
    method: 'POST',
    url: `/v26.0/${sender}/messages`,
    headers: { authorization: `Bearer ${token}` },
    payload: { messaging_product: 'whatsapp', to, type: 'text', text: { body: 'hi' } }
  });
}

test('admin endpoints require ADMIN_TOKEN', async () => {
  const missing = await registerTenant({ ...tenantA, webhook_url: tenantUrl }, {});
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.json().error.code, 2500);

  const wrong = await registerTenant({ ...tenantA, webhook_url: tenantUrl }, { authorization: 'Bearer default_token' });
  assert.equal(wrong.statusCode, 401);
  assert.equal(wrong.json().error.code, 190);
});

test('registering a tenant stores it and never echoes secrets', async () => {
  const res = await registerTenant({ ...tenantA, webhook_url: tenantUrl });

  assert.equal(res.statusCode, 201, res.body);
  const body = res.json();
  assert.equal(body.phone_number_id, '555001');
  assert.equal(body.waba_id, '777001');
  assert.equal(body.webhook_url, tenantUrl);
  assert.equal(body.access_token, undefined);
  assert.equal(body.app_secret, undefined);

  const list = await app.inject({ method: 'GET', url: '/fake/tenants', headers: admin });
  assert.equal(list.statusCode, 200);
  const stored = list.json().data.find(t => t.phone_number_id === '555001');
  assert.ok(stored);
  assert.equal(stored.access_token, undefined);

  // Persisted in SQLite (survives restarts)
  const Database = require('better-sqlite3');
  const raw = new Database(process.env.DB_PATH, { readonly: true });
  const row = raw.prepare('SELECT * FROM tenants WHERE phone_number_id = ?').get('555001');
  raw.close();
  assert.equal(row.access_token, 'token_a');
});

test('invalid tenant bodies return code 100', async () => {
  for (const body of [
    { ...tenantA, phone_number_id: 'abc', webhook_url: tenantUrl },
    { ...tenantA, webhook_url: 'not a url' },
    { waba_id: '1', access_token: 'x' }
  ]) {
    const res = await registerTenant(body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(res.json().error.code, 100);
  }
});

test('a registered number only accepts its own token', async () => {
  assert.equal((await sendText('555001', 'token_a')).statusCode, 200);

  const withDefault = await sendText('555001', 'default_token');
  assert.equal(withDefault.statusCode, 401);
  assert.equal(withDefault.json().error.code, 190);

  const oauth = await app.inject({
    method: 'GET', url: '/v26.0/555001/messages/stats', headers: { authorization: 'OAuth token_a' }
  });
  assert.equal(oauth.statusCode, 200);
});

test('unregistered numbers keep using API_ACCESS_TOKEN', async () => {
  assert.equal((await sendText('100100', 'default_token')).statusCode, 200);
  assert.equal((await sendText('123', 'default_token')).statusCode, 200);
  assert.equal((await sendText('123', 'token_a')).statusCode, 401);
});

test('WABA routes accept the token of a number in that WABA', async () => {
  const list = token => app.inject({
    method: 'GET', url: '/v26.0/777001/message_templates', headers: { authorization: `Bearer ${token}` }
  });
  assert.equal((await list('token_a')).statusCode, 200);
  assert.equal((await list('default_token')).statusCode, 401);

  const defaultWaba = await app.inject({
    method: 'GET', url: '/v26.0/200200/message_templates', headers: { authorization: 'Bearer token_a' }
  });
  assert.equal(defaultWaba.statusCode, 401);
});

test('uploads accept any registered token', async () => {
  const session = await app.inject({
    method: 'POST',
    url: '/v26.0/999/uploads?file_length=3&file_type=image/png',
    headers: { authorization: 'Bearer token_a' }
  });
  assert.equal(session.statusCode, 200);

  const bytes = await app.inject({
    method: 'POST',
    url: `/v26.0/${session.json().id}`,
    headers: { authorization: 'OAuth token_a', file_offset: '0' },
    payload: Buffer.from('abc')
  });
  assert.equal(bytes.statusCode, 200, bytes.body);
});

test('phone number node returns the tenant profile', async () => {
  const res = await app.inject({ method: 'GET', url: '/v26.0/555001', headers: { authorization: 'Bearer token_a' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().display_phone_number, '+5491155550001');
  assert.equal(res.json().verified_name, 'Tenant A');
});

test('status webhooks go to the tenant URL, signed with its secret and its metadata', async () => {
  const messageId = (await sendText('555001', 'token_a', '+5491100000099')).json().messages[0].id;
  await wait(80);

  const hooks = tenantHook.received.filter(r => r.body.entry[0].changes[0].value.statuses?.[0]?.id === messageId);
  assert.ok(hooks.length >= 2, `got ${hooks.length} tenant webhooks`);
  for (const hook of hooks) {
    assert.equal(hook.signature, sign(hook.raw, 'secret_a'));
    assert.equal(hook.body.entry[0].id, '777001');
    assert.deepEqual(hook.body.entry[0].changes[0].value.metadata, {
      display_phone_number: '+5491155550001',
      phone_number_id: '555001'
    });
  }
  assert.equal(defaultHook.received.filter(r => r.body.entry[0].changes[0].value.statuses?.[0]?.id === messageId).length, 0);
});

test('unregistered numbers keep the .env webhook, secret and metadata', async () => {
  const messageId = (await sendText('123', 'default_token', '+5491100000098')).json().messages[0].id;
  await wait(80);

  const hook = defaultHook.received.find(r => r.body.entry[0].changes[0].value.statuses?.[0]?.id === messageId);
  assert.ok(hook);
  assert.equal(hook.signature, sign(hook.raw, 'default_secret'));
  assert.equal(hook.body.entry[0].id, '200200');
  assert.deepEqual(hook.body.entry[0].changes[0].value.metadata, {
    display_phone_number: '+10000000000',
    phone_number_id: '100100'
  });
});

test('simulate/inbound is per number', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/555001/simulate/inbound',
    headers: { authorization: 'Bearer token_a' },
    payload: { from: '5491100000077', text: { body: 'hola' } }
  });
  assert.equal(res.statusCode, 200);
  await wait(50);

  const hook = tenantHook.received.find(r => r.body.entry[0].changes[0].value.messages?.[0]?.from === '5491100000077');
  assert.ok(hook, 'inbound webhook not delivered to the tenant');
  assert.equal(hook.signature, sign(hook.raw, 'secret_a'));
  assert.equal(hook.body.entry[0].changes[0].value.metadata.phone_number_id, '555001');
});

test('template status webhooks go to the tenants of that WABA', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/v26.0/777001/message_templates',
    headers: { authorization: 'Bearer token_a' },
    payload: { name: 'tenant_tpl', language: 'en_US', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hi' }] }
  });
  assert.equal(created.statusCode, 200);
  await wait(150);

  const hook = tenantHook.received.find(r => r.body.entry[0].changes[0].value.message_template_id === Number(created.json().id));
  assert.ok(hook, 'template webhook not delivered to the tenant');
  assert.equal(hook.signature, sign(hook.raw, 'secret_a'));

  // Template validation uses the tenant WABA
  const send = await app.inject({
    method: 'POST',
    url: '/v26.0/555001/messages',
    headers: { authorization: 'Bearer token_a' },
    payload: { messaging_product: 'whatsapp', to: '+5491100000001', type: 'template', template: { name: 'tenant_tpl', language: { code: 'en_US' } } }
  });
  assert.equal(send.statusCode, 200, send.body);
});

test('a number registered in WABA_ID does not lock the .env number out of its WABA', async () => {
  const created = await registerTenant({
    phone_number_id: '555009', waba_id: '200200', access_token: 'token_z', webhook_url: tenantUrl, app_secret: 'secret_z'
  });
  assert.equal(created.statusCode, 201);

  const list = token => app.inject({
    method: 'GET', url: '/v26.0/200200/message_templates', headers: { authorization: `Bearer ${token}` }
  });
  assert.equal((await list('default_token')).statusCode, 200);
  assert.equal((await list('token_z')).statusCode, 200);

  const template = await app.inject({
    method: 'POST',
    url: '/v26.0/200200/message_templates',
    headers: { authorization: 'Bearer default_token' },
    payload: { name: 'shared_waba', language: 'en_US', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hi' }] }
  });
  assert.equal(template.statusCode, 200);
  await wait(150);

  const templateId = Number(template.json().id);
  const toDefault = defaultHook.received.find(r => r.body.entry[0].changes[0].value.message_template_id === templateId);
  const toTenant = tenantHook.received.find(r => r.body.entry[0].changes[0].value.message_template_id === templateId);
  assert.ok(toDefault, 'WEBHOOK_URL lost template updates for WABA_ID');
  assert.equal(toDefault.signature, sign(toDefault.raw, 'default_secret'));
  assert.ok(toTenant);
  assert.equal(toTenant.signature, sign(toTenant.raw, 'secret_z'));

  await app.inject({ method: 'DELETE', url: '/fake/tenants/555009', headers: admin });
});

test('re-registering updates the tenant and deleting restores the default', async () => {
  const updated = await registerTenant({ ...tenantA, access_token: 'token_a2', webhook_url: tenantUrl });
  assert.equal(updated.statusCode, 200);
  assert.equal((await sendText('555001', 'token_a')).statusCode, 401);
  assert.equal((await sendText('555001', 'token_a2')).statusCode, 200);

  const removed = await app.inject({ method: 'DELETE', url: '/fake/tenants/555001', headers: admin });
  assert.equal(removed.statusCode, 200);
  assert.deepEqual(removed.json(), { success: true });
  assert.equal((await sendText('555001', 'default_token')).statusCode, 200);

  const again = await app.inject({ method: 'DELETE', url: '/fake/tenants/555001', headers: admin });
  assert.equal(again.statusCode, 404);
});
