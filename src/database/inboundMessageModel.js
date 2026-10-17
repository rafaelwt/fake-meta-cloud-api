/**
 * InboundMessage Model - CRUD operations for inbound_messages table
 */
class InboundMessageModel {
  /**
   * @param {Database} db - SQLite database instance
   */
  constructor(db) {
    this.db = db;

    // Prepare statements
    this.stmts = {
      insert: db.prepare(`
        INSERT INTO inbound_messages (
          id, waba_id, from_id, message_type, message_content, received_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `),

      findById: db.prepare(`
        SELECT * FROM inbound_messages WHERE id = ?
      `),

      findLastReceivedAt: db.prepare(`
        SELECT MAX(received_at) AS received_at FROM inbound_messages
        WHERE from_id = ?
      `)
    };
  }

  /**
   * Insert a new inbound message
   * @param {object} message - Inbound message data
   * @returns {object} - Inserted message
   */
  insert(message) {
    const now = Math.floor(Date.now() / 1000);

    this.stmts.insert.run(
      message.id,
      message.waba_id,
      message.from_id,
      message.message_type,
      JSON.stringify(message.message_content),
      now
    );

    return { ...message, received_at: now };
  }

  /**
   * Find an inbound message by ID
   * @param {string} id - Message ID
   * @returns {object|undefined} - Inbound message
   */
  findById(id) {
    return this.stmts.findById.get(id);
  }

  /**
   * Get the timestamp of the last message received from a user
   * @param {string} fromId - Sender phone number without +
   * @returns {number|null} - Unix timestamp or null if none
   */
  getLastReceivedAt(fromId) {
    return this.stmts.findLastReceivedAt.get(fromId).received_at;
  }
}

module.exports = InboundMessageModel;
