/**
 * Template category mapping for per-message pricing simulation
 * Maps template names to Meta pricing categories
 */

const VALID_CATEGORIES = ['marketing', 'utility', 'authentication'];

/**
 * Parse template categories from configuration string
 * Format: "otp_*:authentication,order_update:utility"
 * A trailing * matches any template name with that prefix
 * @param {string} categoriesString - Comma-separated name:category pairs
 * @returns {Map} - Map of name pattern to category
 */
function parseTemplateCategories(categoriesString) {
  const patterns = new Map();

  if (!categoriesString) {
    return patterns;
  }

  const pairs = categoriesString.split(',').map(p => p.trim());

  for (const pair of pairs) {
    const [pattern, category] = pair.split(':').map(p => p.trim());
    if (pattern && VALID_CATEGORIES.includes(category)) {
      patterns.set(pattern, category);
    }
  }

  return patterns;
}

/**
 * Resolve the pricing category for a template name
 * @param {string} templateName - Template name from the request
 * @param {Map} patterns - Map of name patterns to categories
 * @param {string} defaultCategory - Category when no pattern matches
 * @returns {string} - Pricing category
 */
function resolveTemplateCategory(templateName, patterns, defaultCategory) {
  for (const [pattern, category] of patterns.entries()) {
    const matches = pattern.endsWith('*')
      ? templateName.startsWith(pattern.slice(0, -1))
      : templateName === pattern;

    if (matches) {
      return category;
    }
  }

  return defaultCategory;
}

module.exports = {
  VALID_CATEGORIES,
  parseTemplateCategories,
  resolveTemplateCategory
};
