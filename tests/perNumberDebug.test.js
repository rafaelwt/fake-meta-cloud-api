const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'default_token';
process.env.ADMIN_TOKEN = 'admin_token';
process.env.WEBHOOK_URL = 'http://127.0.0.1:9/';
process.env.DELAY_SENT_MIN = '1';
process.env.DELAY_SENT_MAX = '2';
process.env.DELAY_DELIVERED_MIN = '3';
process.env.DELAY_DELIVERED_MAX = '4';
process.env.READ_PROBABILITY = '0';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-per-number-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');

let app;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const tokenA = { authorization: 'Bearer token_a' };
const tokenDefault = { authorization: 'Bearer default_token' };

test.before(async () => {
  const { createServer } = require('../src/server');
  app = createServer();
  await app.inject({
    method: 'POST', url: '/fake/tenants', headers: { authorization: 'Bearer admin_token' },
    payload: { phone_number_id: '555001', waba_id: '777001', access_token: 'token_a' }
  });
});

test.after(async () => {
  await wait(50);
  await app.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

async function send(phoneId, headers, to) {
  const res = await app.inject({
    method: 'POST', url: `/v26.0/${phoneId}/messages`, headers,
    payload: { messaging_product: 'whatsapp', to, type: 'text', text: { body: 'hi' } }
  });
  return res.json().messages[0].id;
}

test('stats and webhook events only show the data of the number that asks', async () => {
  const fromA = await send('555001', tokenA, '+5491100000001');
  await send('555001', tokenA, '+5491100000002');
  const fromDefault = await send('100100', tokenDefault, '+5491100000003');
  await wait(60);

  const statsA = (await app.inject({ method: 'GET', url: '/v26.0/555001/messages/stats', headers: tokenA })).json();
  assert.equal(statsA.total_messages, 2);
  const statsDefault = (await app.inject({ method: 'GET', url: '/v26.0/100100/messages/stats', headers: tokenDefault })).json();
  assert.equal(statsDefault.total_messages, 1);

  const eventsA = (await app.inject({ method: 'GET', url: '/v26.0/555001/webhooks/events', headers: tokenA })).json().events;
  assert.ok(eventsA.length > 0);
  assert.ok(eventsA.every(e => e.message_id !== fromDefault), 'saw another number events');

  const foreign = (await app.inject({
    method: 'GET', url: `/v26.0/555001/webhooks/events?messageId=${fromDefault}`, headers: tokenA
  })).json();
  assert.deepEqual(foreign, { message_id: fromDefault, events: [] });

  const own = (await app.inject({
    method: 'GET', url: `/v26.0/555001/webhooks/events?messageId=${fromA}`, headers: tokenA
  })).json();
  assert.ok(own.events.length > 0);
});
