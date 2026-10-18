const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'good_token';
process.env.UPLOAD_MAX_BYTES = String(20 * 1024 * 1024);
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-uploads-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');

let app;
const auth = { authorization: 'Bearer good_token' };

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

async function startSession(length, type = 'image/jpeg') {
  const res = await app.inject({
    method: 'POST',
    url: `/v26.0/555/uploads?file_name=header.jpg&file_length=${length}&file_type=${encodeURIComponent(type)}`,
    headers: auth
  });
  return res;
}

test('upload session returns an upload: id', async () => {
  const res = await startSession(5);

  assert.equal(res.statusCode, 200);
  assert.match(res.json().id, /^upload:[A-Za-z0-9_-]+$/);
});

test('session requires file_length and a supported file_type', async () => {
  const missing = await app.inject({ method: 'POST', url: '/v26.0/555/uploads?file_type=image/jpeg', headers: auth });
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.json().error.code, 100);

  const unsupported = await startSession(5, 'text/plain');
  assert.equal(unsupported.statusCode, 400);
  assert.equal(unsupported.json().error.code, 100);
});

for (const [label, headers] of [
  ['no content-type', {}],
  ['an empty content-type', { 'content-type': '' }],
  ['application/octet-stream', { 'content-type': 'application/octet-stream' }]
]) {
  test(`raw bytes with ${label} return a file handle`, async () => {
    const { id } = (await startSession(5)).json();
    const res = await app.inject({
      method: 'POST',
      url: `/v26.0/${id}`,
      headers: { ...auth, ...headers, file_offset: '0' },
      payload: Buffer.from('hello')
    });

    assert.equal(res.statusCode, 200, res.body);
    assert.match(res.json().h, /^4::aW1hZ2UvanBlZw==:[A-Za-z0-9_-]+$/);
  });
}

test('uploads up to 16 MB are accepted', async () => {
  const size = 16 * 1024 * 1024;
  const { id } = (await startSession(size, 'video/mp4')).json();
  const res = await app.inject({
    method: 'POST',
    url: `/v26.0/${id}`,
    headers: { ...auth, 'content-type': 'application/octet-stream', file_offset: '0' },
    payload: Buffer.alloc(size)
  });

  assert.equal(res.statusCode, 200, res.body);
  assert.ok(res.json().h);
});

test('GET session reports the received offset', async () => {
  const { id } = (await startSession(5)).json();
  const before = await app.inject({ method: 'GET', url: `/v26.0/${id}`, headers: auth });
  assert.deepEqual(before.json(), { id, file_offset: 0 });

  await app.inject({ method: 'POST', url: `/v26.0/${id}`, headers: { ...auth, file_offset: '0' }, payload: Buffer.from('hello') });
  const after = await app.inject({ method: 'GET', url: `/v26.0/${id}`, headers: auth });
  assert.deepEqual(after.json(), { id, file_offset: 5 });
});

test('unknown session or wrong offset returns code 100', async () => {
  const unknown = await app.inject({
    method: 'POST', url: '/v26.0/upload:doesnotexist', headers: { ...auth, file_offset: '0' }, payload: Buffer.from('x')
  });
  assert.equal(unknown.statusCode, 400);
  assert.equal(unknown.json().error.code, 100);

  const { id } = (await startSession(5)).json();
  const badOffset = await app.inject({
    method: 'POST', url: `/v26.0/${id}`, headers: { ...auth, file_offset: '3' }, payload: Buffer.from('hello')
  });
  assert.equal(badOffset.statusCode, 400);
  assert.equal(badOffset.json().error.code, 100);
});

test('POST to an unknown node keeps the Graph unknown-path error', async () => {
  const res = await app.inject({ method: 'POST', url: '/v26.0/12345', headers: auth, payload: {} });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error.code, 2500);
});
