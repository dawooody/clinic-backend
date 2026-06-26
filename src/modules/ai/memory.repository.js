const { getSupabaseClient } = require('./supabase.client');
const {
  normalizeChatAttachments,
  normalizeChatMetadata,
} = require('./chat.persistence.helpers');

const DEFAULT_RECENT_MESSAGE_LIMIT = 6;

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeMessageLimit = (limit) => {
  const parsedLimit = Number(limit);
  return Number.isInteger(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : DEFAULT_RECENT_MESSAGE_LIMIT;
};

const ALLOWED_MESSAGE_TYPES = new Set([
  'user',
  'assistant',
  'report_summary',
  'image_analysis',
]);

const normalizeMessageType = (role, messageType) => {
  const fallbackType = role === 'user' ? 'user' : 'assistant';
  const cleanType = messageType?.trim();

  return ALLOWED_MESSAGE_TYPES.has(cleanType) ? cleanType : fallbackType;
};

const buildChatInsertRow = ({
  conversationId,
  role,
  message,
  messageType,
  attachments,
  metadata,
}) => {
  const trimmedMessage = message?.trim();

  return {
    conversation_id: conversationId,
    role,
    message_type: normalizeMessageType(role, messageType),
    message: trimmedMessage,
    attachments: normalizeChatAttachments(attachments),
    metadata: normalizeChatMetadata(metadata),
  };
};

const storeChatMessage = async (
  conversationId,
  role,
  message,
  messageType,
  options = {},
) => {
  const trimmedMessage = message?.trim();

  if (!conversationId) {
    throw createHttpError(400, 'conversationId is required.');
  }

  if (!['user', 'assistant'].includes(role)) {
    throw createHttpError(400, 'Chat message role must be user or assistant.');
  }

  if (!trimmedMessage) {
    throw createHttpError(400, 'Chat message is required.');
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('chats')
    .insert(buildChatInsertRow({
      conversationId,
      role,
      message: trimmedMessage,
      messageType,
      attachments: options.attachments,
      metadata: options.metadata,
    }))
    .select()
    .single();

  if (error) {
    throw createHttpError(500, `Failed to store chat message: ${error.message}`);
  }

  return data;
};

const storeChatMessages = async (conversationId, messages = []) => {
  if (!conversationId) {
    throw createHttpError(400, 'conversationId is required.');
  }

  const rows = messages
    .map(({ role, message, message_type, messageType, attachments, metadata }) => buildChatInsertRow({
      conversationId,
      role,
      message,
      messageType: message_type || messageType,
      attachments,
      metadata,
    }))
    .filter(({ role, message }) => ['user', 'assistant'].includes(role) && message);

  if (rows.length === 0) {
    return [];
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('chats')
    .insert(rows)
    .select();

  if (error) {
    throw createHttpError(500, `Failed to store chat messages: ${error.message}`);
  }

  return data || [];
};

const updateChatMessage = async (messageId, updates = {}) => {
  if (!messageId) {
    throw createHttpError(400, 'messageId is required.');
  }

  const client = getSupabaseClient();
  const patch = {};

  if (updates.message !== undefined) {
    const trimmedMessage = updates.message?.trim();
    if (trimmedMessage) {
      patch.message = trimmedMessage;
    }
  }

  if (updates.messageType !== undefined) {
    patch.message_type = normalizeMessageType(updates.role || 'assistant', updates.messageType);
  }

  if (updates.attachments !== undefined) {
    patch.attachments = normalizeChatAttachments(updates.attachments);
  }

  if (updates.metadata !== undefined) {
    patch.metadata = normalizeChatMetadata(updates.metadata);
  }

  if (Object.keys(patch).length === 0) {
    const { data, error } = await client
      .from('chats')
      .select('id,conversation_id,role,message,message_type,attachments,metadata,created_at')
      .eq('id', messageId)
      .maybeSingle();

    if (error) {
      throw createHttpError(500, `Failed to load chat message: ${error.message}`);
    }

    return data;
  }

  const { data, error } = await client
    .from('chats')
    .update(patch)
    .eq('id', messageId)
    .select('id,conversation_id,role,message,message_type,attachments,metadata,created_at')
    .single();

  if (error) {
    throw createHttpError(500, `Failed to update chat message: ${error.message}`);
  }

  return data;
};

const getRecentMessages = async (conversationId, limit = DEFAULT_RECENT_MESSAGE_LIMIT) => {
  if (!conversationId) {
    return [];
  }

  const client = getSupabaseClient();
  const messageLimit = normalizeMessageLimit(limit);
  const { data, error } = await client
    .from('chats')
    .select('role,message,message_type,attachments,metadata,created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(messageLimit);

  if (error) {
    throw createHttpError(500, `Failed to load recent chat messages: ${error.message}`);
  }

  return (data || []).reverse().map((message) => ({
    ...message,
    attachments: normalizeChatAttachments(message.attachments),
    metadata: normalizeChatMetadata(message.metadata),
  }));
};

const getConversationSummary = async (conversationId) => {
  if (!conversationId) {
    return '';
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('chat_summaries')
    .select('summary')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (error) {
    throw createHttpError(500, `Failed to load conversation summary: ${error.message}`);
  }

  return data?.summary?.trim() || '';
};

const upsertConversationSummary = async (conversationId, summary) => {
  if (!conversationId) {
    throw createHttpError(400, 'conversationId is required.');
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('chat_summaries')
    .upsert({
      conversation_id: conversationId,
      summary: summary?.trim() || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'conversation_id' })
    .select()
    .single();

  if (error) {
    throw createHttpError(500, `Failed to update conversation summary: ${error.message}`);
  }

  return data;
};

const getConversationMessageCount = async (conversationId) => {
  if (!conversationId) {
    return 0;
  }

  const client = getSupabaseClient();
  const { count, error } = await client
    .from('chats')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);

  if (error) {
    throw createHttpError(500, `Failed to count conversation messages: ${error.message}`);
  }

  return count || 0;
};

const conversationHasStoredContext = async (conversationId) => {
  if (!conversationId) {
    return false;
  }

  const client = getSupabaseClient();
  const [chatResult, summaryResult] = await Promise.all([
    client
      .from('chats')
      .select('id', { head: true, count: 'exact' })
      .eq('conversation_id', conversationId)
      .limit(1),
    client
      .from('chat_summaries')
      .select('conversation_id', { head: true, count: 'exact' })
      .eq('conversation_id', conversationId)
      .limit(1),
  ]);

  if (chatResult.error) {
    throw createHttpError(500, `Failed to inspect stored chat messages: ${chatResult.error.message}`);
  }

  if (summaryResult.error) {
    throw createHttpError(500, `Failed to inspect stored conversation summary: ${summaryResult.error.message}`);
  }

  return (chatResult.count || 0) > 0 || (summaryResult.count || 0) > 0;
};

module.exports = {
  conversationHasStoredContext,
  DEFAULT_RECENT_MESSAGE_LIMIT,
  getConversationMessageCount,
  getConversationSummary,
  getRecentMessages,
  storeChatMessage,
  storeChatMessages,
  updateChatMessage,
  upsertConversationSummary,
};
