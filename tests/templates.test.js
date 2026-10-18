const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'good_token';
process.env.APP_SECRET = 'templates_secret';
process.env.TEMPLATE_REVIEW_DELAY_MS = '30';
process.env.TEMPLATE_REJECT_PREFIX = 'reject_';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-templates-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');

const received = [];
const receiver = http.createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    received.push({ raw, body: JSON.parse(raw), signature: req.headers['x-hub-signature-256'] });
    res.end('ok');
  });
});

let app;
const auth = { authorization: 'Bearer good_token' };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

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

function listTemplates(wabaId, query = '') {
  return app.inject({ method: 'GET', url: `/v26.0/${wabaId}/message_templates${query}`, headers: auth });
}

function createTemplate(wabaId, body) {
  return app.inject({ method: 'POST', url: `/v26.0/${wabaId}/message_templates`, headers: auth, payload: body });
}

const newTemplate = name => ({
  name,
  language: 'en_US',
  category: 'MARKETING',
  parameter_format: 'POSITIONAL',
  components: [{ type: 'BODY', text: 'Hi {{1}}', example: { body_text: [['Ana']] } }],
  message_send_ttl_seconds: 3600
});

test('every WABA starts with approved seed templates in Graph format', async () => {
  const res = await listTemplates('111', '?limit=100&fields=id,name,language,category,status,parameter_format,components,rejected_reason');

  assert.equal(res.statusCode, 200);
  const { data, paging } = res.json();
  assert.equal(paging?.next, undefined);
  const byName = Object.fromEntries(data.map(t => [t.name, t]));

  for (const name of ['hello_world', 'order_update', 'promo_image', 'welcome_named']) {
    assert.ok(byName[name], `missing seed ${name}`);
    assert.equal(byName[name].status, 'APPROVED');
    assert.match(byName[name].id, /^\d+$/);
  }
  assert.ok(!byName.hello_world.components.find(c => c.type === 'BODY').text.includes('{{'));
  assert.deepEqual(byName.order_update.components.find(c => c.type === 'BODY').example, { body_text: [['Ana']] });
  assert.equal(byName.promo_image.components.find(c => c.type === 'HEADER').format, 'IMAGE');
  assert.equal(byName.welcome_named.parameter_format, 'NAMED');
});

test('fields limits the returned properties and id is always included', async () => {
  const res = await listTemplates('112', '?fields=name,status');

  for (const template of res.json().data) {
    assert.deepEqual(Object.keys(template).sort(), ['id', 'name', 'status']);
  }
});

test('limit pages results with an absolute next URL', async () => {
  const first = await listTemplates('113', '?limit=3&fields=name');
  const page1 = first.json();

  assert.equal(page1.data.length, 3);
  const next = new URL(page1.paging.next);
  assert.equal(next.protocol, 'http:');
  assert.equal(next.pathname, '/v26.0/113/message_templates');
  assert.equal(next.searchParams.get('limit'), '3');
  assert.equal(next.searchParams.get('fields'), 'name');

  const second = await app.inject({ method: 'GET', url: next.pathname + next.search, headers: auth });
  const page2 = second.json();
  assert.equal(page2.data.length, 1);
  assert.equal(page2.paging?.next, undefined);
  const names = [...page1.data, ...page2.data].map(t => t.name);
  assert.equal(new Set(names).size, 4);
});

test('created template is PENDING, persisted, then APPROVED with a signed webhook', async () => {
  const res = await createTemplate('114', newTemplate('spring_sale'));

  assert.equal(res.statusCode, 200);
  const created = res.json();
  assert.match(created.id, /^\d+$/);
  assert.equal(created.status, 'PENDING');
  assert.equal(created.category, 'MARKETING');

  const pending = (await listTemplates('114', '?fields=name,status,message_send_ttl_seconds')).json().data
    .find(t => t.name === 'spring_sale');
  assert.equal(pending.status, 'PENDING');

  await wait(200);

  const approved = (await listTemplates('114')).json().data.find(t => t.name === 'spring_sale');
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.rejected_reason, undefined);

  const hook = received.find(r => r.body.entry[0].changes[0].value.message_template_id === Number(created.id));
  assert.ok(hook, 'missing message_template_status_update webhook');
  assert.equal(hook.body.object, 'whatsapp_business_account');
  assert.equal(hook.body.entry[0].id, '114');
  assert.equal(hook.body.entry[0].changes[0].field, 'message_template_status_update');
  assert.deepEqual(hook.body.entry[0].changes[0].value, {
    event: 'APPROVED',
    message_template_id: Number(created.id),
    message_template_name: 'spring_sale',
    message_template_language: 'en_US',
    reason: 'NONE'
  });
  const expected = 'sha256=' + crypto.createHmac('sha256', 'templates_secret').update(hook.raw).digest('hex');
  assert.equal(hook.signature, expected);
});

test('template names with the reject prefix end REJECTED with a reason', async () => {
  const created = (await createTemplate('115', newTemplate('reject_spam'))).json();
  await wait(200);

  const template = (await listTemplates('115')).json().data.find(t => t.name === 'reject_spam');
  assert.equal(template.status, 'REJECTED');
  assert.equal(template.rejected_reason, 'INVALID_FORMAT');

  const hook = received.find(r => r.body.entry[0].changes[0].value.message_template_id === Number(created.id));
  assert.equal(hook.body.entry[0].changes[0].value.event, 'REJECTED');
  assert.equal(hook.body.entry[0].changes[0].value.reason, 'INVALID_FORMAT');
});

test('duplicate name and language in the same WABA returns 100 / 2388024', async () => {
  await createTemplate('116', newTemplate('dup_name'));
  const res = await createTemplate('116', newTemplate('dup_name'));

  assert.equal(res.statusCode, 400);
  const { error } = res.json();
  assert.equal(error.code, 100);
  assert.equal(error.error_subcode, 2388024);
  assert.equal(error.type, 'OAuthException');
  assert.equal(typeof error.message, 'string');

  const other = await createTemplate('117', newTemplate('dup_name'));
  assert.equal(other.statusCode, 200);
  const otherLanguage = await createTemplate('116', { ...newTemplate('dup_name'), language: 'es' });
  assert.equal(otherLanguage.statusCode, 200);
});

test('seed names are taken too', async () => {
  const res = await createTemplate('118', { ...newTemplate('hello_world') });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error.error_subcode, 2388024);
});

test('invalid template bodies return code 100', async () => {
  for (const body of [
    { ...newTemplate('Bad Name') },
    { ...newTemplate('no_components'), components: [] },
    { ...newTemplate('bad_category'), category: 'PROMO' }
  ]) {
    const res = await createTemplate('119', body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(res.json().error.code, 100);
  }
});

test('templates require a valid token', async () => {
  const res = await app.inject({ method: 'GET', url: '/v26.0/111/message_templates' });
  assert.equal(res.statusCode, 401);
});
