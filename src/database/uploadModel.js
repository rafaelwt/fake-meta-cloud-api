/**
 * Upload Model - CRUD operations for uploads table (Resumable Upload API)
 */
class UploadModel {
  /**
   * @param {Database} db - SQLite database instance
   */
  constructor(db) {
    this.db = db;

    // Prepare statements
    this.stmts = {
      insert: db.prepare(`
        INSERT INTO uploads (id, app_id, file_name, file_length, file_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `),

      findById: db.prepare(`
        SELECT * FROM uploads WHERE id = ?
      `),

      updateProgress: db.prepare(`
        UPDATE uploads SET file_offset = ?, handle = ? WHERE id = ?
      `)
    };
  }

  /**
   * Insert a new upload session
   * @param {object} upload - Session data
   * @returns {object} - Inserted session
   */
  insert(upload) {
    const now = Math.floor(Date.now() / 1000);

    this.stmts.insert.run(
      upload.id,
      upload.app_id,
      upload.file_name || null,
      upload.file_length,
      upload.file_type,
      now
    );

    return { ...upload, file_offset: 0, created_at: now };
  }

  /**
   * Find an upload session by ID
   * @param {string} id - Session ID without the 'upload:' prefix
   * @returns {object|undefined} - Upload session
   */
  findById(id) {
    return this.stmts.findById.get(id);
  }

  /**
   * Store the bytes received so far and the handle once complete
   * @param {string} id - Session ID
   * @param {number} fileOffset - Bytes received
   * @param {string|null} handle - File handle
   */
  updateProgress(id, fileOffset, handle) {
    this.stmts.updateProgress.run(fileOffset, handle, id);
  }
}

module.exports = UploadModel;
