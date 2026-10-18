/**
 * Template Model - CRUD operations for message_templates table
 */
class TemplateModel {
  /**
   * @param {Database} db - SQLite database instance
   */
  constructor(db) {
    this.db = db;

    // Prepare statements
    this.stmts = {
      insert: db.prepare(`
        INSERT INTO message_templates (
          id, waba_id, name, language, category, status, parameter_format,
          components, rejected_reason, message_send_ttl_seconds, review_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      insertIgnore: db.prepare(`
        INSERT OR IGNORE INTO message_templates (
          id, waba_id, name, language, category, status, parameter_format,
          components, rejected_reason, message_send_ttl_seconds, review_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      findById: db.prepare(`
        SELECT * FROM message_templates WHERE id = ?
      `),

      findByName: db.prepare(`
        SELECT * FROM message_templates WHERE waba_id = ? AND name = ? AND language = ?
      `),

      findByWaba: db.prepare(`
        SELECT * FROM message_templates WHERE waba_id = ?
        ORDER BY created_at, rowid
      `),

      findDue: db.prepare(`
        SELECT * FROM message_templates
        WHERE status = 'PENDING' AND review_at IS NOT NULL AND review_at <= ?
      `),

      updateReview: db.prepare(`
        UPDATE message_templates
        SET status = ?, rejected_reason = ?, review_at = NULL, updated_at = ?
        WHERE id = ? AND status = 'PENDING'
      `)
    };
  }

  /**
   * Insert a template
   * @param {object} template - Template data
   * @param {object} [options]
   * @param {boolean} [options.ignoreExisting=false] - Skip if name+language already exists
   * @returns {boolean} - Whether a row was inserted
   * @throws {Error} - SQLITE_CONSTRAINT_UNIQUE on duplicate name+language
   */
  insert(template, { ignoreExisting = false } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const stmt = ignoreExisting ? this.stmts.insertIgnore : this.stmts.insert;

    const result = stmt.run(
      template.id,
      template.waba_id,
      template.name,
      template.language,
      template.category,
      template.status,
      template.parameter_format,
      JSON.stringify(template.components),
      template.rejected_reason || null,
      template.message_send_ttl_seconds ?? null,
      template.review_at ?? null,
      now,
      now
    );

    return result.changes > 0;
  }

  /**
   * Find a template by ID
   * @param {string} id - Template ID
   * @returns {object|undefined} - Template with parsed components
   */
  findById(id) {
    return parse(this.stmts.findById.get(id));
  }

  /**
   * Find a template by WABA, name and language
   * @param {string} wabaId - WhatsApp Business Account ID
   * @param {string} name - Template name
   * @param {string} language - Language code
   * @returns {object|undefined} - Template with parsed components
   */
  findByName(wabaId, name, language) {
    return parse(this.stmts.findByName.get(wabaId, name, language));
  }

  /**
   * List templates of a WABA in creation order
   * @param {string} wabaId - WhatsApp Business Account ID
   * @returns {Array} - Templates with parsed components
   */
  findByWaba(wabaId) {
    return this.stmts.findByWaba.all(wabaId).map(parse);
  }

  /**
   * Find PENDING templates whose review time has passed
   * @param {number} nowMs - Current time in ms
   * @returns {Array} - Templates with parsed components
   */
  findDue(nowMs) {
    return this.stmts.findDue.all(nowMs).map(parse);
  }

  /**
   * Record the review outcome of a PENDING template
   * @param {string} id - Template ID
   * @param {string} status - APPROVED or REJECTED
   * @param {string|null} rejectedReason - Reason when REJECTED
   * @returns {boolean} - Whether the template was still PENDING
   */
  review(id, status, rejectedReason) {
    const now = Math.floor(Date.now() / 1000);
    return this.stmts.updateReview.run(status, rejectedReason, now, id).changes > 0;
  }
}

function parse(row) {
  if (!row) return row;
  return { ...row, components: JSON.parse(row.components) };
}

module.exports = TemplateModel;
