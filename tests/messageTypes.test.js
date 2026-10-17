const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'good_token';
process.env.WEBHOOK_URL = 'http://127.0.0.1:1/unused';
process.env.DELAY_SENT_MIN = '1';
process.env.DELAY_SENT_MAX = '2';
process.env.DELAY_DELIVERED_MIN = '3';
process.env.DELAY_DELIVERED_MAX = '4';
process.env.READ_PROBABILITY = '0';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-types-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/server');

const app = createServer();
const headers = { authorization: 'Bearer good_token' };

test.after(async () => {
  // Let pending status webhooks settle before closing the database
  await new Promise(resolve => setTimeout(resolve, 200));
  await app.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

function send(payload) {
  return app.inject({ method: 'POST', url: '/v26.0/123/messages', headers, payload });
}

function message(type, content) {
  return { messaging_product: 'whatsapp', to: '+5491100000000', type, [type]: content };
}

const validMessages = {
  interactive: {
    type: 'button',
    body: { text: 'Pick one' },
    action: { buttons: [{ type: 'reply', reply: { id: 'yes', title: 'Yes' } }] }
  },
  reaction: { message_id: 'wamid.ABC', emoji: '👍' },
  location: { latitude: -16.5, longitude: -68.15, name: 'La Paz', address: 'Bolivia' },
  sticker: { id: '1234567890' },
  contacts: [{ name: { formatted_name: 'Ana Pérez', first_name: 'Ana' }, phones: [{ phone: '+59170000000' }] }]
};

for (const [type, content] of Object.entries(validMessages)) {
  test(`accepts a valid ${type} message`, async () => {
    const res = await send(message(type, content));

    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().messages[0].message_status, 'accepted');
  });
}

const invalidMessages = {
  interactive: { body: { text: 'no type or action' } },
  reaction: { emoji: '👍' },
  location: { latitude: -16.5 },
  sticker: { caption: 'no media' },
  contacts: []
};

for (const [type, content] of Object.entries(invalidMessages)) {
  test(`rejects an invalid ${type} message`, async () => {
    const res = await send(message(type, content));

    assert.equal(res.statusCode, 400);
  });
}

test('accepts a reply with context.message_id', async () => {
  const res = await send({ ...message('text', { body: 'reply' }), context: { message_id: 'wamid.ABC' } });

  assert.equal(res.statusCode, 200, res.body);
});

test('existing text and image messages still validate', async () => {
  assert.equal((await send(message('text', { body: 'hi' }))).statusCode, 200);
  assert.equal((await send(message('image', { link: 'https://example.com/a.png' }))).statusCode, 200);
  assert.equal((await send(message('text', {}))).statusCode, 400);
});

test('missing type reports the type, not template', async () => {
  const res = await send({ messaging_product: 'whatsapp', to: '+5491100000000' });

  assert.equal(res.statusCode, 400);
  const details = JSON.stringify(res.json().error.details);
  assert.match(details, /type/);
  assert.doesNotMatch(details, /template/);
});

async function simulateInbound() {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/123/simulate/inbound',
    headers,
    payload: { from: '+5491100000000', text: { body: 'hola' } }
  });
  return res.json().messages[0].id;
}

test('marks an inbound message as read', async () => {
  const messageId = await simulateInbound();
  const res = await send({ messaging_product: 'whatsapp', status: 'read', message_id: messageId });

  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(res.json(), { success: true });
});

test('marks as read with a typing indicator', async () => {
  const messageId = await simulateInbound();
  const res = await send({
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
    typing_indicator: { type: 'text' }
  });

  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(res.json(), { success: true });
});

test('mark as read with an unknown message id fails like Meta', async () => {
  const res = await send({ messaging_product: 'whatsapp', status: 'read', message_id: 'wamid.UNKNOWN' });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error.code, 100);
});

test('mark as read requires message_id', async () => {
  const res = await send({ messaging_product: 'whatsapp', status: 'read' });

  assert.equal(res.statusCode, 400);
});
