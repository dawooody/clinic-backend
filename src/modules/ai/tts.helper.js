const { createHttpError, buildAssistantVoiceStoragePath } = require('./voice.helpers');
const {
  VOICE_FILES_BUCKET,
  uploadStorageFile,
} = require('../medical-records/supabase.storage');

const ELEVENLABS_API_BASE_URL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const ELEVENLABS_OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128';

const generateElevenLabsSpeech = async (text) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey) {
    throw createHttpError(500, 'ELEVENLABS_API_KEY is required for speech generation.');
  }

  if (!voiceId) {
    throw createHttpError(500, 'ELEVENLABS_VOICE_ID is required for speech generation.');
  }

  const response = await fetch(
    `${ELEVENLABS_API_BASE_URL}/text-to-speech/${voiceId}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL_ID,
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`ElevenLabs responded with ${response.status}${details ? `: ${details}` : ''}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  if (audioBuffer.length === 0) {
    throw new Error('ElevenLabs returned empty audio data.');
  }

  return audioBuffer;
};

const generateSpeech = async (text, options = {}) => {
  const cleanText = text?.trim();
  const { userId, conversationId } = options;

  if (!cleanText) {
    throw createHttpError(400, 'Text is required for speech generation.');
  }

  if (!userId || !conversationId) {
    throw createHttpError(400, 'userId and conversationId are required for voice storage.');
  }

  try {
    const audioBuffer = await generateElevenLabsSpeech(cleanText);
    const storagePath = buildAssistantVoiceStoragePath(userId, conversationId);
    let audioUrl;

    try {
      ({ fileUrl: audioUrl } = await uploadStorageFile({
        bucketName: VOICE_FILES_BUCKET,
        storagePath,
        buffer: audioBuffer,
        contentType: 'audio/mpeg',
      }));
    } catch (error) {
      if (error.status) {
        throw error;
      }

      throw createHttpError(502, `Text-to-speech upload failed: ${error.message}`);
    }

    return {
      audioUrl,
      storagePath,
      mimeType: 'audio/mpeg',
    };
  } catch (error) {
    if (error.status) {
      throw error;
    }

    throw createHttpError(502, `Text-to-speech generation failed: ${error.message}`);
  }
};

module.exports = {
  generateSpeech,
};
