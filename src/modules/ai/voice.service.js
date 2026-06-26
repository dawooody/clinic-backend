const { prepareChatContext } = require('./ai.service');
const { transcribeAudio } = require('./stt.helper');
const { generateSpeech } = require('./tts.helper');
const { createHttpError, buildUserVoiceStoragePath } = require('./voice.helpers');
const {
  deleteStorageFile,
  uploadStorageFile,
  VOICE_FILES_BUCKET,
} = require('../medical-records/supabase.storage');
const {
  buildAudioAttachment,
} = require('./chat.persistence.helpers');
const { updateChatMessage } = require('./memory.repository');
const { resolveConversationForUser } = require('./conversation.service');

const ELEVENLABS_API_BASE_URL = 'https://api.elevenlabs.io/v1';

const voiceChat = async (file, options = {}) => {
  const { transcript } = await transcribeAudio(file);

  const conversation = await resolveConversationForUser({
    conversationId: options.conversationId,
    userId: options.userId,
  });
  const conversationId = conversation.id;

  // The existing chat service remains the single source of truth. Passing the
  // transcript through prepareChatContext preserves RAG retrieval, recent
  // messages, report summaries, multilingual behavior, storage, and summary
  // updates exactly like POST /api/ai/chat.
  const userVoiceStoragePath = buildUserVoiceStoragePath(options.userId, conversationId, file);
  const userVoiceUpload = await uploadStorageFile({
    bucketName: VOICE_FILES_BUCKET,
    storagePath: userVoiceStoragePath,
    buffer: file.buffer,
    contentType: file.mimetype,
  });

  const userVoiceAttachment = buildAudioAttachment({
    url: userVoiceUpload.fileUrl,
    storagePath: userVoiceUpload.storagePath,
    mimeType: file.mimetype,
  });

  let chatData;

  try {
    chatData = await prepareChatContext(transcript, {
      conversationId,
      userId: options.userId,
      userMessage: {
        attachments: [userVoiceAttachment],
        metadata: {
          transcript,
        },
      },
    });
  } catch (error) {
    await deleteStorageFile({
      bucketName: VOICE_FILES_BUCKET,
      storagePath: userVoiceUpload.storagePath,
    }).catch(() => {});

    throw error;
  }

  let replyAudioUrl = null;

  try {
    const speech = await generateSpeech(chatData.reply, {
      userId: options.userId,
      conversationId,
    });

    replyAudioUrl = speech.audioUrl;

    if (chatData?.storedMessages?.[1]?.id) {
      await updateChatMessage(chatData.storedMessages[1].id, {
        attachments: [buildAudioAttachment({
          url: speech.audioUrl,
          storagePath: speech.storagePath,
          mimeType: 'audio/mpeg',
          provider: 'ElevenLabs',
        })],
        metadata: {
          provider: 'ElevenLabs',
        },
      });
    }
  } catch (error) {
    if (error.status) {
      console.error('Voice chat TTS failed:', error.message);
    } else {
      console.error('Voice chat TTS failed:', error.message);
    }
  }

  return {
    success: true,
    conversationId,
    transcript,
    reply: chatData.reply,
    audioUrl: replyAudioUrl,
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
