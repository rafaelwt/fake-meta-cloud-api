/**
 * WebhookEvent Model - CRUD operations for webhook_events table
 */
class WebhookEventModel {
  /**
   * @param {Database} db - SQLite database instance
   */
  constructor(db) {
    this.db = db;

    // Prepare statements
    this.stmts = {
      insert: db.prepare(`
        INSERT INTO webhook_events (
          message_id, event_type, webhook_url, payload,
          response_status, response_body, sent_at, success, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      findByMessageId: db.prepare(`
        SELECT * FROM webhook_events
        WHERE message_id = ?
        ORDER BY sent_at ASC
      `),

      findByMessageIdForSender: db.prepare(`
        SELECT e.* FROM webhook_events e
        JOIN messages m ON m.id = e.message_id
        WHERE e.message_id = ? AND m.waba_id = ?
        ORDER BY e.sent_at ASC
      `),

      findRecentForSender: db.prepare(`
        SELECT e.* FROM webhook_events e
        JOIN messages m ON m.id = e.message_id
        WHERE m.waba_id = ?
        ORDER BY e.sent_at DESC
        LIMIT ?
      `),

      findRecent: db.prepare(`
        SELECT * FROM webhook_events
        ORDER BY sent_at DESC
        LIMIT ?
      `),

      findFailed: db.prepare(`
        SELECT * FROM webhook_events
        WHERE success = 0
        ORDER BY sent_at DESC
        LIMIT ?
      `)
    };
  }

  /**
   * Log a webhook event
   * @param {object} event - Webhook event data
   * @returns {object} - Inserted event
   */
  log(event) {
    const now = Math.floor(Date.now() / 1000);

    const result = this.stmts.insert.run(
      event.message_id,
      event.event_type,
      event.webhook_url,
      JSON.stringify(event.payload),
      event.response_status || null,
      event.response_body || null,
      now,
      event.success ? 1 : 0,
      event.error || null
    );

    return {
      id: result.lastInsertRowid,
      ...event,
      sent_at: now
    };
  }

  /**
   * Get all webhook events for a message
   * @param {string} messageId - Message ID
   * @returns {Array} - Array of webhook events
   */
  getByMessageId(messageId) {
    const events = this.stmts.findByMessageId.all(messageId);
    return events.map(evt => {
      if (evt.payload) {
        evt.payload = JSON.parse(evt.payload);
      }
      return evt;
    });
  }

  /**
   * Get webhook events of a message, only if that phone number sent it
   * @param {string} messageId - Message ID
   * @param {string} phoneNumberId - Phone number ID from the path
   * @returns {Array} - Array of webhook events
   */
  getByMessageIdForSender(messageId, phoneNumberId) {
    return this.stmts.findByMessageIdForSender.all(messageId, phoneNumberId).map(parseEvent);
  }

  /**
   * Get recent webhook events of the messages sent by a phone number
   * @param {string} phoneNumberId - Phone number ID from the path
   * @param {number} limit - Number of events to retrieve
   * @returns {Array} - Array of webhook events
   */
  getRecentForSender(phoneNumberId, limit = 100) {
    return this.stmts.findRecentForSender.all(phoneNumberId, limit).map(parseEvent);
  }

  /**
   * Get recent webhook events
   * @param {number} limit - Number of events to retrieve
   * @returns {Array} - Array of webhook events
   */
  getRecent(limit = 100) {
    const events = this.stmts.findRecent.all(limit);
    return events.map(evt => {
      if (evt.payload) {
        evt.payload = JSON.parse(evt.payload);
      }
      return evt;
    });
  }

  /**
   * Get failed webhook deliveries
   * @param {number} limit - Number of events to retrieve
   * @returns {Array} - Array of failed webhook events
   */
  getFailed(limit = 50) {
    const events = this.stmts.findFailed.all(limit);
    return events.map(evt => {
      if (evt.payload) {
        evt.payload = JSON.parse(evt.payload);
      }
      return evt;
    });
  }
}

function parseEvent(evt) {
  if (evt.payload) {
    evt.payload = JSON.parse(evt.payload);
  }
  return evt;
}

module.exports = WebhookEventModel;
