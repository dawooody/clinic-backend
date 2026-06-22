const { Doctor, User, Specialty, DoctorSchedule, Appointment, DoctorBreak, sequelize } = require('../../models');
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

// Set or replace doctor's entire weekly schedule (initial setup / full edits)
const setSchedule = async (userId, schedules) => {
  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };

  // Delete-then-recreate must be atomic: without a transaction, a failure in
  // bulkCreate after destroy() succeeds would leave the doctor with NO schedule.
  const t = await sequelize.transaction();
  try {
    await DoctorSchedule.destroy({ where: { doctor_id: doctor.id }, transaction: t });

    const created = await DoctorSchedule.bulkCreate(
      schedules.map((s) => ({ ...s, doctor_id: doctor.id })),
      { transaction: t, validate: true }
    );

    await t.commit();
    return created;
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// Quick single-day update — toggle availability and/or tweak hours for one
// day (the on/off switches on the Clinic Availability screen).
const patchScheduleDay = async (userId, dayOfWeek, updates) => {
  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };

  const day = await DoctorSchedule.findOne({
    where: { doctor_id: doctor.id, day_of_week: dayOfWeek },
  });
  if (!day) throw { status: 404, message: 'No schedule found for that day. Use set schedule first.' };

  const nextStart = updates.start_time ?? day.start_time;
  const nextEnd = updates.end_time ?? day.end_time;
  if (nextStart >= nextEnd) {
    throw { status: 400, message: 'start_time must be before end_time.' };
  }

  await day.update(updates);
  return day;
};

// Full weekly schedule, ordered Sun(0) → Sat(6)
const getSchedule = async (userId) => {
  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };

  return DoctorSchedule.findAll({
    where: { doctor_id: doctor.id },
    order: [['day_of_week', 'ASC']],
  });
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

// ─── BREAKS (Upcoming Breaks card) ─────────────────────────────────────────

const getBreaks = async (userId) => {
  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };

  const breaks = await DoctorBreak.findAll({ where: { doctor_id: doctor.id } });

  const statusOrder = { active: 0, upcoming: 1, completed: 2 };
  return breaks
    .map((b) => {
      const today = new Date().toISOString().split('T')[0];
      let status = 'upcoming';
      if (b.end_date < today) status = 'completed';
      else if (b.start_date <= today) status = 'active';
      return { ...b.toJSON(), status };
    })
    .sort((a, b) => {
      const byStatus = statusOrder[a.status] - statusOrder[b.status];
      if (byStatus !== 0) return byStatus;
      return a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0;
    });
};

const createBreak = async (userId, { title, start_date, end_date }) => {
  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };

  const overlapping = await DoctorBreak.findOne({
    where: {
      doctor_id: doctor.id,
      [Op.or]: [
        { start_date: { [Op.between]: [start_date, end_date] } },
        { end_date: { [Op.between]: [start_date, end_date] } },
        {
          [Op.and]: [
            { start_date: { [Op.lte]: start_date } },
            { end_date: { [Op.gte]: end_date } },
          ],
        },
      ],
    },
  });
  if (overlapping) throw { status: 409, message: 'This break overlaps with an existing one.' };

  return DoctorBreak.create({ doctor_id: doctor.id, title, start_date, end_date });
};

const deleteBreak = async (userId, breakId) => {
  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };

  const doctorBreak = await DoctorBreak.findOne({ where: { id: breakId, doctor_id: doctor.id } });
  if (!doctorBreak) throw { status: 404, message: 'Break not found.' };

  await doctorBreak.destroy();
  return { message: 'Break deleted successfully' };
};

// ─── WEEKLY PERFORMANCE STATS ───────────────────────────────────────────────

const getWeekBounds = (offsetWeeks = 0) => {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toDateOnly = (d) => d.toISOString().split('T')[0];
  return { start: toDateOnly(monday), end: toDateOnly(sunday) };
};

/**
 * NOTE: Appointment has no consultation_started_at/ended_at column, so there's
 * no real per-visit duration to average. This estimates from each completed
 * appointment's scheduled slot_duration_minutes via DoctorSchedule. Replace
 * with a real AVG() once actual timestamps exist — isolated here on purpose.
 */
const estimateAverageDuration = async (doctorId, appointments) => {
  if (!appointments.length) return 0;

  const schedules = await DoctorSchedule.findAll({ where: { doctor_id: doctorId } });
  const durationByDay = new Map(schedules.map((s) => [s.day_of_week, s.slot_duration_minutes]));

  const durations = appointments.map((a) => {
    const dow = new Date(a.appointment_date).getDay();
    return durationByDay.get(dow) ?? 30;
  });

  const total = durations.reduce((sum, d) => sum + d, 0);
  return Math.round(total / durations.length);
};

const getWeeklyStats = async (userId) => {
  const doctor = await Doctor.findOne({ where: { user_id: userId } });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };

  const thisWeek = getWeekBounds(0);
  const lastWeek = getWeekBounds(-1);

  const baseWhere = (range) => ({
    doctor_id: doctor.id,
    status: 'completed',
    appointment_date: { [Op.between]: [range.start, range.end] },
  });

  const [thisWeekAppointments, lastWeekCount] = await Promise.all([
    Appointment.findAll({ where: baseWhere(thisWeek), attributes: ['id', 'appointment_date'] }),
    Appointment.count({ where: baseWhere(lastWeek) }),
  ]);

  const patientsSeen = thisWeekAppointments.length;

  let percentChange = null;
  if (lastWeekCount > 0) {
    percentChange = Math.round(((patientsSeen - lastWeekCount) / lastWeekCount) * 100);
  } else if (patientsSeen > 0) {
    percentChange = 100;
  }

  const averageConsultationMinutes = await estimateAverageDuration(doctor.id, thisWeekAppointments);

  return {
    patientsSeen,
    percentChangeFromLastWeek: percentChange,
    averageConsultationMinutes,
    weekRange: thisWeek,
  };
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  getDoctorByUserId,
  updateDoctorProfile,
  setSchedule,
  patchScheduleDay,
  getSchedule,
  getAvailableSlots,
  getBreaks,
  createBreak,
  deleteBreak,
  getWeeklyStats,
};