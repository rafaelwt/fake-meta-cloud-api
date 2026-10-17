const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.LOG_PRETTY = 'false';
process.env.DOCS_ENABLED = 'false';
process.env.DB_PATH = path.join(os.tmpdir(), `fake-meta-deprecations-test-${process.pid}.db`);

const test = require('node:test');
const assert = require('node:assert/strict');

const warnings = [];
process.on('warning', warning => warnings.push(warning));

const { createServer } = require('../src/server');
const app = createServer();

test.after(async () => {
  await app.close();
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(process.env.DB_PATH + suffix, { force: true });
  }
});

test('server starts without Fastify deprecation warnings', async () => {
  await app.ready();
  // Warnings are emitted on the next tick
  await new Promise(resolve => setImmediate(resolve));

  const fastifyWarnings = warnings.filter(w => /^FST/.test(w.code || ''));
  assert.deepEqual(fastifyWarnings.map(w => w.code), []);
});
