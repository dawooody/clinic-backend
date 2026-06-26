const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleGenAI } = require('@google/genai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use gemini-1.5-flash for fast responses (best for mobile)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
let reportAnalysisModels;
const REPORT_ANALYSIS_MODEL_NAME = 'gemini-2.5-flash';
const REPORT_ANALYSIS_MAX_OUTPUT_TOKENS = 1024;
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
  'Return plain text only. Do not use markdown, bullets, or JSON.',
  'Use exactly these section labels, in this order, each on its own line:',
  'Overall summary:',
  'Abnormal findings:',
  'Normal findings:',
  'Recommendations:',
  'Write concise complete sentences under each heading.',
  'If a section has no findings, write "None reported."',
  'Do not include any other headings.',
  'Do not provide a diagnosis.',
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
        temperature: 0.2,
        maxOutputTokens: REPORT_ANALYSIS_MAX_OUTPUT_TOKENS,
        thinkingConfig: {
          thinkingBudget: 0,
          includeThoughts: false,
        },
        responseMimeType: 'text/plain',
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
