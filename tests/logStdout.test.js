const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function runLogger(extraEnv) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-meta-log-stdout-'));
  try {
    const result = spawnSync(process.execPath, ['-e', "require('./src/logger').info('probe-line')"], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'production', LOG_PRETTY: 'false', LOG_DIR: dir, ...extraEnv },
      encoding: 'utf8'
    });
    return result.stdout;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('LOG_STDOUT=true writes JSON logs to stdout', () => {
  const line = runLogger({ LOG_STDOUT: 'true' }).trim().split('\n').find(l => l.includes('probe-line'));
  assert.ok(line, 'no log line on stdout');
  assert.equal(JSON.parse(line).msg, 'probe-line');
});

test('without LOG_STDOUT nothing is written to stdout', () => {
  assert.equal(runLogger({ LOG_STDOUT: '' }), '');
});
