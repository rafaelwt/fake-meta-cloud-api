const { initDatabase } = require('./connection');
const MessageModel = require('./messageModel');
const WebhookEventModel = require('./webhookEventModel');
const config = require('../config');
const logger = require('../logger');

/**
 * Database Models Singleton
 * Initializes database connection and model instances once
 * Use everywhere by requiring this module
 */

// Initialize database connection
const db = initDatabase(config.database.path, logger);

// Create model instances
const messageModel = new MessageModel(db);
const webhookEventModel = new WebhookEventModel(db);

module.exports = {
  db,
  messageModel,
  webhookEventModel
};
