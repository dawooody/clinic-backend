const ARABIC_TEXT_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const detectLanguage = (text = '') => {
  return ARABIC_TEXT_REGEX.test(String(text)) ? 'ar' : 'en';
};

const createSearchMessage = (originalMessage, language = detectLanguage(originalMessage)) => {
  const trimmedMessage = String(originalMessage || '').trim();

  if (language === 'ar') {
    // Arabic should normally be translated by retrieval.service before this helper
    // is needed. Keep this fallback non-destructive so the original message is not lost.
    return trimmedMessage;
  }

  return trimmedMessage;
};

module.exports = {
  createSearchMessage,
  detectLanguage,
};
