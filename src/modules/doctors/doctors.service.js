const { Doctor, User, Specialty, DoctorSchedule, Appointment } = require('../../models');
const { Op } = require('sequelize');

// Full doctor info (used in list and detail)
const doctorInclude = [
  { model: User,      as: 'user',      attributes: ['full_name', 'email', 'phone', 'profile_photo'] },
  { model: Specialty, as: 'specialty', attributes: ['id', 'name', 'icon'] },
  { model: DoctorSchedule, as: 'schedules' },
];

const getAllDoctors = async ({ specialty_id, search, page = 1, limit = 10 }) => {
  const where = {};
  if (specialty_id) where.specialty_id = specialty_id;

  const userWhere = {};
  if (search) userWhere.full_name = { [Op.like]: `%${search}%` };

  const offset = (page - 1) * limit;

  const { rows, count } = await Doctor.findAndCountAll({
    where,
    include: [
      { model: User,      as: 'user',      attributes: ['full_name', 'email', 'phone', 'profile_photo'], where: Object.keys(userWhere).length ? userWhere : undefined },
      { model: Specialty, as: 'specialty', attributes: ['id', 'name', 'icon'] },
    ],
    limit: parseInt(limit),
    offset,
    distinct: true,
  });

  return { rows, count };
};

const getDoctorById = async (doctorId) => {
  const doctor = await Doctor.findByPk(doctorId, { include: doctorInclude });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };
  return doctor;
};

const getDoctorByUserId = async (userId) => {
  const doctor = await Doctor.findOne({ where: { user_id: userId }, include: doctorInclude });
  if (!doctor) throw { status: 404, message: 'Doctor profile not found.' };
  return doctor;
};

const updateDoctorProfile = async (userId, body, file) => {
  const user   = await User.findByPk(userId);
  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor) throw { status: 404, message: 'Doctor profile not found.' };

  const { full_name, phone, bio, specialty_id, years_experience, consultation_fee, license_number } = body;

  const userUpdates = {};
  if (full_name) userUpdates.full_name = full_name;
  if (phone)     userUpdates.phone     = phone;
  if (file)      userUpdates.profile_photo = `${process.env.BASE_URL}/uploads/${file.filename}`;
  if (Object.keys(userUpdates).length) await user.update(userUpdates);

  const doctorUpdates = {};
  if (bio !== undefined)          doctorUpdates.bio              = bio;
  if (specialty_id)               doctorUpdates.specialty_id     = specialty_id;
  if (years_experience)           doctorUpdates.years_experience = years_experience;
  if (consultation_fee)           doctorUpdates.consultation_fee = consultation_fee;
  if (license_number)             doctorUpdates.license_number   = license_number;
  if (Object.keys(doctorUpdates).length) await doctor.update(doctorUpdates);

  return getDoctorByUserId(userId);
};

// Set or replace doctor's weekly schedule
const setSchedule = async (userId, schedules) => {
  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };

  // Delete existing and re-create (simplest approach for MVP)
  await DoctorSchedule.destroy({ where: { doctor_id: doctor.id } });

  const created = await DoctorSchedule.bulkCreate(
    schedules.map((s) => ({ ...s, doctor_id: doctor.id }))
  );
  return created;
};

/**
 * Return available time slots for a doctor on a specific date
 * Excludes already-booked slots
 */
const getAvailableSlots = async (doctorId, date) => {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0=Sun … 6=Sat

  const schedule = await DoctorSchedule.findOne({
    where: { doctor_id: doctorId, day_of_week: dayOfWeek, is_available: true },
  });
  if (!schedule) return [];

  // Generate all possible slots
  const slots = [];
  const [startH, startM] = schedule.start_time.split(':').map(Number);
  const [endH,   endM]   = schedule.end_time.split(':').map(Number);
  const duration = schedule.slot_duration_minutes;

  let current = startH * 60 + startM;
  const end   = endH   * 60 + endM;

  while (current + duration <= end) {
    const hh = String(Math.floor(current / 60)).padStart(2, '0');
    const mm = String(current % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
    current += duration;
  }

  // Remove already-booked slots
  const booked = await Appointment.findAll({
    where: {
      doctor_id: doctorId,
      appointment_date: date,
      status: { [Op.in]: ['pending', 'confirmed'] },
    },
    attributes: ['time_slot'],
  });

  const bookedTimes = booked.map((a) => a.time_slot.substring(0, 5));
  return slots.filter((s) => !bookedTimes.includes(s));
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  getDoctorByUserId,
  updateDoctorProfile,
  setSchedule,
  getAvailableSlots,
};
