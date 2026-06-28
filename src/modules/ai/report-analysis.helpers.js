const EXPECTED_TOP_LEVEL_FIELDS = [
  'reportType',
  'summary',
  'detailedAnalysis',
  'severity',
  'normalFindings',
  'abnormalFindings',
  'recommendations',
  'followUp',
  'importantNotes',
];

const EXPECTED_ABNORMAL_FINDING_FIELDS = [
  'parameter',
  'value',
  'normalRange',
  'status',
  'explanation',
];

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const createValidationError = (message) => {
  const error = new Error(message);
  error.code = 'INVALID_REPORT_ANALYSIS';
  return error;
};

const parseGeminiReportAnalysis = (rawResponse) => {
  if (typeof rawResponse !== 'string' || !rawResponse.trim()) {
    throw createValidationError('Gemini returned an empty analysis response.');
  }

  try {
    return JSON.parse(rawResponse);
  } catch (error) {
    throw createValidationError(`Gemini returned invalid JSON: ${error.message}`);
  }
};

const validateArrayOfStrings = (value, fieldName) => {
  if (!Array.isArray(value)) {
    throw createValidationError(`Gemini analysis field "${fieldName}" must be an array.`);
  }

  for (const item of value) {
    if (typeof item !== 'string') {
      throw createValidationError(`Gemini analysis field "${fieldName}" must contain only strings.`);
    }
  }
};

const validateAbnormalFindings = (value) => {
  if (!Array.isArray(value)) {
    throw createValidationError('Gemini analysis field "abnormalFindings" must be an array.');
  }

  for (const [index, finding] of value.entries()) {
    if (!isPlainObject(finding)) {
      throw createValidationError(`Gemini abnormal finding at index ${index} must be an object.`);
    }

    const keys = Object.keys(finding);
    const missingFields = EXPECTED_ABNORMAL_FINDING_FIELDS.filter((field) => !(field in finding));
    if (missingFields.length > 0) {
      throw createValidationError(
        `Gemini abnormal finding at index ${index} is missing fields: ${missingFields.join(', ')}.`,
      );
    }

    const extraFields = keys.filter((field) => !EXPECTED_ABNORMAL_FINDING_FIELDS.includes(field));
    if (extraFields.length > 0) {
      throw createValidationError(
        `Gemini abnormal finding at index ${index} contains unexpected fields: ${extraFields.join(', ')}.`,
      );
    }

    for (const fieldName of EXPECTED_ABNORMAL_FINDING_FIELDS) {
      if (typeof finding[fieldName] !== 'string') {
        throw createValidationError(
          `Gemini abnormal finding field "${fieldName}" at index ${index} must be a string.`,
        );
      }
    }
  }
};

const validateGeminiReportAnalysis = (payload) => {
  if (!isPlainObject(payload)) {
    throw createValidationError('Gemini analysis response must be a JSON object.');
  }

  const keys = Object.keys(payload);
  const missingFields = EXPECTED_TOP_LEVEL_FIELDS.filter((field) => !(field in payload));
  if (missingFields.length > 0) {
    throw createValidationError(`Gemini analysis is missing fields: ${missingFields.join(', ')}.`);
  }

  const extraFields = keys.filter((field) => !EXPECTED_TOP_LEVEL_FIELDS.includes(field));
  if (extraFields.length > 0) {
    throw createValidationError(`Gemini analysis contains unexpected fields: ${extraFields.join(', ')}.`);
  }

  const stringFields = ['reportType', 'summary', 'detailedAnalysis', 'severity', 'followUp'];
  for (const fieldName of stringFields) {
    if (typeof payload[fieldName] !== 'string') {
      throw createValidationError(`Gemini analysis field "${fieldName}" must be a string.`);
    }
  }

  validateArrayOfStrings(payload.normalFindings, 'normalFindings');
  validateAbnormalFindings(payload.abnormalFindings);
  validateArrayOfStrings(payload.recommendations, 'recommendations');
  validateArrayOfStrings(payload.importantNotes, 'importantNotes');

  return payload;
};

const parseAndValidateGeminiReportAnalysis = (rawResponse) => {
  const parsed = parseGeminiReportAnalysis(rawResponse);
  return validateGeminiReportAnalysis(parsed);
};

module.exports = {
  EXPECTED_ABNORMAL_FINDING_FIELDS,
  EXPECTED_TOP_LEVEL_FIELDS,
  parseAndValidateGeminiReportAnalysis,
  parseGeminiReportAnalysis,
  validateGeminiReportAnalysis,
};
