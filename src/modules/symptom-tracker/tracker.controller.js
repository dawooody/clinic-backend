const service = require('./tracker.service');
const { success, error, paginated } = require('../../utils/response');

const addLog = async (req, res, next) => {
  try {
    const data = await service.addLog(req.user.id, req.body);
    return success(res, data, 'Symptom log added', 201);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const updateLog = async (req, res, next) => {
  try {
    const data = await service.updateLog(req.user.id, req.params.id, req.body);
    return success(res, data, 'Log updated');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getMyLogs = async (req, res, next) => {
  try {
    const { from, to, page, limit } = req.query;
    const { rows, count } = await service.getMyLogs(req.user.id, { from, to, page, limit });
    return paginated(res, rows, count, page || 1, limit || 30);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getPatientLogs = async (req, res, next) => {
  try {
    const { rows, count } = await service.getPatientLogs(req.user.id, req.params.patientId, req.query);
    return paginated(res, rows, count, req.query.page || 1, req.query.limit || 30);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

module.exports = { addLog, updateLog, getMyLogs, getPatientLogs };
