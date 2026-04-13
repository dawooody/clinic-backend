const service = require('./ai.service');
const { success, error } = require('../../utils/response');

const chatbot = async (req, res, next) => {
  try {
    const { messages } = req.body;
    const data = await service.chatWithBot(messages);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const preVisitSummary = async (req, res, next) => {
  try {
    const data = await service.getPreVisitSummary(req.params.appointmentId, req.user.id);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const geneticRisks = async (req, res, next) => {
  try {
    const data = await service.getGeneticRisks(req.params.patientId, req.user.id);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const summarizeRecord = async (req, res, next) => {
  try {
    const data = await service.summarizeRecord(req.params.recordId, req.user.id);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

module.exports = { chatbot, preVisitSummary, geneticRisks, summarizeRecord };
