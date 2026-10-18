/**
 * Tenant Model - CRUD operations for tenants table
 */
class TenantModel {
  /**
   * @param {Database} db - SQLite database instance
   */
  constructor(db) {
    this.db = db;

    // Prepare statements
    this.stmts = {
      upsert: db.prepare(`
        INSERT INTO tenants (
          phone_number_id, waba_id, display_phone_number, verified_name, quality_rating,
          access_token, webhook_url, app_secret, settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(phone_number_id) DO UPDATE SET
          waba_id = excluded.waba_id,
          display_phone_number = excluded.display_phone_number,
          verified_name = excluded.verified_name,
          quality_rating = excluded.quality_rating,
          access_token = excluded.access_token,
          webhook_url = excluded.webhook_url,
          app_secret = excluded.app_secret,
          settings = excluded.settings,
          updated_at = excluded.updated_at
      `),

      findByPhone: db.prepare(`
        SELECT * FROM tenants WHERE phone_number_id = ?
      `),

      findByWaba: db.prepare(`
        SELECT * FROM tenants WHERE waba_id = ? ORDER BY created_at, phone_number_id
      `),

      findAll: db.prepare(`
        SELECT * FROM tenants ORDER BY created_at, phone_number_id
      `),

      delete: db.prepare(`
        DELETE FROM tenants WHERE phone_number_id = ?
      `)
    };
  }

  /**
   * Insert or update a tenant
   * @param {object} tenant - Tenant data
   * @returns {boolean} - True if it was created, false if updated
   */
  upsert(tenant) {
    const now = Math.floor(Date.now() / 1000);
    const existed = Boolean(this.findByPhone(tenant.phone_number_id));

    this.stmts.upsert.run(
      tenant.phone_number_id,
      tenant.waba_id,
      tenant.display_phone_number || null,
      tenant.verified_name || null,
      tenant.quality_rating || null,
      tenant.access_token,
      tenant.webhook_url || null,
      tenant.app_secret || null,
      tenant.settings ? JSON.stringify(tenant.settings) : null,
      now,
      now
    );

    return !existed;
  }

  /**
   * Find a tenant by phone number ID
   * @param {string} phoneNumberId - Phone number ID
   * @returns {object|undefined} - Tenant
   */
  findByPhone(phoneNumberId) {
    return parse(this.stmts.findByPhone.get(phoneNumberId));
  }

  /**
   * Find the tenants of a WABA
   * @param {string} wabaId - WhatsApp Business Account ID
   * @returns {Array} - Tenants
   */
  findByWaba(wabaId) {
    return this.stmts.findByWaba.all(wabaId).map(parse);
  }

  /**
   * List all tenants
   * @returns {Array} - Tenants
   */
  findAll() {
    return this.stmts.findAll.all().map(parse);
  }

  /**
   * Delete a tenant
   * @param {string} phoneNumberId - Phone number ID
   * @returns {boolean} - Whether a tenant was deleted
   */
  delete(phoneNumberId) {
    return this.stmts.delete.run(phoneNumberId).changes > 0;
  }
}

function parse(row) {
  if (!row) return row;
  return { ...row, settings: row.settings ? JSON.parse(row.settings) : {} };
}

module.exports = TenantModel;
