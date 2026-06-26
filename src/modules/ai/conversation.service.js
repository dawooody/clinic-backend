const { QueryTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Conversation } = require('../../models');
const { conversationHasStoredContext } = require('./memory.repository');
const {
  normalizeChatAttachments,
  normalizeChatMetadata,
} = require('./chat.persistence.helpers');

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeConversationId = (conversationId) => conversationId?.trim() || null;
const DEFAULT_CONVERSATION_TITLE = 'New Conversation';

const normalizePaginationValue = (value, fallback) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const formatConversationTitle = (title) => title?.trim() || DEFAULT_CONVERSATION_TITLE;

const createConversationRecord = async (userId, title = null, conversationId = uuidv4()) => {
  if (!userId) {
    throw createHttpError(401, 'Authentication is required to create a conversation.');
  }

  return Conversation.create({
    id: conversationId,
    user_id: userId,
    title: title?.trim() || null,
  });
};

const createConversation = async (userId, title = null) => (
  createConversationRecord(userId, title)
);

const getConversationById = async (conversationId) => {
  const normalizedConversationId = normalizeConversationId(conversationId);

  if (!normalizedConversationId) {
    return null;
  }

  return Conversation.findByPk(normalizedConversationId);
};

const verifyConversationOwnership = async (userId, conversationId) => {
  if (!userId) {
    throw createHttpError(401, 'Authentication is required to access this conversation.');
  }

  const normalizedConversationId = normalizeConversationId(conversationId);
  let conversation = await getConversationById(normalizedConversationId);

  if (!conversation) {
    const hasLegacyContext = await conversationHasStoredContext(normalizedConversationId);

    if (!hasLegacyContext) {
      throw createHttpError(404, 'Conversation not found.');
    }

    conversation = await adoptLegacyConversation(normalizedConversationId, userId);
  }

  if (conversation.user_id !== userId) {
    throw createHttpError(403, 'You do not have access to this conversation.');
  }

  return conversation;
};

const touchConversation = async (conversationId) => {
  const normalizedConversationId = normalizeConversationId(conversationId);

  if (!normalizedConversationId) {
    return;
  }

  await sequelize.query(
    'UPDATE conversations SET updated_at = NOW() WHERE id = :conversationId',
    {
      replacements: { conversationId: normalizedConversationId },
      type: QueryTypes.UPDATE,
    },
  );
};

const adoptLegacyConversation = async (conversationId, userId) => {
  const [conversation, created] = await Conversation.findOrCreate({
    where: { id: conversationId },
    defaults: {
      id: conversationId,
      user_id: userId,
      title: null,
    },
  });

  if (!created && conversation.user_id !== userId) {
    throw createHttpError(403, 'You do not have access to this conversation.');
  }

  return conversation;
};

const resolveConversationForUser = async ({ conversationId, userId, title = null } = {}) => {
  if (!userId) {
    throw createHttpError(401, 'Authentication is required to access conversations.');
  }

  const normalizedConversationId = normalizeConversationId(conversationId);

  if (!normalizedConversationId) {
    return createConversation(userId, title);
  }

  const existingConversation = await getConversationById(normalizedConversationId);
  if (existingConversation) {
    return verifyConversationOwnership(userId, normalizedConversationId);
  }

  const hasLegacyContext = await conversationHasStoredContext(normalizedConversationId);
  if (hasLegacyContext) {
    return adoptLegacyConversation(normalizedConversationId, userId);
  }

  throw createHttpError(404, 'Conversation not found.');
};

const getUserConversations = async (userId, options = {}) => {
  if (!userId) {
    throw createHttpError(401, 'Authentication is required to load conversations.');
  }

  const page = normalizePaginationValue(options.page, 1);
  const limit = Math.min(normalizePaginationValue(options.limit, 20), 100);
  const offset = (page - 1) * limit;

  const total = await Conversation.count({
    where: { user_id: userId },
  });

  const conversations = await sequelize.query(
    `SELECT
      c.id AS "conversationId",
      c.title,
      c.updated_at AS "updatedAt",
      COALESCE(chat_counts.message_count, 0) AS "messageCount",
      latest_chat.message AS "lastMessage"
    FROM conversations c
    LEFT JOIN (
      SELECT conversation_id, COUNT(*)::int AS message_count
      FROM chats
      GROUP BY conversation_id
    ) AS chat_counts
      ON chat_counts.conversation_id = c.id
    LEFT JOIN LATERAL (
      SELECT message
      FROM chats
      WHERE conversation_id = c.id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) AS latest_chat
      ON TRUE
    WHERE c.user_id = :userId
    ORDER BY c.updated_at DESC
    LIMIT :limit OFFSET :offset`,
    {
      replacements: {
        userId,
        limit,
        offset,
      },
      type: QueryTypes.SELECT,
    },
  );

  return {
    conversations: conversations.map((conversation) => ({
      conversationId: conversation.conversationId,
      title: formatConversationTitle(conversation.title),
      updatedAt: conversation.updatedAt,
      messageCount: Number(conversation.messageCount || 0),
      lastMessage: conversation.lastMessage || null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    },
  };
};

const getConversationMessages = async (userId, conversationId) => {
  const conversation = await verifyConversationOwnership(userId, conversationId);

  const messages = await sequelize.query(
    `SELECT
      id,
      role,
      message,
      message_type AS "messageType",
      attachments,
      metadata,
      created_at AS "createdAt"
    FROM chats
    WHERE conversation_id = :conversationId
    ORDER BY created_at ASC, id ASC`,
    {
      replacements: { conversationId: conversation.id },
      type: QueryTypes.SELECT,
    },
  );

  return {
    conversationId: conversation.id,
    title: formatConversationTitle(conversation.title),
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      message: message.message,
      messageType: ['user', 'assistant'].includes(message.messageType)
        ? 'chat'
        : message.messageType,
      attachments: normalizeChatAttachments(message.attachments),
      metadata: normalizeChatMetadata(message.metadata),
      createdAt: message.createdAt,
    })),
  };
};

const updateConversationTitle = async (userId, conversationId, title) => {
  const conversation = await verifyConversationOwnership(userId, conversationId);
  const normalizedTitle = title?.trim();

  if (!normalizedTitle) {
    throw createHttpError(400, 'Title is required.');
  }

  conversation.title = normalizedTitle;
  await conversation.save();

  return conversation;
};

const deleteConversation = async (userId, conversationId) => {
  const conversation = await verifyConversationOwnership(userId, conversationId);

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      'DELETE FROM chat_summaries WHERE conversation_id = :conversationId',
      {
        replacements: { conversationId: conversation.id },
        transaction,
        type: QueryTypes.DELETE,
      },
    );

    await sequelize.query(
      'DELETE FROM chats WHERE conversation_id = :conversationId',
      {
        replacements: { conversationId: conversation.id },
        transaction,
        type: QueryTypes.DELETE,
      },
    );

    await Conversation.destroy({
      where: { id: conversation.id },
      transaction,
    });
  });
};

module.exports = {
  createConversation,
  DEFAULT_CONVERSATION_TITLE,
  deleteConversation,
  getConversationById,
  getConversationMessages,
  getUserConversations,
  resolveConversationForUser,
  touchConversation,
  updateConversationTitle,
  verifyConversationOwnership,
};
