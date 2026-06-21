const { error } = require('../../utils/response');
const service = require('./voice.service');

const voiceChat = async (req, res, next) => {
  try {
    const { conversationId, conversation_id } = req.body;
    const data = await service.voiceChat(req.file, {
      conversationId: conversationId || conversation_id,
      requestOrigin: `${req.protocol}://${req.get('host')}`,
      userId: req.user.id,
    });

    return res.status(200).json(data);
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

const voices = async (req, res, next) => {
  try {
    const data = await service.listVoices();

    return res.status(200).json({
      success: true,
      voices: data.voices,
    });
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

module.exports = {
  voiceChat,
  voices,
};
