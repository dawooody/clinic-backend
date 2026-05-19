const extractStructuredContentField = (content, fieldName) => {
  if (typeof content !== 'string' || typeof fieldName !== 'string') {
    return null;
  }

  const match = content.match(new RegExp(`${fieldName}:\\s*([^.]*)`, 'i'));
  return match?.[1]?.trim() || null;
};

const normalizeContextValue = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
};

const getSymptomsText = (result) => {
  return normalizeContextValue(
    result.symptoms || extractStructuredContentField(result.content, 'Symptoms') || result.content,
    'Not specified',
  );
};

const buildChatContext = (results = [], originalMessage = '') => {
  const trimmedMessage = normalizeContextValue(originalMessage, 'Not provided');
  const cleanResults = Array.isArray(results) ? results : [];

  const conditionsBlock = cleanResults.length > 0
    ? cleanResults
      .map((result, index) => {
        const disease = normalizeContextValue(result.disease, 'Unknown condition');
        const specialty = normalizeContextValue(result.specialty, 'Unknown');
        const symptoms = getSymptomsText(result);

        return [
          `${index + 1}. ${disease}`,
          `   Specialty: ${specialty}`,
          `   Symptoms: ${symptoms}`,
        ].join('\n');
      })
      .join('\n\n')
    : 'No high-confidence possible conditions found.';

  return [
    'Possible conditions:',
    '',
    conditionsBlock,
    '',
    'User symptoms:',
    trimmedMessage,
  ].join('\n');
};

const buildMedicalPrompt = (context, originalMessage, language = 'en', memoryContext = '') => {
  const responseLanguage = language === 'ar' ? 'Arabic' : 'English';
  const cleanMemoryContext = memoryContext?.trim() || [
    'Conversation Summary:',
    'None available.',
    '',
    'Recent Messages:',
    'None available.',
  ].join('\n');

  return [
    'You are a careful medical assistant for a clinic application.',
    'Use the retrieved medical context to help triage the user symptoms, but do not invent facts that are not supported by the context.',
    'Do not provide a definitive diagnosis or claim certainty.',
    'Mention possible relevant conditions or specialties only as possibilities.',
    'Encourage the user to consult a licensed doctor, especially for severe, worsening, or emergency symptoms.',
    'Keep the response concise, natural, and mobile-friendly.',
    `Respond in the same language as the user: ${responseLanguage}.`,
    'Do not output internal reasoning, analysis, or <think> tags.',
    'Return only the final response that should be shown to the user.',
    'If the retrieved context has no confident matches, say that more details are needed and ask one or two useful follow-up questions.',
    '',
    cleanMemoryContext,
    '',
    'Retrieved Medical RAG Context:',
    context || 'No context available.',
    '',
    'Current User Message:',
    originalMessage || 'Not provided',
  ].join('\n');
};

module.exports = {
  buildChatContext,
  buildMedicalPrompt,
  extractStructuredContentField,
};
