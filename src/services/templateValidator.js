const { metaError } = require('../utils/metaError');

const MEDIA_FORMATS = ['IMAGE', 'VIDEO', 'DOCUMENT'];

/**
 * Validate a template message against the stored template, like Graph does on send
 * @param {object|undefined} stored - Stored template (undefined if it does not exist)
 * @param {object} sent - message.template from the request
 * @returns {{statusCode: number, body: object}|null} - Error response or null when valid
 */
function validateTemplateSend(stored, sent) {
  const language = sent.language.code;

  if (!stored || stored.status !== 'APPROVED') {
    return error(404, 132001, '(#132001) Template name does not exist in the translation',
      `template name (${sent.name}) does not exist in ${language}`);
  }

  const named = stored.parameter_format === 'NAMED';
  const components = sent.components || [];
  const sentHeader = components.find(c => c.type === 'header');
  const sentBody = components.find(c => c.type === 'body');
  const sentUrlButtons = components.filter(c => c.type === 'button' && c.sub_type === 'url');

  const header = findComponent(stored, 'HEADER');
  const body = findComponent(stored, 'BODY');
  const buttons = findComponent(stored, 'BUTTONS')?.buttons || [];

  // Header
  const format = header?.format?.toUpperCase();
  if (MEDIA_FORMATS.includes(format)) {
    const param = sentHeader?.parameters?.[0];
    const media = param?.[format.toLowerCase()];
    if (param?.type !== format.toLowerCase()) {
      const received = param?.type ? param.type.toUpperCase() : 'UNKNOWN';
      return formatMismatch(`header: Format mismatch, expected ${format}, received ${received}`);
    }
    if (!(media?.link || media?.id)) {
      return formatMismatch(`header: ${format} parameter requires a link or id`);
    }
    if (sentHeader.parameters.length !== 1) {
      return countMismatch('header', sentHeader.parameters.length, 1);
    }
  } else if (format === 'LOCATION') {
    const params = sentHeader?.parameters || [];
    const location = params[0]?.location;
    if (params[0]?.type !== 'location' || location?.latitude === undefined || location?.longitude === undefined) {
      const received = params[0]?.type ? params[0].type.toUpperCase() : 'UNKNOWN';
      return formatMismatch(`header: Format mismatch, expected LOCATION with latitude and longitude, received ${received}`);
    }
    if (params.length !== 1) {
      return countMismatch('header', params.length, 1);
    }
  } else {
    const mismatch = checkTextParams('header', header?.text, sentHeader?.parameters, named);
    if (mismatch) return mismatch;
  }

  // Body
  const bodyMismatch = checkTextParams('body', body?.text, sentBody?.parameters, named);
  if (bodyMismatch) return bodyMismatch;

  // Buttons: one url parameter per dynamic URL button and per OTP (copy code / one tap) button
  const dynamicIndexes = buttons
    .map((button, index) => (isDynamicButton(button) ? index : null))
    .filter(index => index !== null);
  if (sentUrlButtons.length !== dynamicIndexes.length) {
    return error(400, 132000, '(#132000) Number of parameters does not match the expected number of params',
      `button: number of url button params (${sentUrlButtons.length}) does not match the expected number of params (${dynamicIndexes.length})`);
  }
  for (const component of sentUrlButtons) {
    if (!dynamicIndexes.includes(Number(component.index))) {
      return error(400, 132000, '(#132000) Number of parameters does not match the expected number of params',
        `button: index ${component.index} is not a dynamic URL or OTP button (expected one of: ${dynamicIndexes.join(', ')})`);
    }
    if ((component.parameters || []).length !== 1) {
      return countMismatch(`button ${component.index}`, (component.parameters || []).length, 1);
    }
  }

  return null;
}

/**
 * Check the parameters of a text section (header or body)
 */
function checkTextParams(section, text, params = [], named) {
  const expected = extractVariables(text || '');

  if (params.length !== expected.length) {
    return countMismatch(section, params.length, expected.length);
  }

  if (named) {
    const sentNames = params.map(p => p.parameter_name).filter(Boolean).sort();
    const expectedNames = [...expected].sort();
    if (sentNames.join(',') !== expectedNames.join(',')) {
      return error(400, 132000, '(#132000) Number of parameters does not match the expected number of params',
        `${section}: parameter_name values (${sentNames.join(', ') || 'none'}) do not match the expected names (${expectedNames.join(', ')})`);
    }
  }

  return null;
}

/**
 * Buttons that take a parameter on send: URL buttons with a variable, and
 * authentication OTP buttons (the code goes in a sub_type url parameter)
 */
function isDynamicButton(button) {
  const type = button.type?.toUpperCase();
  if (type === 'URL') return /\{\{.+?\}\}/.test(button.url || '');
  return type === 'OTP' && ['COPY_CODE', 'ONE_TAP'].includes(button.otp_type?.toUpperCase());
}

/**
 * Distinct variables of a template text ({{1}} or {{name}})
 */
function extractVariables(text) {
  return [...new Set([...text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)].map(m => m[1]))];
}

function findComponent(template, type) {
  return template.components.find(c => c.type?.toUpperCase() === type);
}

function formatMismatch(details) {
  return error(400, 132012, '(#132012) Parameter format does not match format in the created template', details);
}

function countMismatch(section, received, expected) {
  return error(400, 132000, '(#132000) Number of parameters does not match the expected number of params',
    `${section}: number of localizable_params (${received}) does not match the expected number of params (${expected})`);
}

function error(statusCode, code, message, details) {
  return {
    statusCode,
    body: metaError(code, message, { error_data: { messaging_product: 'whatsapp', details } })
  };
}

module.exports = { validateTemplateSend };
