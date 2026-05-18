const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use gemini-1.5-flash for fast responses (best for mobile)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const reportAnalysisModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 1024, // ✅ Increased from 400 to prevent mid-sentence cutoff
  },
});

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

  const prompt = `
Analyze this medical report carefully.

Return a complete concise medical summary in plain text.

Requirements:
- Write 3-5 complete sentences.
- Mention important abnormal findings clearly.
- Mention if there are no critical abnormalities.
- Keep the response memory-friendly for future chatbot conversations.
- Do not use markdown.
- Do not use bullet points.
- Do not return JSON.
- Do not provide diagnosis.
- Do not return incomplete sentences.
`;

  try {
    const result = await reportAnalysisModel.generateContent({
      contents: [
        {
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
        },
      ],
      // ✅ Removed duplicate generationConfig — already set on the model above
    });

    // ✅ Check why the model stopped — "STOP" is good, "MAX_TOKENS" means it was cut
    const candidate = result.response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    console.log('FINISH REASON:', finishReason);

    if (finishReason === 'MAX_TOKENS') {
      console.warn('Warning: Output was truncated due to token limit.');
    }

    const summary = result.response.text().trim();
    console.log('FULL SUMMARY:', summary);
    console.log('SUMMARY LENGTH:', summary.length);

    // ✅ Optional safety net: warn if response looks incomplete
    const endsCleanly = /[.!?]$/.test(summary);
    if (!endsCleanly) {
      console.warn('Summary may be incomplete — does not end with punctuation.');
    }

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