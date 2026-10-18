/**
 * Apply the Graph API `fields` parameter to an object
 * Returns the requested fields (or the defaults) plus `id`, skipping empty values
 * @param {object} source - Full object
 * @param {string|undefined} fieldsParam - Comma separated field names
 * @param {string[]} defaultFields - Fields returned when none are requested
 * @returns {object} - Selected fields
 */
function pickFields(source, fieldsParam, defaultFields) {
  const requested = fieldsParam
    ? fieldsParam.split(',').map(f => f.trim()).filter(Boolean)
    : defaultFields;

  const result = {};
  for (const field of [...requested.filter(f => f !== 'id'), 'id']) {
    if (source[field] !== undefined && source[field] !== null) {
      result[field] = source[field];
    }
  }
  return result;
}

module.exports = { pickFields };
