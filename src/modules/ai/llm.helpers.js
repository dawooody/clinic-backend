const OpenAI = require('openai');

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3-32b';

let groqClient;

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const cleanGroqResponse = (response = '') => {
  if (typeof response !== 'string') {
    return '';
  }

  return response
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<think\b[^>]*>[\s\S]*$/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const getGroqClient = () => {
  if (groqClient) {
    return groqClient;
  }

  if (!process.env.GROQ_API_KEY) {
    throw createHttpError(500, 'Groq API key is missing.');
  }

  groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: GROQ_BASE_URL,
  });

  return groqClient;
};

const askGroq = async (prompt) => {
  const trimmedPrompt = prompt?.trim();

  if (!trimmedPrompt) {
    throw createHttpError(400, 'Prompt is required.');
  }

  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: [
            'Return only the final user-facing answer.',
            'Do not output internal reasoning.',
            'Do not include <think> tags or hidden chain-of-thought.',
          ].join(' '),
        },
        {
          role: 'user',
          content: trimmedPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 700,
    });

    const rawReply = completion.choices?.[0]?.message?.content;
    const reply = cleanGroqResponse(rawReply);

    if (!reply) {
      throw new Error('Groq returned an empty response.');
    }

    return reply;
  } catch (error) {
    if (error.status) {
      throw error;
    }

    throw createHttpError(502, `Groq request failed: ${error.message}`);
  }
};

module.exports = {
  GROQ_BASE_URL,
  GROQ_MODEL,
  askGroq,
  cleanGroqResponse,
};
