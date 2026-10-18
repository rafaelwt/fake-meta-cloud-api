const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { initDatabase } = require('../src/database/connection');

const silent = { info() {}, debug() {} };

test('a tenants table created without settings gets the column on startup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-meta-migration-'));
  const dbPath = path.join(dir, 'old.db');
  try {
    const old = new Database(dbPath);
    old.exec(`CREATE TABLE tenants (
      phone_number_id TEXT PRIMARY KEY, waba_id TEXT NOT NULL, display_phone_number TEXT,
      verified_name TEXT, quality_rating TEXT, access_token TEXT NOT NULL, webhook_url TEXT,
      app_secret TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
    old.prepare("INSERT INTO tenants VALUES ('1', '2', NULL, NULL, NULL, 'tok', NULL, NULL, 0, 0)").run();
    old.close();

    const db = initDatabase(dbPath, silent);
    const columns = db.prepare('PRAGMA table_info(tenants)').all().map(c => c.name);
    const row = db.prepare("SELECT * FROM tenants WHERE phone_number_id = '1'").get();
    db.close();

    assert.ok(columns.includes('settings'));
    assert.equal(row.access_token, 'tok');
    assert.equal(row.settings, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
