const { getSupabaseClient } = require('./supabase.client');

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

const storeChatMessage = async (conversationId, role, message, messageType) => {
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
    .insert({
      conversation_id: conversationId,
      role,
      message_type: normalizeMessageType(role, messageType),
      message: trimmedMessage,
    })
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
    .map(({ role, message, message_type, messageType }) => ({
      conversation_id: conversationId,
      role,
      message_type: normalizeMessageType(role, message_type || messageType),
      message: message?.trim(),
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

const getRecentMessages = async (conversationId, limit = DEFAULT_RECENT_MESSAGE_LIMIT) => {
  if (!conversationId) {
    return [];
  }

  const client = getSupabaseClient();
  const messageLimit = normalizeMessageLimit(limit);
  const { data, error } = await client
    .from('chats')
    .select('role,message,message_type,created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(messageLimit);

  if (error) {
    throw createHttpError(500, `Failed to load recent chat messages: ${error.message}`);
  }

  return (data || []).reverse();
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

module.exports = {
  DEFAULT_RECENT_MESSAGE_LIMIT,
  getConversationMessageCount,
  getConversationSummary,
  getRecentMessages,
  storeChatMessage,
  storeChatMessages,
  upsertConversationSummary,
};
