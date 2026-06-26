const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

const getAudioStorageExtension = (file) => {
  const extension = getAudioExtension(file);

  if (SUPPORTED_AUDIO_EXTENSIONS.has(extension)) {
    return extension;
  }

  const fallbackExtension = Object.keys(AUDIO_MIME_BY_EXTENSION).find(
    (key) => AUDIO_MIME_BY_EXTENSION[key] === getAudioMimeType(file),
  );

  return fallbackExtension || '.webm';
};

const getAudioFilename = (file) => {
  const originalName = file?.originalname?.trim();
  const extension = getAudioStorageExtension(file);

  if (originalName && SUPPORTED_AUDIO_EXTENSIONS.has(extension)) {
    return originalName;
  }

  if (originalName) {
    return `${originalName}${extension}`;
  }

  return `voice-message${extension}`;
};

const sanitizeStorageSegment = (value, fallback = 'unknown') => {
  const safeValue = String(value ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return safeValue || fallback;
};

const buildUserVoiceStoragePath = (userId, conversationId, file) => {
  return `voice/user/${sanitizeStorageSegment(userId, 'user')}/${sanitizeStorageSegment(conversationId, 'conversation')}/${uuidv4()}${getAudioStorageExtension(file)}`;
};

const buildAssistantVoiceStoragePath = (userId, conversationId) => {
  return `voice/assistant/${sanitizeStorageSegment(userId, 'user')}/${sanitizeStorageSegment(conversationId, 'conversation')}/${uuidv4()}.mp3`;
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
  getAudioStorageExtension,
  buildAssistantVoiceStoragePath,
  buildUserVoiceStoragePath,
  isSupportedAudioFile,
  validateAudioFile,
};
