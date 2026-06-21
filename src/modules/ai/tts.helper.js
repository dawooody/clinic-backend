const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createHttpError } = require('./voice.helpers');

const AUDIO_UPLOAD_DIR = path.join(__dirname, '../../../uploads/audio');
const AUDIO_URL_PREFIX = '/uploads/audio';
const ELEVENLABS_API_BASE_URL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const ELEVENLABS_OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128';
const AUDIO_FILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const createAudioFilename = () => `voice-reply-${Date.now()}-${uuidv4()}.mp3`;

const ensureAudioDirectory = async () => {
  await fs.mkdir(AUDIO_UPLOAD_DIR, { recursive: true });
};

const cleanupOldAudioFiles = async () => {
  try {
    await ensureAudioDirectory();

    const files = await fs.readdir(AUDIO_UPLOAD_DIR, { withFileTypes: true });
    const now = Date.now();

    await Promise.all(
      files
        .filter((file) => file.isFile() && file.name.endsWith('.mp3'))
        .map(async (file) => {
          const filePath = path.join(AUDIO_UPLOAD_DIR, file.name);
          const stats = await fs.stat(filePath);

          if (now - stats.mtimeMs > AUDIO_FILE_MAX_AGE_MS) {
            await fs.unlink(filePath);
          }
        }),
    );
  } catch (error) {
    console.error('Audio cleanup failed:', error.message);
  }
};

const buildAudioUrl = (requestOrigin, filename) => {
  const baseUrl = requestOrigin?.replace(/\/$/, '');
  const relativeUrl = `${AUDIO_URL_PREFIX}/${filename}`;

  return baseUrl ? `${baseUrl}${relativeUrl}` : relativeUrl;
};

const writeMp3File = async (audioBuffer, requestOrigin) => {
  try {
    await ensureAudioDirectory();

    const filename = createAudioFilename();
    const filePath = path.join(AUDIO_UPLOAD_DIR, filename);

    await fs.writeFile(filePath, audioBuffer);

    const audioUrl = buildAudioUrl(requestOrigin, filename);

    console.log('Generated file path:', filePath);
    console.log('Generated audio URL:', audioUrl);

    return {
      audioUrl,
      filePath,
    };
  } catch (error) {
    throw createHttpError(500, `Temporary audio file creation failed: ${error.message}`);
  }
};

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

  if (!cleanText) {
    throw createHttpError(400, 'Text is required for speech generation.');
  }

  try {
    await cleanupOldAudioFiles();

    const audioBuffer = await generateElevenLabsSpeech(cleanText);
    const audioFile = await writeMp3File(audioBuffer, options.requestOrigin);

    return {
      ...audioFile,
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
  AUDIO_FILE_MAX_AGE_MS,
  AUDIO_UPLOAD_DIR,
  AUDIO_URL_PREFIX,
  cleanupOldAudioFiles,
  generateSpeech,
};
