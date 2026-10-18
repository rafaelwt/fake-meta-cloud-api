const eventBus = require('./bus');
const { randomDelay } = require('../utils/delays');
const config = require('../config');
const { parseTemplateCategories, resolveTemplateCategory } = require('../utils/templateCategories');
const logger = require('../logger');

const log = logger.child({ component: 'emitter' });

// Pending status timers per message ID (so a forced status can cancel the rest)
const pendingFlows = new Map();

/**
 * Schedule a status step of a message flow
 * @private
 */
function scheduleStep(messageId, delay, fn) {
  const timers = pendingFlows.get(messageId) || new Set();
  const timer = setTimeout(() => {
    timers.delete(timer);
    if (timers.size === 0) pendingFlows.delete(messageId);
    fn();
  }, delay);
  timers.add(timer);
  pendingFlows.set(messageId, timers);
}

/**
 * Cancel the pending status updates of a message
 * @param {string} messageId - Message ID
 */
function cancelMessageFlow(messageId) {
  for (const timer of pendingFlows.get(messageId) || []) clearTimeout(timer);
  pendingFlows.delete(messageId);
}

/**
 * Cancel every pending status update (shutdown / tests)
 */
function cancelAllFlows() {
  for (const messageId of [...pendingFlows.keys()]) cancelMessageFlow(messageId);
}

/**
 * Start the message status update flow
 * Schedules events to be emitted on the event bus
 * @param {object} messageData - Message data
 * @param {string} webhookUrl - URL to send webhooks to
 * @param {number|null} errorCode - Error code if message should fail
 */
function startMessageFlow(messageData, webhookUrl, errorCode = null) {
  log.info({ messageId: messageData.id }, 'Starting message status flow');

  if (errorCode) {
    scheduleErrorFlow(messageData, webhookUrl, errorCode);
  } else {
    scheduleNormalFlow(messageData, webhookUrl);
  }
}

/**
 * Schedule normal message flow (successful delivery)
 * @private
 */
function scheduleNormalFlow(messageData, webhookUrl) {
  // Per-number overrides (tenant), falling back to the global config
  const delays = messageData.tenant?.status_delays || config.delays;
  const readProbability = messageData.tenant?.read_probability ?? config.behavior.readProbability;

  // 1. SENT (after 0.5-2 seconds)
  const sentDelay = randomDelay(delays.sent.min, delays.sent.max);
  scheduleStep(messageData.id, sentDelay, () => {
    log.debug({ messageId: messageData.id, delay: sentDelay }, 'Emitting status:sent');
    eventBus.emit('status:sent', messageData, webhookUrl);
  });

  // 2. DELIVERED (after 3-5 seconds)
  const deliveredDelay = randomDelay(delays.delivered.min, delays.delivered.max);
  scheduleStep(messageData.id, deliveredDelay, () => {
    log.debug({ messageId: messageData.id, delay: deliveredDelay }, 'Emitting status:delivered');
    eventBus.emit('status:delivered', messageData, webhookUrl);
  });

  // 3. READ (after 5-10 seconds, with probability)
  if (Math.random() <= readProbability) {
    const readDelay = randomDelay(delays.read.min, delays.read.max);
    scheduleStep(messageData.id, readDelay, () => {
      log.debug({ messageId: messageData.id, delay: readDelay }, 'Emitting status:read');
      eventBus.emit('status:read', messageData, webhookUrl);
    });
  } else {
    log.debug({ messageId: messageData.id }, 'Skipping READ status (probability)');
  }
}

/**
 * Schedule error flow (message fails)
 * Like Meta, a failed message only gets the failed status (no sent before it)
 * @private
 */
function scheduleErrorFlow(messageData, webhookUrl, errorCode) {
  const delays = messageData.tenant?.status_delays || config.delays;

  // FAILED (after 0.5-2 seconds, when sent would have arrived)
  const failedDelay = randomDelay(delays.sent.min, delays.sent.max);
  scheduleStep(messageData.id, failedDelay, () => {
    log.debug({ messageId: messageData.id, errorCode, delay: failedDelay }, 'Emitting status:failed');
    eventBus.emit('status:failed', messageData, webhookUrl, errorCode);
  });
}

/**
 * Build per-message pricing object
 * Templates are billed by their configured category; free-form messages
 * fall in the customer service window and are free
 * @private
 */
function buildPricing(messageData) {
  if (messageData.type === 'template') {
    return {
      billable: true,
      pricing_model: 'PMP',
      type: 'regular',
      category: resolveTemplateCategory(
        messageData.template_name || '',
        parseTemplateCategories(config.templates.categories),
        config.templates.defaultCategory
      )
    };
  }

  return {
    billable: false,
    pricing_model: 'PMP',
    type: 'free_customer_service',
    category: 'service'
  };
}

/**
 * Build webhook payload for a given status
 * @param {object} messageData - Message data
 * @param {string} status - Status type
 * @param {number|null} errorCode - Error code (for failed status)
 * @returns {object} - Webhook payload
 */
function buildWebhookPayload(messageData, status, errorCode = null) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sender = senderOf(messageData);

  const statusObject = {
    id: messageData.id,
    status: status,
    timestamp: timestamp,
    recipient_id: messageData.recipient_id
  };

  // Add per-message pricing (PMP) for sent/delivered.
  // Since v24.0 the conversation object is omitted (except free entry point).
  if (status === 'sent' || status === 'delivered') {
    statusObject.pricing = buildPricing(messageData);
  }

  // Add errors for failed status
  if (status === 'failed' && errorCode) {
    const { getErrorByCode } = require('../config/errorCodes');
    const errorDetails = getErrorByCode(errorCode);

    if (errorDetails) {
      statusObject.errors = [errorDetails];
    }
  }

  // Build full webhook payload
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: sender.waba_id,
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: sender.display_phone_number,
            phone_number_id: sender.phone_number_id
          },
          statuses: [statusObject]
        },
        field: 'messages'
      }]
    }]
  };
}

/**
 * Business number that sent the message (its tenant, or the .env number)
 * @private
 */
function senderOf(messageData) {
  if (messageData.tenant) return messageData.tenant;
  const { meta } = config;
  return {
    waba_id: meta.wabaId,
    display_phone_number: meta.displayPhoneNumber,
    phone_number_id: meta.phoneNumberId
  };
}

module.exports = {
  startMessageFlow,
  cancelMessageFlow,
  cancelAllFlows,
  buildWebhookPayload
};
