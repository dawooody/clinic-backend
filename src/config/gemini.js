const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleGenAI } = require('@google/genai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use gemini-1.5-flash for fast responses (best for mobile)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
let reportAnalysisModels;
const REPORT_ANALYSIS_MODEL_NAME = 'gemini-2.5-flash';
const REPORT_ANALYSIS_MAX_OUTPUT_TOKENS = 1024;
const REPORT_ANALYSIS_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  propertyOrdering: [
    'reportType',
    'summary',
    'detailedAnalysis',
    'severity',
    'normalFindings',
    'abnormalFindings',
    'recommendations',
    'followUp',
    'importantNotes',
  ],
  required: [
    'reportType',
    'summary',
    'detailedAnalysis',
    'severity',
    'normalFindings',
    'abnormalFindings',
    'recommendations',
    'followUp',
    'importantNotes',
  ],
  properties: {
    reportType: { type: 'string' },
    summary: { type: 'string' },
    detailedAnalysis: { type: 'string' },
    severity: { type: 'string' },
    normalFindings: {
      type: 'array',
      items: { type: 'string' },
    },
    abnormalFindings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        propertyOrdering: [
          'parameter',
          'value',
          'normalRange',
          'status',
          'explanation',
        ],
        required: [
          'parameter',
          'value',
          'normalRange',
          'status',
          'explanation',
        ],
        properties: {
          parameter: { type: 'string' },
          value: { type: 'string' },
          normalRange: { type: 'string' },
          status: { type: 'string' },
          explanation: { type: 'string' },
        },
      },
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
    },
    followUp: { type: 'string' },
    importantNotes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};
const reportAnalysisModel = {
  generateContent: (...args) => getReportAnalysisModel().generateContent(...args),
};

const SUPPORTED_REPORT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

/**
 * Send a prompt to Gemini and get a text response
 * @param {string} prompt
 * @returns {Promise<string>}
 */
const askGemini = async (prompt) => {
  const result = await model.generateContent(prompt);
  console.log(JSON.stringify(result, null, 2));
  return result.response.text();
};

const getReportAnalysisModel = () => {
  if (!reportAnalysisModels) {
    reportAnalysisModels = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }).models;
  }

  return reportAnalysisModels;
};

const buildReportAnalysisPrompt = () => [
  'Analyze this medical report carefully.',
  'Return only one valid JSON object.',
  'Do not return markdown, code fences, comments, labels, bullets, or any extra text before or after the JSON object.',
  'The response must be directly parsable with JSON.parse().',
  'Use this exact schema and key order:',
  '{"reportType":"","summary":"","detailedAnalysis":"","severity":"","normalFindings":[],"abnormalFindings":[{"parameter":"","value":"","normalRange":"","status":"","explanation":""}],"recommendations":[],"followUp":"","importantNotes":[]}',
  'Field requirements:',
  'reportType: identify the report or study type such as CBC, X-ray, MRI, CT, pathology, or ultrasound.',
  'summary: a short clinician-friendly overview.',
  'detailedAnalysis: a concise but more complete interpretation of the report content.',
  'severity: use exactly one of these values: normal, mild, moderate, severe, critical, unknown.',
  'normalFindings: array of strings listing findings that are explicitly normal. Use [] when none are stated.',
  'abnormalFindings: array of objects, one per abnormal or notable parameter. Use [] when none are stated.',
  'recommendations: array of practical next-step suggestions grounded in the report content. Use [] when none are appropriate.',
  'followUp: short text describing suggested follow-up timing or action, or an empty string if not available.',
  'importantNotes: array of strings for urgent cautions, limitations, or clinically important context. Use [] when none are stated.',
  'Use empty strings for unknown string values.',
  'Base the response only on the uploaded PDF or medical image.',
  'Do not provide a diagnosis beyond what is explicitly supported by the report.',
].join('\n');

const logReportAnalysisUsage = (response) => {
  const candidate = response?.candidates?.[0];
  const usage = response?.usageMetadata || {};
  const finishReason = candidate?.finishReason || 'UNKNOWN';
  const promptTokenCount = usage.promptTokenCount ?? null;
  const candidatesTokenCount = usage.candidatesTokenCount ?? usage.responseTokenCount ?? null;
  const thoughtsTokenCount = usage.thoughtsTokenCount ?? null;
  const totalTokenCount = usage.totalTokenCount ?? null;

  console.log('Gemini report analysis metadata:', JSON.stringify({
    finishReason,
    promptTokenCount,
    candidatesTokenCount,
    thoughtsTokenCount,
    totalTokenCount,
  }, null, 2));

  if (finishReason === 'MAX_TOKENS') {
    const outputTokens = candidatesTokenCount ?? 0;
    const thoughtTokens = thoughtsTokenCount ?? 0;
    const cause = thoughtTokens > outputTokens
      ? 'excessive thinking tokens likely consumed the budget before the answer was finished.'
      : 'output tokens likely ran out before the answer was finished.';

    console.warn(
      `Gemini report analysis was truncated with finishReason=MAX_TOKENS; ${cause}`,
    );
  }
};

const analyzeMedicalReport = async (file) => {
  if (!process.env.GEMINI_API_KEY) {
    throw createHttpError(500, 'Gemini API key is missing.');
  }

  if (!file?.buffer || !file.mimetype) {
    throw createHttpError(400, 'A report, PDF, or medical image file is required.');
  }

  if (!SUPPORTED_REPORT_MIME_TYPES.has(file.mimetype)) {
    throw createHttpError(
      400,
      'Unsupported file type. Upload a PDF, JPG, PNG, or WEBP file.'
    );
  }

  const prompt = buildReportAnalysisPrompt();

  try {
    const response = await getReportAnalysisModel().generateContent({
      model: REPORT_ANALYSIS_MODEL_NAME,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: file.mimetype,
              data: file.buffer.toString('base64'),
            },
          },
        ],
      }],
      config: {
        temperature: 0,
        maxOutputTokens: REPORT_ANALYSIS_MAX_OUTPUT_TOKENS,
        thinkingConfig: {
          thinkingBudget: 0,
          includeThoughts: false,
        },
        responseMimeType: 'application/json',
        responseJsonSchema: REPORT_ANALYSIS_RESPONSE_JSON_SCHEMA,
      },
    });

    logReportAnalysisUsage(response);

    const summary = (response.text || '').trim();
    if (!summary) {
      throw new Error('Gemini returned an empty report summary.');
    }

    return summary;
  } catch (error) {
    console.error('Gemini Report Error:', error);
    if (error.status) throw error;
    throw createHttpError(502, `Gemini report analysis failed: ${error.message}`);
  }
};

module.exports = {
  SUPPORTED_REPORT_MIME_TYPES,
  analyzeMedicalReport,
  askGemini,
  genAI,
  model,
  reportAnalysisModel,
};
