const service = require('./ai.service');
const { success, error } = require('../../utils/response');

const search = async (req, res, next) => {
  try {
    const { query } = req.body;
    const results = await service.searchDocuments(query);

    return res.status(200).json({
      success: true,
      results,
    });
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

const chat = async (req, res, next) => {
  try {
    const { message } = req.body;
    const data = await service.buildChatContext(message);

    return res.status(200).json({
      success: true,
      context: data.context,
      message: data.message,
      results: data.results,
    });
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

const chatbot = async (req, res, next) => {
  try {
    const { messages } = req.body;
    const data = await service.chatWithBot(messages);
    return success(res, data);
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

const preVisitSummary = async (req, res, next) => {
  try {
    const data = await service.getPreVisitSummary(req.params.appointmentId, req.user.id);
    return success(res, data);
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

const geneticRisks = async (req, res, next) => {
  try {
    const data = await service.getGeneticRisks(req.params.patientId, req.user.id);
    return success(res, data);
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

const summarizeRecord = async (req, res, next) => {
  try {
    const data = await service.summarizeRecord(req.params.recordId, req.user.id);
    return success(res, data);
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

module.exports = {
  chat,
  chatbot,
  geneticRisks,
  preVisitSummary,
  search,
  summarizeRecord,
};
