const service = require('./appointments.service');
const { success, error, paginated } = require('../../utils/response');

// Book
const book = async (req, res, next) => {
  try {
    const { doctorId, appointmentDate, timeSlot, notes } = req.body;
    const data = await service.bookAppointment(req.user.id, {
      doctorId, appointmentDate, timeSlot, notes,
    });
    return success(res, data, 'Appointment booked successfully', 201);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

// Get My Appointments
const getMyAppointments = async (req, res, next) => {
  try {
    const { status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { rows, count } = await service.getMyAppointments(
      req.user.id, req.user.role, { status, page, limit }
    );
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

// Today (Doctor)
const getToday = async (req, res, next) => {
  try {
    const data = await service.getTodayAppointments(req.user.id);
    return success(res, data);
  } catch (err) { next(err); }
};

// Get By ID
const getById = async (req, res, next) => {
  try {
    const data = await service.getAppointmentById(
      req.params.id, req.user.id, req.user.role
    );
    return success(res, data);
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

// Cancel
const cancel = async (req, res, next) => {
  try {
    const data = await service.cancelAppointment(
      req.params.id, req.user.id, req.user.role, req.body.reason
    );
    return success(res, data, 'Appointment cancelled');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

// Reschedule
const reschedule = async (req, res, next) => {
  try {
    const { appointmentDate, timeSlot } = req.body;
    if (!appointmentDate || !timeSlot)
      return error(res, 'appointmentDate and timeSlot are required.', 400);
    const data = await service.rescheduleAppointment(
      req.params.id, req.user.id, req.user.role, { appointmentDate, timeSlot }
    );
    return success(res, data, 'Appointment rescheduled');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

// Confirm
const confirm = async (req, res, next) => {
  try {
    const data = await service.confirmAppointment(req.params.id, req.user.id);
    return success(res, data, 'Appointment confirmed');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

// Complete
const complete = async (req, res, next) => {
  try {
    const data = await service.completeAppointment(
      req.params.id, req.user.id, req.body.notes
    );
    return success(res, data, 'Appointment completed');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

// Rate
const rate = async (req, res, next) => {
  try {
    const data = await service.rateAppointment(
      req.params.id, req.user.id, req.body.rating
    );
    return success(res, data, 'Rating submitted successfully');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

// Delete
const remove = async (req, res, next) => {
  try {
    const data = await service.deleteAppointment(
      req.params.id, req.user.id, req.user.role
    );
    return success(res, data, 'Appointment deleted');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    next(err);
  }
};

module.exports = { book, getMyAppointments, getToday, getById, cancel, reschedule, confirm, complete, rate, remove };