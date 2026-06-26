const { URL } = require('url');

const EMPTY_CHAT_ATTACHMENTS = [];
const EMPTY_CHAT_METADATA = {};

const clonePlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...value };
};

const normalizeChatMetadata = (metadata) => clonePlainObject(metadata);

const deriveStoragePathFromPublicUrl = (publicUrl) => {
  if (!publicUrl) {
    return null;
  }

  try {
    const pathname = new URL(publicUrl).pathname;
    const match = pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);

    if (!match?.[1]) {
      return null;
    }

    return decodeURIComponent(match[1]);
  } catch (error) {
    return null;
  }
};

const normalizeChatAttachment = (attachment) => {
  const source = clonePlainObject(attachment);

  if (!source.type || !source.url) {
    return null;
  }

  const normalized = {
    type: String(source.type),
    url: String(source.url),
  };

  if (source.storagePath || source.storage_path) {
    normalized.storagePath = String(source.storagePath || source.storage_path);
  } else {
    const derivedStoragePath = deriveStoragePathFromPublicUrl(normalized.url);
    if (derivedStoragePath) {
      normalized.storagePath = derivedStoragePath;
    }
  }

  if (source.mimeType || source.mime_type) {
    normalized.mimeType = String(source.mimeType || source.mime_type);
  }

  if (source.title) {
    normalized.title = String(source.title);
  }

  if (source.medicalRecordId || source.medical_record_id) {
    normalized.medicalRecordId = String(source.medicalRecordId || source.medical_record_id);
  }

  if (source.provider) {
    normalized.provider = String(source.provider);
  }

  return normalized;
};

const normalizeChatAttachments = (attachments) => {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return EMPTY_CHAT_ATTACHMENTS;
  }

  return attachments
    .map(normalizeChatAttachment)
    .filter(Boolean);
};

const buildAudioAttachment = ({ url, storagePath, mimeType, provider }) => normalizeChatAttachment({
  type: 'audio',
  url,
  storagePath,
  mimeType,
  provider,
});

const buildDocumentAttachment = ({ url, storagePath, title, medicalRecordId, mimeType }) => normalizeChatAttachment({
  type: 'pdf',
  url,
  storagePath,
  title,
  medicalRecordId,
  mimeType,
});

const buildImageAttachment = ({ url, storagePath, title, mimeType }) => normalizeChatAttachment({
  type: 'image',
  url,
  storagePath,
  title,
  mimeType,
});

const summarizeAttachments = (attachments) => {
  const normalizedAttachments = normalizeChatAttachments(attachments);

  if (normalizedAttachments.length === 0) {
    return '';
  }

  const labels = normalizedAttachments
    .map((attachment) => attachment.title || attachment.type)
    .filter(Boolean);

  if (labels.length === 0) {
    return 'Attachment';
  }

  return `Attachment: ${labels.join(', ')}`;
};

module.exports = {
  EMPTY_CHAT_ATTACHMENTS,
  EMPTY_CHAT_METADATA,
  buildAudioAttachment,
  buildDocumentAttachment,
  buildImageAttachment,
  deriveStoragePathFromPublicUrl,
  normalizeChatAttachments,
  normalizeChatMetadata,
  summarizeAttachments,
};
