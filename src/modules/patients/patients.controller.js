const service = require('./patients.service');
const { success, error } = require('../../utils/response');

const getProfile = async (req, res, next) => {
  try {
    const data = await service.getProfile(req.user.id);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const data = await service.updateProfile(req.user.id, req.body, req.file);
    return success(res, data, 'Profile updated');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getPatientById = async (req, res, next) => {
  try {
    const data = await service.getPatientById(req.params.id);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getDoctorPatients = async (req, res, next) => {
  try {
    const data = await service.getDoctorPatients(req.user.id);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getPatientById,
  getDoctorPatients,
};
