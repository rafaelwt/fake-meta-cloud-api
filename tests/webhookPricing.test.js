const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-test-${process.pid}.db`);
process.env.TEMPLATE_CATEGORIES = 'otp_*:authentication';
process.env.TEMPLATE_DEFAULT_CATEGORY = 'marketing';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWebhookPayload } = require('../src/events/emitter');

test.after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

function statusOf(messageData, status) {
  return buildWebhookPayload(messageData, status).entry[0].changes[0].value.statuses[0];
}

test('template pricing uses the configured category', () => {
  const s = statusOf({ id: 'w', recipient_id: '1', type: 'template', template_name: 'otp_login' }, 'delivered');

  assert.deepEqual(s.pricing, { billable: true, pricing_model: 'PMP', type: 'regular', category: 'authentication' });
  assert.equal('conversation' in s, false);
});

test('template pricing falls back to default category', () => {
  const s = statusOf({ id: 'w', recipient_id: '1', type: 'template', template_name: 'promo' }, 'sent');

  assert.equal(s.pricing.category, 'marketing');
});

test('free-form messages keep free customer service pricing', () => {
  const s = statusOf({ id: 'w', recipient_id: '1', type: 'text' }, 'sent');

  assert.deepEqual(s.pricing, { billable: false, pricing_model: 'PMP', type: 'free_customer_service', category: 'service' });
});

test('read status has no pricing', () => {
  assert.equal(statusOf({ id: 'w', recipient_id: '1', type: 'text' }, 'read').pricing, undefined);
});
