const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'good_token';
process.env.DISPLAY_PHONE_NUMBER = '+15550001111';
process.env.VERIFIED_NAME = 'Acme Test';
process.env.QUALITY_RATING = 'GREEN';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-phone-test-${process.pid}.db`);

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

test('GET phone number returns the verified business profile', async () => {
  const res = await app.inject({ method: 'GET', url: '/v26.0/1098765432', headers: auth });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.id, '1098765432');
  assert.equal(body.display_phone_number, '+15550001111');
  assert.equal(body.verified_name, 'Acme Test');
  assert.equal(body.quality_rating, 'GREEN');
});

test('GET phone number honors the fields parameter and always returns id', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/v26.0/1098765432?fields=verified_name,quality_rating',
    headers: auth
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { verified_name: 'Acme Test', quality_rating: 'GREEN', id: '1098765432' });
});

test('GET phone number with an invalid token returns Meta error 190', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/v26.0/1098765432',
    headers: { authorization: 'Bearer wrong' }
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error.code, 190);
});

test('GET a non-numeric node id returns code 100 subcode 33', async () => {
  const res = await app.inject({ method: 'GET', url: '/v26.0/not-a-number', headers: auth });

  assert.equal(res.statusCode, 400);
  const { error } = res.json();
  assert.equal(error.code, 100);
  assert.equal(error.error_subcode, 33);
  assert.match(error.message, /Object with ID 'not-a-number' does not exist/);
});
