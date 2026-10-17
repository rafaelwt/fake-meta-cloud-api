const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseTemplateCategories,
  resolveTemplateCategory
} = require('../src/utils/templateCategories');

test('parses name:category pairs and ignores invalid categories', () => {
  const patterns = parseTemplateCategories('otp_*:authentication, order_update:utility,bad:foo');

  assert.deepEqual([...patterns.entries()], [
    ['otp_*', 'authentication'],
    ['order_update', 'utility']
  ]);
});

test('resolves exact names and prefix wildcards', () => {
  const patterns = parseTemplateCategories('otp_*:authentication,order_update:utility');

  assert.equal(resolveTemplateCategory('otp_login', patterns, 'marketing'), 'authentication');
  assert.equal(resolveTemplateCategory('order_update', patterns, 'marketing'), 'utility');
  assert.equal(resolveTemplateCategory('order_update_v2', patterns, 'marketing'), 'marketing');
});

test('falls back to default category when no pattern matches', () => {
  assert.equal(resolveTemplateCategory('promo', parseTemplateCategories(''), 'utility'), 'utility');
});
