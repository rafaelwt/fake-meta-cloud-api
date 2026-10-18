const tenantService = require('../services/tenantService');
const { metaError } = require('../utils/metaError');

/**
 * POST /fake/tenants - register or update a phone number
 */
async function registerTenant(request, reply) {
  const { created, tenant } = tenantService.registerTenant(request.body);

  request.log.info({ phoneNumberId: tenant.phone_number_id, wabaId: tenant.waba_id, created }, 'Tenant registered');

  return reply.status(created ? 201 : 200).send(tenant);
}

/**
 * GET /fake/tenants - list registered phone numbers
 */
async function listTenants(request, reply) {
  return { data: tenantService.listTenants() };
}

/**
 * DELETE /fake/tenants/:phoneNumberId - remove a phone number
 */
async function removeTenant(request, reply) {
  const { phoneNumberId } = request.params;

  if (!tenantService.removeTenant(phoneNumberId)) {
    return reply.status(404).send(metaError(100, `Tenant ${phoneNumberId} does not exist`));
  }

  request.log.info({ phoneNumberId }, 'Tenant removed');

  return { success: true };
}

module.exports = {
  registerTenant,
  listTenants,
  removeTenant
};
