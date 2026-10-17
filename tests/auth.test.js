const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'good_token';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-auth-test-${process.pid}.db`);

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

const invalidBody = { to: 'x' };

test('missing token returns 401 even with an invalid body', async () => {
  const res = await app.inject({ method: 'POST', url: '/v26.0/123/messages', payload: invalidBody });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error.code, 2500);
});

test('wrong token returns 401 even with an invalid body', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/123/messages',
    headers: { authorization: 'Bearer nope' },
    payload: invalidBody
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error.code, 190);
});

test('valid token with invalid body still returns 400', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/123/messages',
    headers: { authorization: 'Bearer good_token' },
    payload: invalidBody
  });

  assert.equal(res.statusCode, 400);
});

test('stats endpoint still requires a token', async () => {
  const res = await app.inject({ method: 'GET', url: '/v26.0/123/messages/stats' });

  assert.equal(res.statusCode, 401);
});
