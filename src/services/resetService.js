const { resetModel } = require('../database/models');
const tenantService = require('./tenantService');
const templateService = require('./templateService');
const { cancelMessageFlow } = require('../events/emitter');
const logger = require('../logger');

/**
 * Delete the test data of a phone number or a WABA (fake-only)
 * The tenant registry is kept; a WABA gets its seed templates back on next use
 * @param {object} target - { phone_number_id } or { waba_id }
 * @returns {object} - { success, deleted }
 */
function reset(target) {
  const phoneNumberIds = target.phone_number_id
    ? [target.phone_number_id]
    : tenantService.phoneNumbersOfWaba(target.waba_id);

  // Pending statuses of deleted messages must not fire (no stray webhooks, no FK errors)
  for (const messageId of resetModel.messageIdsOf(phoneNumberIds)) {
    cancelMessageFlow(messageId);
  }

  let deleted;
  if (target.phone_number_id) {
    deleted = resetModel.resetPhones(phoneNumberIds);
  } else {
    deleted = resetModel.resetWaba(target.waba_id, phoneNumberIds);
    templateService.forgetSeeded(target.waba_id);
  }

  logger.info({ target, deleted }, 'Test data reset');

  return { success: true, deleted };
}

module.exports = { reset };
