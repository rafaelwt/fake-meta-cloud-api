const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.API_ACCESS_TOKEN = 'good_token';
process.env.WEBHOOK_URL = 'http://127.0.0.1:9/';
process.env.TEMPLATE_VALIDATION_ENFORCED = 'true';
process.env.TEMPLATE_REVIEW_DELAY_MS = '30';
process.env.PHONE_NUMBER_ID = '900900';
process.env.WABA_ID = '901901';
process.env.DELAY_SENT_MIN = '1';
process.env.DELAY_SENT_MAX = '2';
process.env.DELAY_DELIVERED_MIN = '3';
process.env.DELAY_DELIVERED_MAX = '4';
process.env.READ_PROBABILITY = '0';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-template-validation-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');

let app;
const auth = { authorization: 'Bearer good_token' };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test.before(() => {
  const { createServer } = require('../src/server');
  app = createServer();
});

test.after(async () => {
  await wait(100);
  await app.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

function sendTemplate(template, sender = '777') {
  return app.inject({
    method: 'POST',
    url: `/v26.0/${sender}/messages`,
    headers: auth,
    payload: { messaging_product: 'whatsapp', to: '+5491100000000', type: 'template', template }
  });
}

const body = (...texts) => ({ type: 'body', parameters: texts.map(text => ({ type: 'text', text })) });

function assertError(res, status, code, detailsPattern) {
  assert.equal(res.statusCode, status, res.body);
  const { error } = res.json();
  assert.equal(error.code, code);
  assert.equal(error.type, 'OAuthException');
  if (detailsPattern) assert.match(error.error_data.details, detailsPattern);
}

test('approved template with matching parameters is accepted', async () => {
  const noVars = await sendTemplate({ name: 'hello_world', language: { code: 'en_US' } });
  assert.equal(noVars.statusCode, 200, noVars.body);

  const oneVar = await sendTemplate({ name: 'order_update', language: { code: 'en_US' }, components: [body('Ana')] });
  assert.equal(oneVar.statusCode, 200, oneVar.body);
});

test('unknown name or language answers 404 with code 132001', async () => {
  assertError(await sendTemplate({ name: 'nope', language: { code: 'en_US' } }), 404, 132001, /template name \(nope\) does not exist in en_US/);
  assertError(await sendTemplate({ name: 'hello_world', language: { code: 'es' } }), 404, 132001);
});

test('a template that is not APPROVED answers 132001 until it is approved', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/v26.0/777/message_templates',
    headers: auth,
    payload: { name: 'fresh_one', language: 'en_US', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hi' }] }
  });
  assert.equal(created.statusCode, 200);

  assertError(await sendTemplate({ name: 'fresh_one', language: { code: 'en_US' } }), 404, 132001);
  await wait(150);
  assert.equal((await sendTemplate({ name: 'fresh_one', language: { code: 'en_US' } })).statusCode, 200);
});

test('body parameter count mismatch answers 400 with code 132000', async () => {
  assertError(await sendTemplate({ name: 'order_update', language: { code: 'en_US' } }), 400, 132000, /body: number of localizable_params \(0\) does not match the expected number of params \(1\)/);
  assertError(await sendTemplate({ name: 'order_update', language: { code: 'en_US' }, components: [body('a', 'b')] }), 400, 132000);
  assertError(await sendTemplate({ name: 'hello_world', language: { code: 'en_US' }, components: [body('extra')] }), 400, 132000);
});

test('media header without a link or id answers 400 with code 132012', async () => {
  const base = { name: 'promo_image', language: { code: 'en_US' } };

  assertError(await sendTemplate({ ...base, components: [body('Ana')] }), 400, 132012, /header: Format mismatch, expected IMAGE, received UNKNOWN/);
  assertError(await sendTemplate({
    ...base,
    components: [{ type: 'header', parameters: [{ type: 'image', image: {} }] }, body('Ana')]
  }), 400, 132012);
  assertError(await sendTemplate({
    ...base,
    components: [{ type: 'header', parameters: [{ type: 'video', video: { link: 'https://x.test/v.mp4' } }] }, body('Ana')]
  }), 400, 132012, /expected IMAGE, received VIDEO/);

  for (const image of [{ link: 'https://x.test/a.jpg' }, { id: '123' }]) {
    const res = await sendTemplate({
      ...base,
      components: [{ type: 'header', parameters: [{ type: 'image', image }] }, body('Ana')]
    });
    assert.equal(res.statusCode, 200, res.body);
  }
});

test('header text parameters on a template without them answer 132000', async () => {
  const res = await sendTemplate({
    name: 'order_update',
    language: { code: 'en_US' },
    components: [{ type: 'header', parameters: [{ type: 'text', text: 'x' }] }, body('Ana')]
  });
  assertError(res, 400, 132000, /header/);
});

test('url button parameters must match dynamic url buttons', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/v26.0/777/message_templates',
    headers: auth,
    payload: {
      name: 'track_order',
      language: 'en_US',
      category: 'UTILITY',
      components: [
        { type: 'BODY', text: 'Track it' },
        { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Track', url: 'https://x.test/t/{{1}}' }] }
      ]
    }
  });
  assert.equal(created.statusCode, 200);
  await wait(150);

  const base = { name: 'track_order', language: { code: 'en_US' } };
  assertError(await sendTemplate(base), 400, 132000, /button/);

  const ok = await sendTemplate({
    ...base,
    components: [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'abc' }] }]
  });
  assert.equal(ok.statusCode, 200, ok.body);

  // promo_image has a static URL button: url parameters are not expected
  assertError(await sendTemplate({
    name: 'promo_image',
    language: { code: 'en_US' },
    components: [
      { type: 'header', parameters: [{ type: 'image', image: { id: '1' } }] },
      body('Ana'),
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'x' }] }
    ]
  }), 400, 132000, /button/);
});

test('named templates require matching parameter_name values', async () => {
  const base = { name: 'welcome_named', language: { code: 'en_US' } };
  const named = (pairs) => ({
    type: 'body',
    parameters: pairs.map(([name, text]) => ({ type: 'text', parameter_name: name, text }))
  });

  const ok = await sendTemplate({ ...base, components: [named([['first_name', 'Ana'], ['code', 'X1']])] });
  assert.equal(ok.statusCode, 200, ok.body);

  assertError(await sendTemplate({ ...base, components: [named([['first_name', 'Ana'], ['coupon', 'X1']])] }), 400, 132000, /parameter_name/);
  assertError(await sendTemplate({ ...base, components: [body('Ana', 'X1')] }), 400, 132000, /parameter_name/);
});

test('sending from PHONE_NUMBER_ID validates against the templates of WABA_ID', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/v26.0/901901/message_templates',
    headers: auth,
    payload: { name: 'waba_only', language: 'en_US', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hi' }] }
  });
  assert.equal(created.statusCode, 200);
  await wait(150);

  const res = await sendTemplate({ name: 'waba_only', language: { code: 'en_US' } }, '900900');
  assert.equal(res.statusCode, 200, res.body);
  assertError(await sendTemplate({ name: 'waba_only', language: { code: 'en_US' } }, '777'), 404, 132001);
});

async function createApproved(name, category, components) {
  const created = await app.inject({
    method: 'POST',
    url: '/v26.0/777/message_templates',
    headers: auth,
    payload: { name, language: 'en_US', category, components }
  });
  assert.equal(created.statusCode, 200, created.body);
  await wait(150);
}

test('authentication OTP copy code buttons expect the code as a url button parameter', async () => {
  await createApproved('otp_code', 'AUTHENTICATION', [
    { type: 'BODY', text: '{{1}} is your verification code.' },
    { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copy code' }] }
  ]);
  const base = { name: 'otp_code', language: { code: 'en_US' } };

  const ok = await sendTemplate({
    ...base,
    components: [body('123456'), { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '123456' }] }]
  });
  assert.equal(ok.statusCode, 200, ok.body);

  assertError(await sendTemplate({ ...base, components: [body('123456')] }), 400, 132000, /button/);
});

test('location headers expect a location parameter', async () => {
  await createApproved('store_location', 'UTILITY', [
    { type: 'HEADER', format: 'LOCATION' },
    { type: 'BODY', text: 'Visit us' }
  ]);
  const base = { name: 'store_location', language: { code: 'en_US' } };

  const ok = await sendTemplate({
    ...base,
    components: [{ type: 'header', parameters: [{ type: 'location', location: { latitude: '-34.6', longitude: '-58.4', name: 'Store', address: 'Main St' } }] }]
  });
  assert.equal(ok.statusCode, 200, ok.body);

  assertError(await sendTemplate(base), 400, 132012, /expected LOCATION/);
});

test('error details name the actual problem', async () => {
  assertError(await sendTemplate({
    name: 'promo_image',
    language: { code: 'en_US' },
    components: [{ type: 'header', parameters: [{ type: 'image', image: {} }] }, body('Ana')]
  }), 400, 132012, /IMAGE parameter requires a link or id/);

  assertError(await sendTemplate({
    name: 'track_order',
    language: { code: 'en_US' },
    components: [{ type: 'button', sub_type: 'url', index: '1', parameters: [{ type: 'text', text: 'abc' }] }]
  }), 400, 132000, /index 1 is not a dynamic URL or OTP button/);
});

test('non-template messages are not affected', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v26.0/777/messages',
    headers: auth,
    payload: { messaging_product: 'whatsapp', to: '+5491100000000', type: 'text', text: { body: 'hi' } }
  });
  assert.equal(res.statusCode, 200);
});
