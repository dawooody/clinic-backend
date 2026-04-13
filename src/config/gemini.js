const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use gemini-1.5-flash for fast responses (best for mobile)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Send a prompt to Gemini and get a text response
 * @param {string} prompt
 * @returns {Promise<string>}
 */
const askGemini = async (prompt) => {
  const result = await model.generateContent(prompt);
  return result.response.text();
};

module.exports = { genAI, model, askGemini };
