const service = require('./admin.service');
const { success, error, paginated } = require('../../utils/response');

const getAllAppointments = async (req, res, next) => {
  try {
    const { status, doctor_id, date, page, limit } = req.query;
    const { rows, count } = await service.getAllAppointments({ status, doctor_id, date, page, limit });
    return paginated(res, rows, count, page || 1, limit || 20);
  } catch (err) { next(err); }
};

const updateAppointment = async (req, res, next) => {
  try {
    const data = await service.updateAppointment(req.params.id, req.body);
    return success(res, data, 'Appointment updated');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getAllDoctors = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { rows, count } = await service.getAllDoctors({ page, limit });
    return paginated(res, rows, count, page || 1, limit || 20);
  } catch (err) { next(err); }
};

const createDoctor = async (req, res, next) => {
  try {
    const data = await service.createDoctor(req.body);
    return success(res, data, 'Doctor account created', 201);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};
const getAllPatients = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { rows, count } = await service.getAllPatients({ page, limit });
    return paginated(res, rows, count, page || 1, limit || 20);
  } catch (err) { next(err); }
};

const removeDoctor = async (req, res, next) => {
  try {
    const data = await service.removeDoctor(req.params.id);
    return success(res, data, 'Doctor removed');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const removeAllDoctors = async (req, res, next) => {
  try {
    const data = await service.removeAllDoctors();
    return success(res, data, 'All doctors removed');
  } catch (err) { next(err); }
};

const toggleDoctorStatus = async (req, res, next) => {
  try {
    const data = await service.toggleDoctorStatus(req.params.id);
    return success(res, data, 'Doctor status updated');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getDoctorSchedule = async (req, res, next) => {
  try {
    const data = await service.getDoctorSchedule(req.params.id);
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const setDoctorSchedule = async (req, res, next) => {
  try {
    const { schedules } = req.body;
    if (!schedules || !Array.isArray(schedules)) {
      return error(res, 'schedules must be an array.', 400);
    }
    const data = await service.setDoctorSchedule(req.params.id, schedules);
    return success(res, data, 'Schedule updated');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const data = await service.getDashboardStats();
    return success(res, data);
  } catch (err) { next(err); }
};

module.exports = {
  getAllAppointments,
  updateAppointment,
  getAllDoctors,
  createDoctor,
  toggleDoctorStatus,
  getDoctorSchedule,
  setDoctorSchedule,
  getDashboardStats,
  getAllPatients,
  removeAllDoctors,
  removeDoctor,
};
