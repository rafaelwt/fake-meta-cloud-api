const { db, templateModel } = require('../database/models');
const { templateSeeds } = require('../database/templateSeeds');
const { sendWebhook } = require('./webhookService');
const IdGenerator = require('../utils/idGenerator');
const { metaError } = require('../utils/metaError');
const { pickFields } = require('../utils/fields');
const config = require('../config');
const tenantService = require('./tenantService');
const logger = require('../logger');

// Graph returns these when `fields` is not given
const DEFAULT_FIELDS = ['name', 'parameter_format', 'components', 'language', 'status', 'category', 'rejected_reason'];
const DEFAULT_LIMIT = 25;
const DUPLICATE_SUBCODE = 2388024;
const REJECTED_REASON = 'INVALID_FORMAT';

// WABAs already seeded by this process (seeding is idempotent, this only skips the queries)
const seededWabas = new Set();

/**
 * Insert the seed templates for a WABA once
 * @param {string} wabaId - WhatsApp Business Account ID
 */
function ensureSeeded(wabaId) {
  if (seededWabas.has(wabaId)) return;

  for (const seed of templateSeeds) {
    templateModel.insert({
      ...seed,
      id: IdGenerator.generateNumericId(),
      waba_id: wabaId,
      status: 'APPROVED'
    }, { ignoreExisting: true });
  }
  seededWabas.add(wabaId);
}

/**
 * List templates of a WABA with Graph cursor pagination
 * @param {string} wabaId - WhatsApp Business Account ID
 * @param {object} query - limit, after, fields and optional name/status/category/language filters
 * @param {string} baseUrl - Absolute URL of this endpoint (for paging.next)
 * @returns {object} - { data, paging? }
 */
function listTemplates(wabaId, query, baseUrl) {
  ensureSeeded(wabaId);
  reviewDueTemplates();

  const limit = query.limit || DEFAULT_LIMIT;
  const start = query.after ? decodeCursor(query.after) : 0;

  const matching = templateModel.findByWaba(wabaId).filter(t =>
    (!query.name || t.name.includes(query.name)) &&
    (!query.status || t.status === query.status.toUpperCase()) &&
    (!query.category || t.category === query.category.toUpperCase()) &&
    (!query.language || t.language === query.language)
  );

  const page = matching.slice(start, start + limit);
  const data = page.map(t => pickFields(t, query.fields, DEFAULT_FIELDS));

  if (page.length === 0) return { data };

  const end = start + page.length;
  const paging = {
    cursors: { before: encodeCursor(start), after: encodeCursor(end) }
  };

  if (end < matching.length) {
    const next = new URL(baseUrl);
    for (const [key, value] of Object.entries(query)) {
      if (key !== 'after' && value !== undefined) next.searchParams.set(key, String(value));
    }
    next.searchParams.set('limit', String(limit));
    next.searchParams.set('after', encodeCursor(end));
    paging.next = next.toString();
  }

  return { data, paging };
}

/**
 * Create a template in PENDING status and schedule its review
 * @param {string} wabaId - WhatsApp Business Account ID
 * @param {object} body - { name, language, category, parameter_format?, components, message_send_ttl_seconds? }
 * @returns {object} - { response } or { error } in Meta format
 */
function createTemplate(wabaId, body) {
  ensureSeeded(wabaId);

  const template = {
    id: IdGenerator.generateNumericId(),
    waba_id: wabaId,
    name: body.name,
    language: body.language,
    category: body.category.toUpperCase(),
    status: 'PENDING',
    parameter_format: (body.parameter_format || 'POSITIONAL').toUpperCase(),
    components: body.components,
    message_send_ttl_seconds: body.message_send_ttl_seconds,
    review_at: Date.now() + config.templates.reviewDelayMs
  };

  try {
    templateModel.insert(template);
  } catch (err) {
    if (err.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw err;
    return {
      error: metaError(100, 'Invalid parameter', {
        error_subcode: DUPLICATE_SUBCODE,
        is_transient: false,
        error_user_title: 'Content in This Language Already Exists',
        error_user_msg: `There is already ${body.language} content for this template. You can create a new template and try again.`
      })
    };
  }

  logger.info({ wabaId, templateId: template.id, name: template.name }, 'Template created (PENDING)');

  setTimeout(reviewDueTemplates, config.templates.reviewDelayMs + 5).unref();

  return {
    response: { id: template.id, status: template.status, category: template.category }
  };
}

/**
 * Find the template a message refers to, after seeding and pending reviews
 * @param {string} wabaId - WhatsApp Business Account ID
 * @param {string} name - Template name
 * @param {string} language - Language code
 * @returns {object|undefined} - Stored template
 */
function findTemplate(wabaId, name, language) {
  ensureSeeded(wabaId);
  reviewDueTemplates();
  return templateModel.findByName(wabaId, name, language);
}

/**
 * Approve or reject every PENDING template whose review time has passed
 * Runs from a timer and on every read, so a restart never leaves templates PENDING
 */
function reviewDueTemplates() {
  if (!db.open) return;

  for (const template of templateModel.findDue(Date.now())) {
    const rejected = template.name.startsWith(config.templates.rejectPrefix);
    const status = rejected ? 'REJECTED' : 'APPROVED';
    const reason = rejected ? REJECTED_REASON : null;

    if (!templateModel.review(template.id, status, reason)) continue;

    logger.info({ templateId: template.id, name: template.name, status }, 'Template reviewed');

    const payload = buildStatusUpdatePayload(template, status, reason);
    for (const target of tenantService.webhookTargetsForWaba(template.waba_id)) {
      sendWebhook(
        target.webhook_url,
        payload,
        template.id,
        'message_template_status_update',
        { logEvent: false, appSecret: target.app_secret }
      ).catch(err => logger.error({ err, templateId: template.id }, 'Template webhook failed'));
    }
  }
}

/**
 * Build a message_template_status_update webhook payload
 */
function buildStatusUpdatePayload(template, status, reason) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: template.waba_id,
      time: Math.floor(Date.now() / 1000),
      changes: [{
        field: 'message_template_status_update',
        value: {
          event: status,
          message_template_id: Number(template.id),
          message_template_name: template.name,
          message_template_language: template.language,
          reason: reason || 'NONE'
        }
      }]
    }]
  };
}

function encodeCursor(offset) {
  return Buffer.from(String(offset)).toString('base64url');
}

function decodeCursor(cursor) {
  const offset = parseInt(Buffer.from(cursor, 'base64url').toString(), 10);
  return Number.isInteger(offset) && offset > 0 ? offset : 0;
}

module.exports = {
  listTemplates,
  createTemplate,
  findTemplate,
  reviewDueTemplates
};
