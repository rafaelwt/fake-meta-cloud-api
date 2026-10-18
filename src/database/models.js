const { initDatabase } = require('./connection');
const MessageModel = require('./messageModel');
const WebhookEventModel = require('./webhookEventModel');
const InboundMessageModel = require('./inboundMessageModel');
const TemplateModel = require('./templateModel');
const UploadModel = require('./uploadModel');
const TenantModel = require('./tenantModel');
const ResetModel = require('./resetModel');
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
const inboundMessageModel = new InboundMessageModel(db);
const templateModel = new TemplateModel(db);
const uploadModel = new UploadModel(db);
const tenantModel = new TenantModel(db);
const resetModel = new ResetModel(db);

module.exports = {
  db,
  messageModel,
  webhookEventModel,
  inboundMessageModel,
  templateModel,
  uploadModel,
  tenantModel,
  resetModel
};
