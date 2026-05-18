const formatMemoryRole = (role, messageType) => {
  if (messageType === 'report_summary') {
    return 'Medical Report Summary';
  }

  if (messageType === 'image_analysis') {
    return 'Medical Image Analysis';
  }

  return role === 'assistant' ? 'Assistant' : 'User';
};

const formatRecentMessages = (recentMessages = []) => {
  if (!Array.isArray(recentMessages) || recentMessages.length === 0) {
    return 'None available.';
  }

  return recentMessages
    .map(({ role, message, message_type }) => `${formatMemoryRole(role, message_type)}: ${message}`)
    .join('\n');
};

const buildMemoryContext = (summary = '', recentMessages = []) => {
  // Long-term memory is compressed into a summary so the LLM does not receive
  // the full chat history on every turn, which keeps token usage predictable.
  const cleanSummary = summary?.trim() || 'None available.';

  // Short-term memory keeps the latest turns verbatim so the assistant can
  // respond naturally to the immediate conversation without replaying old chat.
  return [
    'Conversation Summary:',
    cleanSummary,
    '',
    'Recent Messages:',
    formatRecentMessages(recentMessages),
  ].join('\n');
};

module.exports = {
  buildMemoryContext,
  formatRecentMessages,
};
