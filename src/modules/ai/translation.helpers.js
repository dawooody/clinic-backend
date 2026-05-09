const { askGroq } = require('./llm.helpers');

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const translateToEnglish = async (text) => {
  const trimmedText = text?.trim();

  if (!trimmedText) {
    throw createHttpError(400, 'Text is required for translation.');
  }

  const prompt = [
    'Translate the following Arabic medical message to English.',
    'Preserve the medical meaning, symptoms, body parts, duration, severity, and patient intent.',
    'Return ONLY the translated English text. Do not add explanations, labels, quotes, or notes.',
    'Do not output internal reasoning or <think> tags.',
    '',
    trimmedText,
  ].join('\n');

  try {
    const translatedText = await askGroq(prompt);
    return translatedText.replace(/^["']|["']$/g, '').trim();
  } catch (error) {
    if (error.status) {
      throw error;
    }

    throw createHttpError(502, `Translation failed: ${error.message}`);
  }
};

module.exports = {
  translateToEnglish,
};
