const service = require('./ai.service');
const { success, error } = require('../../utils/response');

const search = async (req, res, next) => {
  try {
    const { query } = req.body;
    const results = await service.searchDocuments(query);

    return res.status(200).json({
      success: true,
      results: results.map(({ disease, specialty, similarity, content }) => ({
        disease,
        specialty,
        similarity,
        content,
      })),
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
    const { conversationId, conversation_id, message } = req.body;
    const data = await service.prepareChatContext(message, {
      conversationId: conversationId || conversation_id,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      conversationId: data.conversationId,
      detectedLanguage: data.detectedLanguage,
      language: data.detectedLanguage,
      context: data.context,
      fallback: data.fallback,
      memoryContext: data.memoryContext,
      message: data.message,
      originalMessage: data.originalMessage,
      prompt: data.prompt,
      reply: data.reply,
      requiresTranslation: data.requiresTranslation,
      searchMessage: data.searchMessage,
      similarityThreshold: data.similarityThreshold,
      summaryUpdated: data.summaryUpdated,
      summaryUpdateError: data.summaryUpdateError,
      filteredResults: data.results,
      results: data.results,
    });
  } catch (err) {
    if (err.status) {
      return error(res, err.message, err.status);
    }

    return next(err);
  }
};

const analyzeReport = async (req, res, next) => {
  try {
    const { conversationId, conversation_id } = req.body;
    const data = await service.analyzeMedicalReport(req.file, {
      conversationId: conversationId || conversation_id,
      userId: req.user.id,
      metadata: req.body,
    });

    return res.status(201).json({
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
  analyzeReport,
  chat,
  geneticRisks,
  preVisitSummary,
  search,
  summarizeRecord,
};
