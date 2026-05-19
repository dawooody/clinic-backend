const { askGroq } = require('./llm.helpers');
const {
  getConversationSummary,
  getRecentMessages,
  upsertConversationSummary,
} = require('./memory.repository');
const { formatRecentMessages } = require('./memory.helpers');

const SUMMARY_UPDATE_INTERVAL = 10;
const SUMMARY_RECENT_MESSAGE_LIMIT = 12;

const buildSummaryPrompt = (previousSummary, recentMessages) => [
  'You maintain long-term memory for a multilingual medical triage chatbot.',
  'Update the conversation summary using the previous summary and the recent messages.',
  '',
  'Keep only durable medical context:',
  '- important symptoms',
  '- recurring conditions',
  '- relevant medical history',
  '- language preference',
  '- important context that affects future replies',
  '',
  'Avoid greetings, small talk, repeated filler, and unnecessary conversation details.',
  'Be concise. Use neutral clinical wording. Do not add facts that are not present.',
  'Return only the updated summary. If there is no important context, return exactly EMPTY_SUMMARY.',
  '',
  'Previous Summary:',
  previousSummary?.trim() || 'None available.',
  '',
  'Recent Messages:',
  formatRecentMessages(recentMessages),
].join('\n');

const updateConversationSummary = async (conversationId) => {
  const previousSummary = await getConversationSummary(conversationId);
  const recentMessages = await getRecentMessages(conversationId, SUMMARY_RECENT_MESSAGE_LIMIT);
  const prompt = buildSummaryPrompt(previousSummary, recentMessages);
  const rawSummary = await askGroq(prompt);
  const summary = rawSummary.trim() === 'EMPTY_SUMMARY' ? '' : rawSummary;

  await upsertConversationSummary(conversationId, summary);
  return summary;
};

module.exports = {
  SUMMARY_RECENT_MESSAGE_LIMIT,
  SUMMARY_UPDATE_INTERVAL,
  buildSummaryPrompt,
  updateConversationSummary,
};
