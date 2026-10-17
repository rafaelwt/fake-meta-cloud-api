const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
delete process.env.SERVICE_WINDOW_ENFORCED;
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-window-off-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');
const { isServiceWindowBlocked } = require('../src/services/messageService');

test.after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

test('service window is not enforced by default', () => {
  assert.equal(isServiceWindowBlocked({ type: 'text' }, '5499999999999'), false);
});
