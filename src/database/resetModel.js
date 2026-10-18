/**
 * Reset Model - deletes test data of a phone number or WABA (fake-only)
 */
class ResetModel {
  /**
   * @param {Database} db - SQLite database instance
   */
  constructor(db) {
    this.db = db;

    // Prepare statements (messages.waba_id / inbound_messages.waba_id hold the phone number ID from the path)
    this.stmts = {
      deleteWebhookEvents: db.prepare(`
        DELETE FROM webhook_events
        WHERE message_id IN (SELECT id FROM messages WHERE waba_id = ?)
      `),

      deleteMessages: db.prepare(`
        DELETE FROM messages WHERE waba_id = ?
      `),

      deleteInbound: db.prepare(`
        DELETE FROM inbound_messages WHERE waba_id = ?
      `),

      deleteTemplates: db.prepare(`
        DELETE FROM message_templates WHERE waba_id = ?
      `)
    };

    this.resetPhonesTx = db.transaction((phoneNumberIds) => {
      const deleted = { messages: 0, webhook_events: 0, inbound_messages: 0 };
      for (const id of phoneNumberIds) {
        deleted.webhook_events += this.stmts.deleteWebhookEvents.run(id).changes;
        deleted.messages += this.stmts.deleteMessages.run(id).changes;
        deleted.inbound_messages += this.stmts.deleteInbound.run(id).changes;
      }
      return deleted;
    });

    this.resetWabaTx = db.transaction((wabaId, phoneNumberIds) => ({
      ...this.resetPhonesTx(phoneNumberIds),
      templates: this.stmts.deleteTemplates.run(wabaId).changes
    }));
  }

  /**
   * Delete messages, their webhook events and inbound messages of phone numbers
   * @param {string[]} phoneNumberIds - Phone number IDs
   * @returns {object} - Deleted row counts
   */
  resetPhones(phoneNumberIds) {
    return this.resetPhonesTx(phoneNumberIds);
  }

  /**
   * Delete the templates of a WABA and the data of its phone numbers
   * @param {string} wabaId - WhatsApp Business Account ID
   * @param {string[]} phoneNumberIds - Phone number IDs of the WABA
   * @returns {object} - Deleted row counts
   */
  resetWaba(wabaId, phoneNumberIds) {
    return this.resetWabaTx(wabaId, phoneNumberIds);
  }
}

module.exports = ResetModel;
