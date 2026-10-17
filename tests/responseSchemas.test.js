const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.DOCS_ENABLED = 'true';
process.env.API_ACCESS_TOKEN = 'good_token';
process.env.WEBHOOK_URL = 'http://127.0.0.1:1/unused';
process.env.DELAY_SENT_MIN = '1';
process.env.DELAY_SENT_MAX = '2';
process.env.DELAY_DELIVERED_MIN = '3';
process.env.DELAY_DELIVERED_MAX = '4';
process.env.READ_PROBABILITY = '0';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-responses-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');
const Ajv = require('ajv');
const { createServer } = require('../src/server');

const app = createServer();
const ajv = new Ajv({ strict: false, allErrors: true });
const headers = { authorization: 'Bearer good_token' };

test.after(async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
  await app.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

let spec;
async function documentedSchema(pathKey, method, status) {
  spec ??= (await app.inject({ method: 'GET', url: '/docs/openapi.json' })).json();
  const response = spec.paths[pathKey]?.[method]?.responses?.[status];
  assert.ok(response, `no documented ${status} response for ${method.toUpperCase()} ${pathKey}`);
  return response.content['application/json'].schema;
}

async function assertMatchesDocs(pathKey, method, res) {
  const schema = await documentedSchema(pathKey, method, String(res.statusCode));
  const valid = ajv.validate(schema, res.json());
  assert.ok(valid, `${method.toUpperCase()} ${pathKey} ${res.statusCode}: ${ajv.errorsText()} in ${res.body}`);
}

const messages = '/{version}/{wabaId}/messages';
const text = { messaging_product: 'whatsapp', to: '+5491100000000', type: 'text', text: { body: 'hi' } };

test('send message responses match the docs', async () => {
  await assertMatchesDocs(messages, 'post', await app.inject({ method: 'POST', url: '/v26.0/123/messages', headers, payload: text }));
  await assertMatchesDocs(messages, 'post', await app.inject({ method: 'POST', url: '/v26.0/123/messages', headers, payload: {} }));
  await assertMatchesDocs(messages, 'post', await app.inject({ method: 'POST', url: '/v26.0/123/messages', payload: text }));
});

test('mark as read and inbound responses match the docs', async () => {
  const inbound = await app.inject({
    method: 'POST',
    url: '/v26.0/123/simulate/inbound',
    headers,
    payload: { from: '+5491100000000', text: { body: 'hola' } }
  });
  await assertMatchesDocs('/{version}/{wabaId}/simulate/inbound', 'post', inbound);

  const read = await app.inject({
    method: 'POST',
    url: '/v26.0/123/messages',
    headers,
    payload: { messaging_product: 'whatsapp', status: 'read', message_id: inbound.json().messages[0].id }
  });
  await assertMatchesDocs(messages, 'post', read);
});

test('debug and health responses match the docs', async () => {
  // Let the status flow write some webhook events first
  await new Promise(resolve => setTimeout(resolve, 100));

  await assertMatchesDocs('/{version}/{wabaId}/messages/stats', 'get', await app.inject({ url: '/v26.0/123/messages/stats', headers }));
  await assertMatchesDocs('/{version}/{wabaId}/webhooks/events', 'get', await app.inject({ url: '/v26.0/123/webhooks/events', headers }));
  await assertMatchesDocs('/{version}/{wabaId}/webhooks/events', 'get', await app.inject({ url: '/v26.0/123/webhooks/events?messageId=wamid.x', headers }));
  await assertMatchesDocs('/health', 'get', await app.inject({ url: '/health' }));
  await assertMatchesDocs('/ready', 'get', await app.inject({ url: '/ready' }));
});

test('response schemas do not change runtime output', async () => {
  const res = await app.inject({ url: '/v26.0/123/webhooks/events', headers });
  const [event] = res.json().events;

  assert.ok(event, 'expected at least one webhook event');
  assert.equal(typeof event.payload.entry, 'object');
  assert.ok('response_body' in event);
});
