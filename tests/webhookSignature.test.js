const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

process.env.LOG_PRETTY = 'false';
process.env.APP_SECRET = 'test_app_secret';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-sig-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');
const { signPayload } = require('../src/utils/signature');
const { sendWebhook } = require('../src/services/webhookService');
const { messageModel } = require('../src/database/models');

test.after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

test('signPayload returns sha256= HMAC of the raw body', () => {
  const body = '{"a":1}';
  const expected = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');

  assert.equal(signPayload(body, 'secret'), expected);
});

test('sendWebhook signs the exact bytes it sends', async () => {
  let received;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      received = { raw, signature: req.headers['x-hub-signature-256'] };
      res.end('ok');
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;

  // webhook_events references messages, so the message must exist
  messageModel.insert({
    id: 'wamid.test',
    waba_id: '123',
    recipient_id: '1',
    message_type: 'text',
    message_content: {}
  });

  let result;
  try {
    result = await sendWebhook(url, { hello: 'wörld' }, 'wamid.test', 'sent');
  } finally {
    server.close();
  }

  assert.equal(result.success, true);
  assert.deepEqual(JSON.parse(received.raw), { hello: 'wörld' });
  assert.equal(received.signature, signPayload(received.raw, 'test_app_secret'));
});
