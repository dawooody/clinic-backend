const OpenAI = require('openai');
const { toFile } = require('openai');
const {
  createHttpError,
  getAudioFilename,
  getAudioMimeType,
  validateAudioFile,
} = require('./voice.helpers');

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo';

let groqAudioClient;

const getGroqAudioClient = () => {
  if (groqAudioClient) {
    return groqAudioClient;
  }

  if (!process.env.GROQ_API_KEY) {
    throw createHttpError(500, 'Groq API key is missing.');
  }

  groqAudioClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: GROQ_BASE_URL,
  });

  return groqAudioClient;
};

const normalizeTranscript = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
};

const transcribeAudio = async (file) => {
  validateAudioFile(file);

  try {
    const client = getGroqAudioClient();
    const uploadableAudio = await toFile(file.buffer, getAudioFilename(file), {
      type: getAudioMimeType(file),
    });

    // Groq Whisper is used only for speech-to-text because it exposes a fast,
    // OpenAI-compatible transcription endpoint. Medical reasoning still happens
    // in the existing Qwen RAG chat pipeline.
    const transcription = await client.audio.transcriptions.create({
      file: uploadableAudio,
      model: GROQ_WHISPER_MODEL,
      response_format: 'json',
      temperature: 0,
    });

    const transcript = normalizeTranscript(transcription?.text);

    if (!transcript) {
      throw createHttpError(422, 'Audio transcript is empty.');
    }

    return { transcript };
  } catch (error) {
    if (error.status) {
      throw error;
    }

    throw createHttpError(502, `Audio transcription failed: ${error.message}`);
  }
};

module.exports = {
  GROQ_BASE_URL,
  GROQ_WHISPER_MODEL,
  transcribeAudio,
};
