const { Appointment, Patient, Doctor, sequelize } = require('../../models');

// Book
const bookAppointment = async (userId, body) => {
  const t = await sequelize.transaction();
  try {
    const patient = await Patient.findOne({ where: { user_id: userId } });
    if (!patient) throw { status: 404, message: 'Patient not found' };

    const appointment = await Appointment.create(
      {
        doctor_id: body.doctorId,
        appointment_date: body.appointmentDate,
        time_slot: body.timeSlot,
        notes: body.notes,
        patient_id: patient.id,
      },
      { transaction: t }
    );

    await t.commit();
    return appointment;
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// Get My Appointments
const getMyAppointments = async (userId, role, { status, page = 1, limit = 10 }) => {
  const where = {};
  if (status) where.status = status;

  // ✅ فلترة حسب الـ role
  if (role === 'patient') {
    const patient = await Patient.findOne({ where: { user_id: userId } });
    if (!patient) throw { status: 404, message: 'Patient not found' };
    where.patient_id = patient.id;
  } else if (role === 'doctor') {
    const doctor = await Doctor.findOne({ where: { user_id: userId } });
    if (!doctor) throw { status: 404, message: 'Doctor not found' };
    where.doctor_id = doctor.id;
  }

  return Appointment.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    order: [['appointment_date', 'DESC']],
  });
};

// Get Today (Doctor)
const getTodayAppointments = async (userId) => {
  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor) throw { status: 404, message: 'Doctor not found' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return Appointment.findAll({
    where: {
      doctor_id: doctor.id,
      appointment_date: { [Op.gte]: today, [Op.lt]: tomorrow },
    },
    order: [['time_slot', 'ASC']],
  });
};

// Get By ID
const getAppointmentById = async (id, userId, role) => {
  const appointment = await Appointment.findByPk(id);
  if (!appointment) throw { status: 404, message: 'Appointment not found' };

  // ✅ التحقق إن اليوزر صاحب الـ appointment
  if (role === 'patient') {
    const patient = await Patient.findOne({ where: { user_id: userId } });
    if (!patient || appointment.patient_id !== patient.id)
      throw { status: 403, message: 'Access denied' };
  } else if (role === 'doctor') {
    const doctor = await Doctor.findOne({ where: { user_id: userId } });
    if (!doctor || appointment.doctor_id !== doctor.id)
      throw { status: 403, message: 'Access denied' };
  }

  return appointment;
};

// Cancel
const cancelAppointment = async (id, userId, role, reason) => {
  const appointment = await getAppointmentById(id, userId, role);

  if (!['pending', 'confirmed'].includes(appointment.status))
    throw { status: 400, message: 'Cannot cancel this appointment' };

  await appointment.update({ status: 'cancelled', cancellation_reason: reason });
  return appointment;
};

// Confirm
const confirmAppointment = async (id, userId) => {
  const appointment = await Appointment.findByPk(id);
  if (!appointment) throw { status: 404, message: 'Not found' };

  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor || appointment.doctor_id !== doctor.id)
    throw { status: 403, message: 'Access denied' };

  if (appointment.status !== 'pending')
    throw { status: 400, message: 'Only pending appointments can be confirmed' };

  await appointment.update({ status: 'confirmed' });
  return appointment;
};
//delete
const deleteAppointment = async (id, userId, role) => {
  const appointment = await getAppointmentById(id, userId, role);

  if (!['cancelled', 'completed'].includes(appointment.status))
    throw { status: 400, message: 'Can only delete cancelled or completed appointments' };

  await appointment.destroy();
  return { message: 'Appointment deleted successfully' };
};

// Complete
const completeAppointment = async (id, userId, notes) => {
  const appointment = await Appointment.findByPk(id);
  if (!appointment) throw { status: 404, message: 'Not found' };

  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor || appointment.doctor_id !== doctor.id)
    throw { status: 403, message: 'Access denied' };

  if (appointment.status !== 'confirmed')
    throw { status: 400, message: 'Only confirmed appointments can be completed' };

  await appointment.update({ status: 'completed', doctor_notes: notes });
  return appointment;
};

// Rate
const rateAppointment = async (id, userId, rating) => {
  const appointment = await Appointment.findByPk(id);
  if (!appointment) throw { status: 404, message: 'Not found' };

  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (!patient || appointment.patient_id !== patient.id)
    throw { status: 403, message: 'Access denied' };

  if (appointment.status !== 'completed')
    throw { status: 400, message: 'Can only rate completed appointments' };

  if (appointment.rating)
    throw { status: 400, message: 'Already rated' };

  await appointment.update({ rating });
  return appointment;
};

module.exports = {
  bookAppointment,
  getMyAppointments,
  getTodayAppointments,
  getAppointmentById,
  cancelAppointment,
  confirmAppointment,
  completeAppointment,
  rateAppointment,
  deleteAppointment,
};