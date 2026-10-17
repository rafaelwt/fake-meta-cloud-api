const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'good_token';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-errors-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/server');

const app = createServer();

test.after(async () => {
  await app.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

test('health reports the database as connected', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().database, 'connected');
});

test('health reports disconnected when the database is closed', async () => {
  const closed = require('fastify')();
  closed.decorate('db', { open: false });
  closed.register(require('../src/routes/health'));
  const res = await closed.inject({ method: 'GET', url: '/health' });
  await closed.close();

  assert.equal(res.json().database, 'disconnected');
});

test('ready returns 200 when the database is open', async () => {
  const res = await app.inject({ method: 'GET', url: '/ready' });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ready' });
});

test('validation errors follow Meta error format', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/123/messages',
    headers: { authorization: 'Bearer good_token' },
    payload: { messaging_product: 'whatsapp', to: '+5491100000000', type: 'text' }
  });

  assert.equal(res.statusCode, 400);
  const { error } = res.json();
  assert.equal(error.message, '(#100) Invalid parameter');
  assert.equal(error.type, 'OAuthException');
  assert.equal(error.code, 100);
  assert.equal(error.error_data.messaging_product, 'whatsapp');
  assert.match(error.error_data.details, /text/);
  assert.match(error.fbtrace_id, /^[A-Za-z0-9_-]{20,}$/);
});

test('invalid token follows Meta error format', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/123/messages',
    headers: { authorization: 'Bearer nope' },
    payload: {}
  });

  assert.equal(res.statusCode, 401);
  const { error } = res.json();
  assert.equal(error.type, 'OAuthException');
  assert.equal(error.code, 190);
  assert.equal(error.error_subcode, 467);
  assert.match(error.fbtrace_id, /^[A-Za-z0-9_-]{20,}$/);
});

test('missing token follows Meta error format', async () => {
  const res = await app.inject({ method: 'GET', url: '/v26.0/123/messages/stats' });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error.code, 2500);
  assert.equal(res.json().error.type, 'OAuthException');
  assert.equal('error_subcode' in res.json().error, false);
});

test('unknown paths follow Meta format', async () => {
  const res = await app.inject({ method: 'GET', url: '/v26.0/123/nope?x=1' });

  assert.equal(res.statusCode, 400);
  const { error } = res.json();
  assert.equal(error.message, 'Unknown path components: /v26.0/123/nope');
  assert.equal(error.type, 'OAuthException');
  assert.equal(error.code, 2500);
  assert.match(error.fbtrace_id, /^[A-Za-z0-9_-]{20,}$/);
});

test('validation errors carry no error_subcode', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/123/messages',
    headers: { authorization: 'Bearer good_token' },
    payload: {}
  });

  assert.equal('error_subcode' in res.json().error, false);
});
