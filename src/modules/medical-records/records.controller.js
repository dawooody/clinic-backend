const service = require('./records.supabase.service');
const { success, error } = require('../../utils/response');

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
    const records = await service.getMyRecords(req.user.id, req.query);
    return res.status(200).json(records);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getRecord = async (req, res, next) => {
  try {
    const record = await service.getRecord(req.user.id, req.params.id);
    return res.status(200).json(record);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const deleteRecord = async (req, res, next) => {
  try {
    await service.deleteRecord(req.user.id, req.params.id);
    return res.status(200).json({ success: true });
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

module.exports = { upload, getMyRecords, getRecord, deleteRecord };
