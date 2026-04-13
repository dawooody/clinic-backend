const service = require('./doctors.service');
const { success, error, paginated } = require('../../utils/response');

const getAllDoctors = async (req, res, next) => {
  try {
    const { specialty_id, search, page = 1, limit = 10 } = req.query;
    const { rows, count } = await service.getAllDoctors({ specialty_id, search, page, limit });
    return paginated(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

const getDoctorById = async (req, res, next) => {
  try {
    const data = await service.getDoctorById(req.params.id);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const data = await service.getDoctorByUserId(req.user.id);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const data = await service.updateDoctorProfile(req.user.id, req.body, req.file);
    return success(res, data, 'Profile updated');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const setSchedule = async (req, res, next) => {
  try {
    const { schedules } = req.body;
    if (!schedules || !Array.isArray(schedules)) {
      return error(res, 'schedules must be an array.', 400);
    }
    const data = await service.setSchedule(req.user.id, schedules);
    return success(res, data, 'Schedule updated');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getAvailableSlots = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return error(res, 'date query param is required (YYYY-MM-DD).', 400);
    const slots = await service.getAvailableSlots(req.params.id, date);
    return success(res, { slots });
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

module.exports = { getAllDoctors, getDoctorById, getMyProfile, updateProfile, setSchedule, getAvailableSlots };
