const service = require('./records.service');
const { success, error, paginated } = require('../../utils/response');

const upload = async (req, res, next) => {
  try {
    const data = await service.uploadRecord(req.user.id, req.body, req.file);
    return success(res, data, 'Medical record uploaded', 201);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getMyRecords = async (req, res, next) => {
  try {
    const { record_type, page, limit } = req.query;
    const { rows, count } = await service.getMyRecords(req.user.id, { record_type, page, limit });
    return paginated(res, rows, count, page || 1, limit || 10);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getPatientRecords = async (req, res, next) => {
  try {
    const { rows, count } = await service.getPatientRecords(req.user.id, req.params.patientId, req.query);
    return paginated(res, rows, count, req.query.page || 1, req.query.limit || 10);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const deleteRecord = async (req, res, next) => {
  try {
    await service.deleteRecord(req.user.id, req.params.id);
    return success(res, {}, 'Record deleted');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

module.exports = { upload, getMyRecords, getPatientRecords, deleteRecord };
