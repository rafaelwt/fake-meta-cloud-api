const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveLogDir } = require('../src/utils/logDir');

const repoLogs = path.join(__dirname, '..', 'logs');

test('defaults to the repo logs directory', () => {
  assert.equal(resolveLogDir({}), repoLogs);
});

test('LOG_DIR overrides the directory', () => {
  assert.equal(resolveLogDir({ LOG_DIR: '/var/log/fake-meta' }), '/var/log/fake-meta');
  assert.equal(resolveLogDir({ LOG_DIR: '/var/log/fake-meta', NODE_TEST_CONTEXT: 'child-v8' }), '/var/log/fake-meta');
});

test('tests log to a temp directory, not the repo', () => {
  const dir = resolveLogDir({ NODE_TEST_CONTEXT: 'child-v8' });

  assert.ok(dir.startsWith(os.tmpdir()), dir);
  assert.notEqual(dir, repoLogs);
});

test('this test run itself does not write to the repo logs', () => {
  const config = require('../src/config');

  assert.ok(config.logging.dir.startsWith(os.tmpdir()), config.logging.dir);
});
