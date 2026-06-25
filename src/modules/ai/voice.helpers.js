const path = require('path');

const MAX_AUDIO_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
]);

const SUPPORTED_AUDIO_EXTENSIONS = new Set(['.webm', '.mp3', '.wav', '.m4a']);

const AUDIO_MIME_BY_EXTENSION = {
  '.webm': 'audio/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getAudioExtension = (file) => path.extname(file?.originalname || '').toLowerCase();

const isSupportedAudioFile = (file) => {
  const extension = getAudioExtension(file);
  return SUPPORTED_AUDIO_MIME_TYPES.has(file?.mimetype) || SUPPORTED_AUDIO_EXTENSIONS.has(extension);
};

const getAudioMimeType = (file) => {
  if (SUPPORTED_AUDIO_MIME_TYPES.has(file?.mimetype)) {
    return file.mimetype;
  }

  return AUDIO_MIME_BY_EXTENSION[getAudioExtension(file)] || 'application/octet-stream';
};

const getAudioFilename = (file) => {
  const originalName = file?.originalname?.trim();
  const extension = getAudioExtension(file);

  if (originalName && SUPPORTED_AUDIO_EXTENSIONS.has(extension)) {
    return originalName;
  }

  const fallbackExtension = Object.keys(AUDIO_MIME_BY_EXTENSION).find(
    (key) => AUDIO_MIME_BY_EXTENSION[key] === getAudioMimeType(file),
  );

  if (originalName) {
    return `${originalName}${fallbackExtension || '.webm'}`;
  }

  return `voice-message${fallbackExtension || '.webm'}`;
};

const validateAudioFile = (file) => {
  if (!file) {
    throw createHttpError(400, 'Audio file is required.');
  }

  if (!file.buffer || file.size === 0) {
    throw createHttpError(400, 'Audio file is empty.');
  }

  if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
    throw createHttpError(413, 'Audio file too large. Max 10MB.');
  }

  if (!isSupportedAudioFile(file)) {
    throw createHttpError(400, 'Unsupported audio type. Upload a WEBM, MP3, WAV, or M4A file.');
  }
};

module.exports = {
  AUDIO_MIME_BY_EXTENSION,
  MAX_AUDIO_FILE_SIZE_BYTES,
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_AUDIO_MIME_TYPES,
  createHttpError,
  getAudioFilename,
  getAudioMimeType,
  isSupportedAudioFile,
  validateAudioFile,
};
