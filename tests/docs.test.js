const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.DOCS_ENABLED = 'true';
process.env.WEBHOOK_URL = 'http://127.0.0.1:1/unused';
process.env.DELAY_SENT_MIN = '1';
process.env.DELAY_SENT_MAX = '2';
process.env.DELAY_DELIVERED_MIN = '3';
process.env.DELAY_DELIVERED_MAX = '4';
process.env.READ_PROBABILITY = '0';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-docs-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/server');

const app = createServer();

test.after(async () => {
  // Let pending status webhooks settle before closing the database
  await new Promise(resolve => setTimeout(resolve, 200));
  await app.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

async function getSpec() {
  const res = await app.inject({ method: 'GET', url: '/docs/openapi.json' });
  assert.equal(res.statusCode, 200);
  return res.json();
}

test('serves the Scalar API reference at /docs', async () => {
  const redirect = await app.inject({ method: 'GET', url: '/docs' });
  assert.equal(redirect.statusCode, 301);
  assert.equal(redirect.headers.location, '/docs/');

  const res = await app.inject({ method: 'GET', url: '/docs/' });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/html/);
});

test('spec documents every public endpoint with bearer auth', async () => {
  const spec = await getSpec();

  assert.deepEqual(Object.keys(spec.paths).sort(), [
    '/health',
    '/ready',
    '/{version}/{wabaId}/messages',
    '/{version}/{wabaId}/messages/stats',
    '/{version}/{wabaId}/simulate/inbound',
    '/{version}/{wabaId}/webhooks/events'
  ]);
  assert.equal(spec.components.securitySchemes.bearerAuth.scheme, 'bearer');
  assert.deepEqual(spec.paths['/{version}/{wabaId}/messages'].post.security, [{ bearerAuth: [] }]);
  assert.equal(spec.paths['/health'].get.security, undefined);
});

test('messages body is documented as one schema per message type', async () => {
  const spec = await getSpec();
  const media = spec.paths['/{version}/{wabaId}/messages'].post.requestBody.content['application/json'];
  const titles = media.schema.oneOf.map(s => s.title);

  for (const type of [
    'template', 'text', 'image', 'document', 'audio', 'video', 'sticker',
    'interactive', 'reaction', 'location', 'contacts', 'mark as read'
  ]) {
    assert.ok(titles.includes(type), `missing ${type} in ${titles}`);
  }

  const text = media.schema.oneOf.find(s => s.title === 'text');
  assert.deepEqual(text.properties.type, { type: 'string', enum: ['text'] });
  assert.ok(text.required.includes('text'));
});

test('every documented example is valid against the real validation', async () => {
  const spec = await getSpec();
  const media = spec.paths['/{version}/{wabaId}/messages'].post.requestBody.content['application/json'];
  const sends = Object.entries(media.examples).filter(([, e]) => e.value.status !== 'read');

  assert.ok(sends.length >= 11);
  for (const [name, example] of sends) {
    const res = await app.inject({
      method: 'POST',
      url: '/v26.0/123/messages',
      headers: { authorization: `Bearer ${process.env.API_ACCESS_TOKEN || 'your_fake_bearer_token_here'}` },
      payload: example.value
    });
    assert.equal(res.statusCode, 200, `${name}: ${res.body}`);
  }
});

test('docs are not served when disabled', () => {
  const { docsEnabled } = require('../src/plugins/docs');

  assert.equal(docsEnabled({ DOCS_ENABLED: 'false' }, 'development'), false);
  assert.equal(docsEnabled({}, 'production'), false);
  assert.equal(docsEnabled({}, 'development'), true);
  assert.equal(docsEnabled({ DOCS_ENABLED: 'true' }, 'production'), true);
});
