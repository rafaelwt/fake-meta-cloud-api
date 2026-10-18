const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'good_token';
delete process.env.ADMIN_TOKEN;
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-admin-disabled-test-${process.pid}.db`);

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

test('admin endpoints are disabled when ADMIN_TOKEN is not set', async () => {
  for (const headers of [{}, { authorization: 'Bearer good_token' }, { authorization: 'Bearer ' }]) {
    const res = await app.inject({ method: 'GET', url: '/fake/tenants', headers });
    assert.equal(res.statusCode, 403);
    assert.match(res.json().error.message, /ADMIN_TOKEN/);
  }
});
