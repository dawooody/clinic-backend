const { prepareChatContext } = require('./ai.service');
const { transcribeAudio } = require('./stt.helper');
const { generateSpeech } = require('./tts.helper');
const { createHttpError } = require('./voice.helpers');

const ELEVENLABS_API_BASE_URL = 'https://api.elevenlabs.io/v1';

const voiceChat = async (file, options = {}) => {
  const { transcript } = await transcribeAudio(file);

  // The existing chat service remains the single source of truth. Passing the
  // transcript through prepareChatContext preserves RAG retrieval, recent
  // messages, report summaries, multilingual behavior, storage, and summary
  // updates exactly like POST /api/ai/chat.
  const chatData = await prepareChatContext(transcript, {
    conversationId: options.conversationId,
    userId: options.userId,
  });

  let audioUrl = null;

  try {
    const speech = await generateSpeech(chatData.reply, {
      requestOrigin: options.requestOrigin,
    });
    audioUrl = speech.audioUrl;
  } catch (error) {
    // TTS is intentionally non-blocking for voice chat. If ElevenLabs or the
    // temporary MP3 write fails, users still receive the transcript and Qwen
    // reply produced by the existing RAG and memory-backed chat service.
    console.error('Voice chat TTS failed:', error.message);
  }

  return {
    success: true,
    conversationId: chatData.conversationId,
    transcript,
    reply: chatData.reply,
    audioUrl,
  };
};

const listVoices = async () => {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw createHttpError(500, 'ELEVENLABS_API_KEY is required to list ElevenLabs voices.');
  }

  const response = await fetch(`${ELEVENLABS_API_BASE_URL}/voices`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'xi-api-key': apiKey,
    },
  });

  const rawResponse = await response.text();
  console.log('ElevenLabs raw voices response:', rawResponse);

  if (!response.ok) {
    throw createHttpError(502, `ElevenLabs voices request failed with status ${response.status}`);
  }

  let parsedResponse;

  try {
    parsedResponse = JSON.parse(rawResponse);
  } catch (error) {
    throw new Error(`ElevenLabs voices response was not valid JSON: ${error.message}`);
  }

  const voices = Array.isArray(parsedResponse?.voices)
    ? parsedResponse.voices.map((voice) => ({
        voice_id: voice.voice_id,
        name: voice.name,
        category: voice.category ?? voice.labels?.category ?? null,
      }))
    : [];

  return {
    voices,
  };
};

module.exports = {
  listVoices,
  voiceChat,
};
