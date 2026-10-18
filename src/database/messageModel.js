/**
 * Message Model - CRUD operations for messages table
 */
class MessageModel {
  /**
   * @param {Database} db - SQLite database instance
   */
  constructor(db) {
    this.db = db;

    // Prepare statements for better performance
    this.stmts = {
      insert: db.prepare(`
        INSERT INTO messages (
          id, waba_id, recipient_id, message_type, message_content,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),

      findById: db.prepare('SELECT * FROM messages WHERE id = ?'),

      updateStatus: db.prepare(`
        UPDATE messages
        SET status = ?, updated_at = ?
        WHERE id = ?
      `),

      updateError: db.prepare(`
        UPDATE messages
        SET status = 'failed', error_code = ?, error_message = ?, updated_at = ?
        WHERE id = ?
      `),

      findRecent: db.prepare(`
        SELECT * FROM messages
        ORDER BY created_at DESC
        LIMIT ?
      `),

      findRecentBySender: db.prepare(`
        SELECT * FROM messages
        WHERE waba_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `),

      findByRecipient: db.prepare(`
        SELECT * FROM messages
        WHERE recipient_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
    };
  }

  /**
   * Insert a new message
   * @param {object} message - Message data
   * @returns {object} - Inserted message
   */
  insert(message) {
    const now = Math.floor(Date.now() / 1000);

    const result = this.stmts.insert.run(
      message.id,
      message.waba_id,
      message.recipient_id,
      message.message_type,
      JSON.stringify(message.message_content || {}),
      'accepted',
      now,
      now
    );

    return {
      ...message,
      status: 'accepted',
      created_at: now,
      updated_at: now,
      changes: result.changes
    };
  }

  /**
   * Find message by ID
   * @param {string} id - Message ID
   * @returns {object|null} - Message or null
   */
  findById(id) {
    const message = this.stmts.findById.get(id);
    if (message && message.message_content) {
      message.message_content = JSON.parse(message.message_content);
    }
    return message || null;
  }

  /**
   * Update message status
   * @param {string} id - Message ID
   * @param {string} status - New status (sent, delivered, read, failed)
   * @returns {object} - Update result
   */
  updateStatus(id, status) {
    const now = Math.floor(Date.now() / 1000);
    const result = this.stmts.updateStatus.run(status, now, id);
    return { id, status, updated_at: now, changes: result.changes };
  }

  /**
   * Mark message as failed with error details
   * @param {string} id - Message ID
   * @param {number} errorCode - Error code
   * @param {string} errorMessage - Error message
   * @returns {object} - Update result
   */
  markAsFailed(id, errorCode, errorMessage) {
    const now = Math.floor(Date.now() / 1000);
    const result = this.stmts.updateError.run(errorCode, errorMessage, now, id);
    return { id, status: 'failed', error_code: errorCode, error_message: errorMessage, changes: result.changes };
  }

  /**
   * Get recent messages sent by a phone number
   * @param {string} phoneNumberId - Phone number ID from the path
   * @param {number} limit - Number of messages to retrieve
   * @returns {Array} - Array of messages
   */
  getRecentBySender(phoneNumberId, limit = 50) {
    return this.stmts.findRecentBySender.all(phoneNumberId, limit).map(msg => {
      if (msg.message_content) {
        msg.message_content = JSON.parse(msg.message_content);
      }
      return msg;
    });
  }

  /**
   * Get recent messages
   * @param {number} limit - Number of messages to retrieve
   * @returns {Array} - Array of messages
   */
  getRecent(limit = 50) {
    const messages = this.stmts.findRecent.all(limit);
    return messages.map(msg => {
      if (msg.message_content) {
        msg.message_content = JSON.parse(msg.message_content);
      }
      return msg;
    });
  }

  /**
   * Get messages by recipient
   * @param {string} recipientId - Recipient phone number
   * @param {number} limit - Number of messages to retrieve
   * @returns {Array} - Array of messages
   */
  getByRecipient(recipientId, limit = 50) {
    const messages = this.stmts.findByRecipient.all(recipientId, limit);
    return messages.map(msg => {
      if (msg.message_content) {
        msg.message_content = JSON.parse(msg.message_content);
      }
      return msg;
    });
  }
}

module.exports = MessageModel;
