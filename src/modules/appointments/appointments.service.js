const { Appointment, Patient, Doctor, User, Specialty, sequelize } = require('../../models');
const { Op } = require('sequelize');

const appointmentInclude = [
  {
    model: Patient, as: 'patient',
    include: [{ model: User, as: 'user', attributes: ['full_name', 'profile_photo'] }],
  },
  {
    model: Doctor, as: 'doctor',
    include: [
      { model: User, as: 'user', attributes: ['full_name'] },
      { model: Specialty, as: 'specialty', attributes: ['name'] },
    ],
  },
];

// ─── BOOK ─────────────────────────────────────────────────────────────────────
const bookAppointment = async (userId, body) => {
  const t = await sequelize.transaction();
  try {
    const patient = await Patient.findOne({ where: { user_id: userId } });
    if (!patient) throw { status: 404, message: 'Patient not found' };

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const appointmentDate = body.appointmentDate;

    // تحقق إن التاريخ مش قبل اليوم
    if (appointmentDate < today)
      throw { status: 400, message: 'Cannot book appointments in the past.' };

    // تحقق إن الـ slot مش محجوز
    const existing = await Appointment.findOne({
      where: {
        doctor_id: body.doctorId,
        appointment_date: appointmentDate,
        time_slot: body.timeSlot,
        status: { [Op.in]: ['pending', 'confirmed'] },
      },
    });
    if (existing) throw { status: 409, message: 'This time slot is already booked.' };

    const appointment = await Appointment.create(
      {
        doctor_id: body.doctorId,
        appointment_date: appointmentDate,
        time_slot: body.timeSlot,
        patient_notes: body.notes,
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

// ─── GET MY APPOINTMENTS ──────────────────────────────────────────────────────
const getMyAppointments = async (userId, role, { status, page = 1, limit = 10 }) => {
  const where = {};
  if (status) where.status = status;

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
    include: appointmentInclude,
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    order: [['appointment_date', 'DESC']],
  });
};

// ─── GET TODAY (DOCTOR) ───────────────────────────────────────────────────────
const getTodayAppointments = async (userId) => {
  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor) throw { status: 404, message: 'Doctor not found' };

  const today = new Date().toISOString().split('T')[0];

  const [total, completed, remaining, appointments] = await Promise.all([
    Appointment.count({ where: { doctor_id: doctor.id, appointment_date: today } }),
    Appointment.count({ where: { doctor_id: doctor.id, appointment_date: today, status: 'completed' } }),
    Appointment.count({ where: { doctor_id: doctor.id, appointment_date: today, status: { [Op.in]: ['pending', 'confirmed'] } } }),
    Appointment.findAll({
      where: { doctor_id: doctor.id, appointment_date: today },
      include: [
        {
          model: Patient, as: 'patient',
          include: [{ model: User, as: 'user', attributes: ['full_name', 'profile_photo'] }],
        },
      ],
      order: [['time_slot', 'ASC']],
    }),
  ]);

  return {
    stats: { total, completed, remaining },
    appointments,
  };
};

// ─── GET BY ID ────────────────────────────────────────────────────────────────
const getAppointmentById = async (id, userId, role) => {
  const appointment = await Appointment.findByPk(id, { include: appointmentInclude });
  if (!appointment) throw { status: 404, message: 'Appointment not found' };

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

// ─── CANCEL ───────────────────────────────────────────────────────────────────
const cancelAppointment = async (id, userId, role, reason) => {
  const appointment = await getAppointmentById(id, userId, role);
  if (!['pending', 'confirmed'].includes(appointment.status))
    throw { status: 400, message: 'Cannot cancel this appointment' };
  await appointment.update({ status: 'cancelled', cancellation_reason: reason });
  return appointment;
};

// ─── RESCHEDULE ───────────────────────────────────────────────────────────────
const rescheduleAppointment = async (id, userId, role, { appointmentDate, timeSlot }) => {
  const appointment = await getAppointmentById(id, userId, role);

  if (!['pending', 'confirmed'].includes(appointment.status))
    throw { status: 400, message: 'Cannot reschedule this appointment' };

  // تحقق إن الـ slot الجديد مش محجوز
  const existing = await Appointment.findOne({
    where: {
      doctor_id: appointment.doctor_id,
      appointment_date: appointmentDate,
      time_slot: timeSlot,
      status: { [Op.in]: ['pending', 'confirmed'] },
      id: { [Op.ne]: id },
    },
  });
  if (existing) throw { status: 409, message: 'This time slot is already booked.' };

  await appointment.update({ appointment_date: appointmentDate, time_slot: timeSlot, status: 'pending' });
  return appointment;
};

// ─── CONFIRM ──────────────────────────────────────────────────────────────────
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

// ─── COMPLETE ─────────────────────────────────────────────────────────────────
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

// ─── RATE ─────────────────────────────────────────────────────────────────────
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

// ─── DELETE ───────────────────────────────────────────────────────────────────
const deleteAppointment = async (id, userId, role) => {
  const appointment = await getAppointmentById(id, userId, role);
  if (!['cancelled', 'completed'].includes(appointment.status))
    throw { status: 400, message: 'Can only delete cancelled or completed appointments' };
  await appointment.destroy();
  return { message: 'Appointment deleted successfully' };
};

module.exports = {
  bookAppointment,
  getMyAppointments,
  getTodayAppointments,
  getAppointmentById,
  cancelAppointment,
  rescheduleAppointment,
  confirmAppointment,
  completeAppointment,
  rateAppointment,
  deleteAppointment,
};