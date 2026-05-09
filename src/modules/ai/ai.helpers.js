const { detectLanguage } = require('./language.helpers');
const {
  buildChatContext,
  extractStructuredContentField,
} = require('./prompt.builders');

module.exports = {
  buildChatContext,
  detectLanguage,
  extractStructuredContentField,
};
