const { uploadModel } = require('../database/models');
const IdGenerator = require('../utils/idGenerator');
const { metaError } = require('../utils/metaError');
const logger = require('../logger');

// File types accepted for template header samples
const SUPPORTED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'video/mp4', 'application/pdf'];
const UPLOAD_PREFIX = 'upload:';

function invalidParameter(details) {
  return { error: metaError(100, `(#100) ${details}`) };
}

/**
 * Start a Resumable Upload session
 * @param {string} appId - App ID from the path
 * @param {object} query - file_name, file_length, file_type
 * @returns {object} - { response: { id: 'upload:<id>' } } or { error }
 */
function createSession(appId, query) {
  const fileLength = Number(query.file_length);

  if (!query.file_length || !Number.isInteger(fileLength) || fileLength <= 0) {
    return invalidParameter('The parameter file_length is required and must be a positive integer');
  }
  if (!SUPPORTED_FILE_TYPES.includes(query.file_type)) {
    return invalidParameter(`The parameter file_type must be one of: ${SUPPORTED_FILE_TYPES.join(', ')}`);
  }

  const id = IdGenerator.generateToken();
  uploadModel.insert({
    id,
    app_id: appId,
    file_name: query.file_name,
    file_length: fileLength,
    file_type: query.file_type
  });

  logger.info({ appId, uploadId: id, fileLength, fileType: query.file_type }, 'Upload session created');

  return { response: { id: UPLOAD_PREFIX + id } };
}

/**
 * Check whether a node id refers to an upload session
 * @param {string} nodeId - Path segment
 * @returns {boolean}
 */
function isUploadId(nodeId) {
  return nodeId.startsWith(UPLOAD_PREFIX);
}

/**
 * Receive file bytes for an upload session
 * @param {string} uploadId - 'upload:<id>'
 * @param {number} fileOffset - Offset of this chunk (file_offset header)
 * @param {Buffer} bytes - Raw body
 * @returns {object} - { response: { h } } when complete, { response: { id, file_offset } } otherwise, or { error }
 */
function receiveBytes(uploadId, fileOffset, bytes) {
  const session = uploadModel.findById(uploadId.slice(UPLOAD_PREFIX.length));

  if (!session) {
    return invalidParameter(`Upload session ${uploadId} does not exist`);
  }
  if (session.handle) {
    return invalidParameter(`Upload session ${uploadId} is already complete`);
  }
  if (!Number.isInteger(fileOffset) || fileOffset !== session.file_offset) {
    return invalidParameter(`file_offset must be ${session.file_offset}`);
  }

  const received = fileOffset + bytes.length;
  if (received > session.file_length) {
    return invalidParameter(`Received ${received} bytes but file_length is ${session.file_length}`);
  }

  const complete = received === session.file_length;
  const handle = complete
    ? `4::${Buffer.from(session.file_type).toString('base64')}:${IdGenerator.generateToken(32)}`
    : null;

  uploadModel.updateProgress(session.id, received, handle);

  logger.info({ uploadId, received, complete }, 'Upload bytes received');

  return complete
    ? { response: { h: handle } }
    : { response: { id: uploadId, file_offset: received } };
}

/**
 * Get the progress of an upload session
 * @param {string} uploadId - 'upload:<id>'
 * @returns {object} - { response: { id, file_offset } } or { error }
 */
function getSession(uploadId) {
  const session = uploadModel.findById(uploadId.slice(UPLOAD_PREFIX.length));

  if (!session) {
    return invalidParameter(`Upload session ${uploadId} does not exist`);
  }

  return { response: { id: uploadId, file_offset: session.file_offset } };
}

module.exports = {
  createSession,
  isUploadId,
  receiveBytes,
  getSession
};
