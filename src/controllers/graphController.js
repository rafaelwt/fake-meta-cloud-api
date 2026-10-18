const phoneNumberService = require('../services/phoneNumberService');
const templateService = require('../services/templateService');
const uploadService = require('../services/uploadService');
const { metaError } = require('../utils/metaError');

/**
 * Send a service result: { response } as 200, { error } as 400
 */
function sendResult(reply, result) {
  if (result.error) return reply.status(400).send(result.error);
  return result.response;
}

/**
 * GET /:version/:nodeId - phone number node or upload session status
 */
async function getNode(request, reply) {
  const { nodeId } = request.params;

  if (uploadService.isUploadId(nodeId)) {
    return sendResult(reply, uploadService.getSession(nodeId));
  }

  return sendResult(reply, phoneNumberService.getPhoneNumber(nodeId, request.query.fields));
}

/**
 * POST /:version/:nodeId - upload file bytes to an upload session
 */
async function postNode(request, reply) {
  const { nodeId } = request.params;

  if (!uploadService.isUploadId(nodeId)) {
    const path = request.url.split('?')[0];
    return reply.status(400).send(metaError(2500, `Unknown path components: ${path}`));
  }

  const offsetHeader = request.headers.file_offset;
  const fileOffset = offsetHeader === undefined ? 0 : Number(offsetHeader);
  const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);

  return sendResult(reply, uploadService.receiveBytes(nodeId, fileOffset, bytes));
}

/**
 * GET /:version/:wabaId/message_templates
 */
async function listTemplates(request, reply) {
  const { wabaId } = request.params;
  const baseUrl = `${request.protocol}://${request.host}${request.url.split('?')[0]}`;

  return templateService.listTemplates(wabaId, request.query, baseUrl);
}

/**
 * POST /:version/:wabaId/message_templates
 */
async function createTemplate(request, reply) {
  const { wabaId } = request.params;

  return sendResult(reply, templateService.createTemplate(wabaId, request.body));
}

/**
 * POST /:version/:appId/uploads - start a Resumable Upload session
 */
async function createUploadSession(request, reply) {
  const { appId } = request.params;

  return sendResult(reply, uploadService.createSession(appId, request.query));
}

module.exports = {
  getNode,
  postNode,
  listTemplates,
  createTemplate,
  createUploadSession
};
