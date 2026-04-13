const service = require('./prescriptions.service');
const { success, error, paginated } = require('../../utils/response');

const create = async (req, res, next) => {
  try {
    const data = await service.createPrescription(req.user.id, req.body);
    return success(res, data, 'Prescription created', 201);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getMyPrescriptions = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { rows, count } = await service.getMyPrescriptions(req.user.id, { page, limit });
    return paginated(res, rows, count, page || 1, limit || 10);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const data = await service.getPrescriptionById(req.params.id, req.user.id, req.user.role);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getPatientPrescriptions = async (req, res, next) => {
  try {
    const { rows, count } = await service.getPatientPrescriptions(req.user.id, req.params.patientId, req.query);
    return paginated(res, rows, count, req.query.page || 1, req.query.limit || 10);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

module.exports = { create, getMyPrescriptions, getById, getPatientPrescriptions };
