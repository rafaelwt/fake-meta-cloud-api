const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('a local .env is not loaded under node --test', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-meta-env-'));
  const cwd = process.cwd();
  fs.writeFileSync(path.join(dir, '.env'), 'TEMPLATE_VALIDATION_ENFORCED=true\nFAKE_META_ENV_PROBE=loaded\n');
  try {
    process.chdir(dir);
    delete require.cache[require.resolve('../src/config')];
    const config = require('../src/config');
    assert.equal(process.env.FAKE_META_ENV_PROBE, undefined);
    assert.equal(config.behavior.templateValidationEnforced, false);
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
