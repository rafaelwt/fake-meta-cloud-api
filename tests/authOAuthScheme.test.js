const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'good_token';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-oauth-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');

let app;

test.before(() => {
  const { createServer } = require('../src/server');
  app = createServer();
});

test.after(async () => {
  await app.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

function getStats(authorization) {
  return app.inject({ method: 'GET', url: '/v26.0/123/messages/stats', headers: { authorization } });
}

test('OAuth scheme with the valid token is accepted', async () => {
  const res = await getStats('OAuth good_token');
  assert.equal(res.statusCode, 200);
});

test('Bearer scheme with the valid token is still accepted', async () => {
  const res = await getStats('Bearer good_token');
  assert.equal(res.statusCode, 200);
});

test('OAuth scheme with a wrong token returns 190 / 467', async () => {
  const res = await getStats('OAuth wrong_token');
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error.code, 190);
  assert.equal(res.json().error.error_subcode, 467);
});

test('other schemes and malformed values are rejected with 190', async () => {
  for (const value of ['Basic good_token', 'good_token', 'OAuth', 'OAuth ', 'oauthgood_token']) {
    const res = await getStats(value);
    assert.equal(res.statusCode, 401, value);
    assert.equal(res.json().error.code, 190, value);
  }
});

test('upload bytes accept Authorization: OAuth like the real Resumable Upload API', async () => {
  const session = await app.inject({
    method: 'POST',
    url: '/v26.0/555/uploads?file_length=5&file_type=image/jpeg',
    headers: { authorization: 'Bearer good_token' }
  });
  const res = await app.inject({
    method: 'POST',
    url: `/v26.0/${session.json().id}`,
    headers: { authorization: 'OAuth good_token', file_offset: '0' },
    payload: Buffer.from('hello')
  });

  assert.equal(res.statusCode, 200, res.body);
  assert.ok(res.json().h);
});
