const { error } = require('../../utils/response');
const service = require('./conversation.service');

const createConversation = async (req, res, next) => {
  try {
    const conversation = await service.createConversation(req.user.id);

    return res.status(201).json({
      success: true,
      conversationId: conversation.id,
      title: service.DEFAULT_CONVERSATION_TITLE,
      createdAt: conversation.createdAt,
    });
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

const getConversations = async (req, res, next) => {
  try {
    const data = await service.getUserConversations(req.user.id, {
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      conversations: data.conversations,
      pagination: data.pagination,
    });
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

const getConversation = async (req, res, next) => {
  try {
    const data = await service.getConversationMessages(req.user.id, req.params.conversationId);

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

const renameConversation = async (req, res, next) => {
  try {
    const conversation = await service.updateConversationTitle(
      req.user.id,
      req.params.conversationId,
      req.body.title,
    );

    return res.status(200).json({
      success: true,
      conversationId: conversation.id,
      title: conversation.title,
    });
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

const deleteConversation = async (req, res, next) => {
  try {
    await service.deleteConversation(req.user.id, req.params.conversationId);

    return res.status(200).json({
      success: true,
    });
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

module.exports = {
  createConversation,
  deleteConversation,
  getConversation,
  getConversations,
  renameConversation,
};
