const {
  User, Doctor, Patient, Appointment, DoctorSchedule, Specialty,
} = require('../../models');
const { Op } = require('sequelize');

// ─── APPOINTMENTS MANAGEMENT ─────────────────────────────────────────────────
const getAllAppointments = async ({ status, doctor_id, date, page = 1, limit = 20 }) => {
  const where = {};
  if (status)    where.status    = status;
  if (doctor_id) where.doctor_id = doctor_id;
  if (date)      where.appointment_date = date;

  const offset = (page - 1) * limit;
  const { rows, count } = await Appointment.findAndCountAll({
    where,
    include: [
      {
        model: Doctor, as: 'doctor',
        include: [{ model: User, as: 'user', attributes: ['full_name'] },
                  { model: Specialty, as: 'specialty', attributes: ['name'] }],
      },
      {
        model: Patient, as: 'patient',
        include: [{ model: User, as: 'user', attributes: ['full_name', 'phone'] }],
      },
    ],
    order: [['appointment_date', 'DESC'], ['time_slot', 'ASC']],
    limit: parseInt(limit),
    offset,
    distinct: true,
  });

  return { rows, count };
};

const updateAppointment = async (id, updates) => {
  const appointment = await Appointment.findByPk(id);
  if (!appointment) throw { status: 404, message: 'Appointment not found.' };
  await appointment.update(updates);
  return appointment;
};

// ─── DOCTORS MANAGEMENT ──────────────────────────────────────────────────────
const getAllDoctors = async ({ page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const { rows, count } = await Doctor.findAndCountAll({
    include: [
      { model: User,      as: 'user',      attributes: { exclude: ['password', 'refresh_token'] } },
      { model: Specialty, as: 'specialty', attributes: ['name'] },
    ],
    limit: parseInt(limit),
    offset,
    distinct: true,
  });
  return { rows, count };
};
// ─── PATIENTS MANAGEMENT ─────────────────────────────────────────────────────
const getAllPatients = async ({ page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const { rows, count } = await Patient.findAndCountAll({
    include: [
      { model: User, as: 'user', attributes: { exclude: ['password', 'refresh_token'] } },
    ],
    limit: parseInt(limit),
    offset,
    distinct: true,
  });
  return { rows, count };
};
// remove a doctor by id ---------
const removeDoctor = async (doctorId) => {
  const doctor = await Doctor.findByPk(doctorId, {
    include: [{ model: User, as: 'user' }],
  });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };

  await doctor.destroy();
  await doctor.user.destroy();

  return { message: 'Doctor removed successfully.' };
};
// remove all doctors
const removeAllDoctors = async () => {
  const doctors = await Doctor.findAll({
    include: [{ model: User, as: 'user' }],
  });

  for (const doctor of doctors) {
    await doctor.destroy();
    await doctor.user.destroy();
  }

  return { message: `${doctors.length} doctor(s) removed successfully.` };
};


// Admin creates a doctor account (doctors cannot self-register)
const createDoctor = async ({ full_name, email, password, phone, specialty_id, bio, license_number, years_experience, consultation_fee }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw { status: 409, message: 'Email already in use.' };

  const user = await User.create({ full_name, email, password, phone, role: 'doctor' });
  const doctor = await Doctor.create({
    id: user.id, // Use the same ID for doctor profile
    user_id: user.id,
    specialty_id,
    bio,
    license_number,
    years_experience: years_experience || 0,
    consultation_fee: consultation_fee || 0,
  });

  return { user: { id: user.id, full_name, email, role: 'doctor' }, doctor };
};

const toggleDoctorStatus = async (doctorId) => {
  const doctor = await Doctor.findByPk(doctorId, {
    include: [{ model: User, as: 'user' }],
  });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };
  const newStatus = !doctor.user.is_active;
  await doctor.user.update({ is_active: newStatus });
  return { is_active: newStatus };
};

// ─── SCHEDULE MANAGEMENT ─────────────────────────────────────────────────────
const getDoctorSchedule = async (doctorId) => {
  const doctor = await Doctor.findByPk(doctorId);
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };
  return DoctorSchedule.findAll({ where: { doctor_id: doctorId }, order: [['day_of_week', 'ASC']] });
};

const setDoctorSchedule = async (doctorId, schedules) => {
  const doctor = await Doctor.findByPk(doctorId);
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };

  await DoctorSchedule.destroy({ where: { doctor_id: doctorId } });
  return DoctorSchedule.bulkCreate(schedules.map((s) => ({ ...s, doctor_id: doctorId })));
};

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────
const getDashboardStats = async () => {
  const today = new Date().toISOString().split('T')[0];

  const [totalPatients, totalDoctors, todayAppointments, pendingAppointments] = await Promise.all([
    Patient.count(),
    Doctor.count(),
    Appointment.count({ where: { appointment_date: today } }),
    Appointment.count({ where: { status: 'pending' } }),
  ]);

  return { totalPatients, totalDoctors, todayAppointments, pendingAppointments };
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
  removeDoctor,
  removeAllDoctors,
};
