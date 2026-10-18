const { resetModel } = require('../database/models');
const tenantService = require('./tenantService');
const templateService = require('./templateService');
const logger = require('../logger');

/**
 * Delete the test data of a phone number or a WABA (fake-only)
 * The tenant registry is kept; a WABA gets its seed templates back on next use
 * @param {object} target - { phone_number_id } or { waba_id }
 * @returns {object} - { success, deleted }
 */
function reset(target) {
  let deleted;

  if (target.phone_number_id) {
    deleted = resetModel.resetPhones([target.phone_number_id]);
  } else {
    const wabaId = target.waba_id;
    deleted = resetModel.resetWaba(wabaId, tenantService.phoneNumbersOfWaba(wabaId));
    templateService.forgetSeeded(wabaId);
  }

  logger.info({ target, deleted }, 'Test data reset');

  return { success: true, deleted };
}

module.exports = { reset };
