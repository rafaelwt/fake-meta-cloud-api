const { tenantModel } = require('../database/models');
const config = require('../config');

/**
 * Tenants: registered phone numbers with their own token, webhook and app secret
 * Unregistered IDs use the default tenant built from .env (single-tenant behavior)
 */

/**
 * Default tenant from .env (not stored)
 * @returns {object} - Tenant
 */
function defaultTenant() {
  return {
    phone_number_id: config.meta.phoneNumberId,
    waba_id: config.meta.wabaId,
    display_phone_number: config.meta.displayPhoneNumber,
    verified_name: config.meta.verifiedName,
    quality_rating: config.meta.qualityRating,
    access_token: config.auth.accessToken,
    webhook_url: config.webhook.url,
    app_secret: config.meta.appSecret,
    is_default: true
  };
}

/**
 * Fill optional fields of a stored tenant with the .env defaults
 */
function withDefaults(row) {
  const fallback = defaultTenant();
  return {
    ...row,
    display_phone_number: row.display_phone_number || fallback.display_phone_number,
    verified_name: row.verified_name || fallback.verified_name,
    quality_rating: row.quality_rating || fallback.quality_rating,
    webhook_url: row.webhook_url || fallback.webhook_url,
    app_secret: row.app_secret || fallback.app_secret,
    is_default: false
  };
}

/**
 * Tenant that owns a phone number ID (the default tenant when not registered)
 * @param {string} phoneNumberId - Phone number ID from the path
 * @returns {object} - Tenant
 */
function tenantForPhone(phoneNumberId) {
  const row = tenantModel.findByPhone(phoneNumberId);
  return row ? withDefaults(row) : defaultTenant();
}

/**
 * Registered tenants of a WABA
 * @param {string} wabaId - WhatsApp Business Account ID
 * @returns {Array} - Tenants (empty when the WABA has no registered numbers)
 */
function tenantsForWaba(wabaId) {
  return tenantModel.findByWaba(wabaId).map(withDefaults);
}

/**
 * Every number of a WABA: its registered tenants, plus the default tenant
 * when it is WABA_ID and PHONE_NUMBER_ID is not registered
 * @param {string} wabaId - WhatsApp Business Account ID
 * @returns {Array} - Tenants (empty for a WABA nobody owns)
 */
function membersOfWaba(wabaId) {
  const members = tenantsForWaba(wabaId);
  if (wabaId === config.meta.wabaId && !tenantModel.findByPhone(config.meta.phoneNumberId)) {
    members.push(defaultTenant());
  }
  return members;
}

/**
 * Webhook destinations for WABA-level events (e.g. template status updates)
 * One per distinct webhook URL + secret; the default tenant when none is registered
 * @param {string} wabaId - WhatsApp Business Account ID
 * @returns {Array<{webhook_url: string, app_secret: string}>}
 */
function webhookTargetsForWaba(wabaId) {
  const tenants = membersOfWaba(wabaId);
  const targets = new Map();
  for (const tenant of tenants.length ? tenants : [defaultTenant()]) {
    targets.set(`${tenant.webhook_url}|${tenant.app_secret}`, {
      webhook_url: tenant.webhook_url,
      app_secret: tenant.app_secret
    });
  }
  return [...targets.values()];
}

/**
 * Tokens allowed to call a route
 * @param {string} scope - 'phone' (ID is a phone number), 'waba' (ID is a WABA),
 *   'node' (phone number or upload session) or 'any' (no owner, e.g. upload sessions)
 * @param {string} id - ID from the path
 * @returns {string[]} - Accepted access tokens
 */
function acceptedTokens(scope, id) {
  if (scope === 'node') {
    return acceptedTokens(String(id).startsWith('upload:') ? 'any' : 'phone', id);
  }

  if (scope === 'phone') {
    return [tenantForPhone(id).access_token];
  }

  if (scope === 'waba') {
    const tenants = membersOfWaba(id);
    return tenants.length ? tenants.map(t => t.access_token) : [config.auth.accessToken];
  }

  return [config.auth.accessToken, ...tenantModel.findAll().map(t => t.access_token)];
}

/**
 * WABA whose templates a phone number sends
 * Registered numbers use their waba_id; PHONE_NUMBER_ID uses WABA_ID;
 * any other ID is treated as its own WABA
 * @param {string} phoneNumberId - Phone number ID from the path
 * @returns {string} - WABA ID
 */
function templateWabaFor(phoneNumberId) {
  const row = tenantModel.findByPhone(phoneNumberId);
  if (row) return row.waba_id;
  return phoneNumberId === config.meta.phoneNumberId ? config.meta.wabaId : phoneNumberId;
}

/**
 * Phone number IDs that belong to a WABA (registered numbers, plus PHONE_NUMBER_ID for WABA_ID)
 * @param {string} wabaId - WhatsApp Business Account ID
 * @returns {string[]} - Phone number IDs
 */
function phoneNumbersOfWaba(wabaId) {
  return membersOfWaba(wabaId).map(t => t.phone_number_id);
}

/**
 * Tenant fields safe to return (no access_token or app_secret)
 */
function publicView(row) {
  return {
    phone_number_id: row.phone_number_id,
    waba_id: row.waba_id,
    display_phone_number: row.display_phone_number,
    verified_name: row.verified_name,
    quality_rating: row.quality_rating,
    webhook_url: row.webhook_url,
    has_app_secret: Boolean(row.app_secret),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Register or update a tenant
 * @param {object} body - Tenant data
 * @returns {{created: boolean, tenant: object}} - Public view of the stored tenant
 */
function registerTenant(body) {
  const created = tenantModel.upsert(body);
  return { created, tenant: publicView(tenantModel.findByPhone(body.phone_number_id)) };
}

/**
 * List registered tenants
 * @returns {Array} - Public views
 */
function listTenants() {
  return tenantModel.findAll().map(publicView);
}

/**
 * Remove a tenant
 * @param {string} phoneNumberId - Phone number ID
 * @returns {boolean} - Whether it existed
 */
function removeTenant(phoneNumberId) {
  return tenantModel.delete(phoneNumberId);
}

module.exports = {
  defaultTenant,
  tenantForPhone,
  tenantsForWaba,
  webhookTargetsForWaba,
  acceptedTokens,
  templateWabaFor,
  phoneNumbersOfWaba,
  registerTenant,
  listTenants,
  removeTenant
};
