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

const getSchedule = async (req, res, next) => {
  try {
    const data = await service.getSchedule(req.user.id);
    return success(res, data);
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

const patchScheduleDay = async (req, res, next) => {
  try {
    const dayOfWeek = parseInt(req.params.day, 10);
    if (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return error(res, 'day must be an integer between 0 (Sun) and 6 (Sat).', 400);
    }
    const data = await service.patchScheduleDay(req.user.id, dayOfWeek, req.body);
    return success(res, data, 'Schedule day updated');
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

const getBreaks = async (req, res, next) => {
  try {
    const data = await service.getBreaks(req.user.id);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const createBreak = async (req, res, next) => {
  try {
    const { title, start_date, end_date } = req.body;
    const data = await service.createBreak(req.user.id, { title, start_date, end_date });
    return success(res, data, 'Break added', 201);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const deleteBreak = async (req, res, next) => {
  try {
    const data = await service.deleteBreak(req.user.id, req.params.id);
    return success(res, data, 'Break deleted');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getWeeklyStats = async (req, res, next) => {
  try {
    const data = await service.getWeeklyStats(req.user.id);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  getMyProfile,
  updateProfile,
  getSchedule,
  setSchedule,
  patchScheduleDay,
  getAvailableSlots,
  getBreaks,
  createBreak,
  deleteBreak,
  getWeeklyStats,
};