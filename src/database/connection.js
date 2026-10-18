const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Initializes SQLite database connection and creates tables
 * @param {string} dbPath - Path to the SQLite database file
 * @param {object} logger - Pino logger instance
 * @returns {Database} - SQLite database instance
 */
function initDatabase(dbPath, logger) {
  // Ensure data directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info({ dir: dbDir }, 'Created database directory');
  }

  // Create database connection
  const db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? logger.debug.bind(logger) : null
  });

  logger.info({ path: dbPath }, 'Database connection established');

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Read and execute schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Execute all schema statements
  db.exec(schema);
  addMissingColumns(db, logger);

  logger.info('Database schema initialized');

  return db;
}

/**
 * Add columns introduced after a table was first created (CREATE TABLE IF NOT EXISTS skips them)
 * @param {Database} db - SQLite database instance
 * @param {object} logger - Pino logger instance
 */
function addMissingColumns(db, logger) {
  const columns = db.prepare('PRAGMA table_info(tenants)').all().map(c => c.name);
  if (!columns.includes('settings')) {
    db.exec('ALTER TABLE tenants ADD COLUMN settings TEXT');
    logger.info('Added tenants.settings column');
  }
}

/**
 * Closes database connection gracefully
 * @param {Database} db - SQLite database instance
 * @param {object} logger - Pino logger instance
 */
function closeDatabase(db, logger) {
  if (db && db.open) {
    db.close();
    logger.info('Database connection closed');
  }
}

module.exports = {
  initDatabase,
  closeDatabase
};
