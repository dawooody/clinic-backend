const {
  User, Doctor, Patient, Appointment, DoctorSchedule, Specialty, sequelize,
} = require('../../models');
const { Op } = require('sequelize');

// ─── APPOINTMENTS MANAGEMENT ─────────────────────────────────────────────────
const getAllAppointments = async ({ status, doctor_id, date, page = 1, limit = 20 }) => {
  const where = {};
  if (status)    where.status    = status;
  if (doctor_id) where.doctor_id = doctor_id;
  if (date)      where.appointment_date = date;

  const today = new Date().toISOString().split('T')[0];
  const offset = (page - 1) * limit;

  // Stats
  const [totalToday, completedToday, remainingToday] = await Promise.all([
    Appointment.count({ where: { appointment_date: today } }),
    Appointment.count({ where: { appointment_date: today, status: 'completed' } }),
    Appointment.count({ where: { appointment_date: today, status: { [Op.in]: ['pending', 'confirmed'] } } }),
  ]);

  const { rows, count } = await Appointment.findAndCountAll({
    where,
    include: [
      {
        model: Doctor, as: 'doctor',
        include: [
          { model: User, as: 'user', attributes: ['full_name', 'profile_photo'] },
          { model: Specialty, as: 'specialty', attributes: ['name'] },
        ],
      },
      {
        model: Patient, as: 'patient',
        include: [{ model: User, as: 'user', attributes: ['full_name', 'phone', 'profile_photo'] }],
      },
    ],
    order: [['appointment_date', 'DESC'], ['time_slot', 'ASC']],
    limit: parseInt(limit),
    offset,
    distinct: true,
  });

  return {
    stats: { totalToday, completedToday, remainingToday },
    rows,
    count,
  };
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
  const today  = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [activeToday, newThisWeek] = await Promise.all([
    Appointment.count({
      where: { appointment_date: today, status: { [Op.in]: ['pending', 'confirmed'] } },
      distinct: true,
      col: 'patient_id',
    }),
    Patient.count({
      include: [{ model: User, as: 'user', where: { created_at: { [Op.gte]: weekAgo } }, attributes: [] }],
    }),
  ]);

  const { rows, count } = await Patient.findAndCountAll({
    include: [
      {
        model: User,
        as: 'user',
        attributes: { exclude: ['password', 'refresh_token'] },
      },
      {
        model: Appointment,
        as: 'appointments',
        where: {
          appointment_date: { [Op.gte]: today },
          status: { [Op.in]: ['pending', 'confirmed'] },
        },
        required: false,
        attributes: ['id', 'appointment_date', 'time_slot', 'status'],
      },
    ],
    limit: parseInt(limit),
    offset,
    distinct: true,
  });

  const patients = rows.map((p) => {
    const plain = p.toJSON();
    const upcoming = (plain.appointments || []).sort(
      (a, b) => new Date(a.appointment_date) - new Date(b.appointment_date)
    );
    plain.next_appointment = upcoming[0] || null;
    plain.health_status = plain.health_status || 'stable';
    delete plain.appointments;
    return plain;
  });

  const criticalCases = patients.filter(p => p.health_status === 'critical').length;

  return {
    stats: { activeToday, criticalCases, newThisWeek },
    rows: patients,
    count,
  };
};

// ─── GET PATIENT BY ID ────────────────────────────────────────────────────────
const getPatientById = async (patientId) => {
  const today = new Date().toISOString().split('T')[0];

  const patient = await Patient.findByPk(patientId, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: { exclude: ['password', 'refresh_token'] },
      },
      {
        model: Appointment,
        as: 'appointments',
        attributes: ['id', 'appointment_date', 'time_slot', 'status', 'doctor_notes'],
        include: [
          {
            model: Doctor,
            as: 'doctor',
            include: [
              { model: User,      as: 'user',      attributes: ['full_name'] },
              { model: Specialty, as: 'specialty', attributes: ['name'] },
            ],
          },
        ],
      },
    ],
  });

  if (!patient) throw { status: 404, message: 'Patient not found.' };

  const plain = patient.toJSON();
  const appointments = plain.appointments || [];

  const pastAppointments = appointments
    .filter(a => a.appointment_date < today && a.status === 'completed')
    .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));

  const futureAppointments = appointments
    .filter(a => a.appointment_date >= today && ['pending', 'confirmed'].includes(a.status))
    .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));

  const doctorNotes = pastAppointments
    .filter(a => a.doctor_notes)
    .map(a => ({
      date:   a.appointment_date,
      doctor: a.doctor?.user?.full_name,
      note:   a.doctor_notes,
    }));

  plain.last_visit       = pastAppointments[0]?.appointment_date || null;
  plain.next_appointment = futureAppointments[0] || null;
  plain.total_visits     = pastAppointments.length;
  plain.doctor_notes     = doctorNotes;

  const validStatuses = ['stable', 'critical', 'recovering', 'under observation'];
  plain.health_status = validStatuses.includes(plain.health_status)
    ? plain.health_status
    : 'stable';

  delete plain.appointments;
  return plain;
};

// ─── WEEKLY PATIENT VISITS ────────────────────────────────────────────────────
const getWeeklyVisits = async () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Stats: عدد الزيارات لكل يوم
  const statsResult = await sequelize.query(`
    SELECT 
      EXTRACT(DOW FROM appointment_date::date) AS day_index,
      COUNT(*) AS visits
    FROM appointments
    WHERE 
      appointment_date >= CURRENT_DATE - INTERVAL '7 days'
      AND status IN ('completed', 'confirmed', 'pending')
    GROUP BY day_index
    ORDER BY day_index
  `, { type: sequelize.QueryTypes.SELECT });

  // قائمة المواعيد الأسبوع ده مع بيانات المريض والدكتور
  const appointments = await Appointment.findAll({
    where: {
      appointment_date: {
        [Op.gte]: sequelize.literal("CURRENT_DATE - INTERVAL '7 days'"),
        [Op.lte]: sequelize.literal('CURRENT_DATE'),
      },
      status: { [Op.in]: ['completed', 'confirmed', 'pending'] },
    },
    include: [
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
    ],
    order: [['appointment_date', 'ASC'], ['time_slot', 'ASC']],
  });

  // ابني array بالـ 7 أيام — كل يوم فيه visits count + قائمة المواعيد
  const weekly = days.map((day, index) => {
    const found = statsResult.find(r => parseInt(r.day_index) === index);
    const dayAppointments = appointments.filter(a => {
      const d = new Date(a.appointment_date);
      return d.getDay() === index;
    });
    return {
      day,
      visits: found ? parseInt(found.visits) : 0,
      appointments: dayAppointments,
    };
  });

  return weekly;
};

// ─── MONTHLY APPOINTMENTS (آخر 7 شهور) ───────────────────────────────────────
const getMonthlyAppointments = async () => {
  const result = await sequelize.query(`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE - INTERVAL '6 months'),
        date_trunc('month', CURRENT_DATE),
        interval '1 month'
      ) AS month_start
    )
    SELECT
      TO_CHAR(month_start, 'Mon YYYY') AS month,
      COUNT(a.id) AS total
    FROM months m
    LEFT JOIN appointments a
      ON date_trunc('month', a.appointment_date::date) = m.month_start
    GROUP BY month_start
    ORDER BY month_start ASC
  `, { type: sequelize.QueryTypes.SELECT });

  return result.map(r => ({
    month: r.month,
    total: parseInt(r.total),
  }));
};

// ─── NEXT APPOINTMENTS (TODAY) ────────────────────────────────────────────────
const getNextAppointments = async () => {
  const today = new Date().toISOString().split('T')[0];

  const appointments = await Appointment.findAll({
    where: {
      appointment_date: today,
      status: { [Op.in]: ['pending', 'confirmed'] },
    },
    include: [
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
    ],
    order: [['time_slot', 'ASC']],
  });

  return appointments;
};

// ─── REMOVE DOCTOR BY ID ─────────────────────────────────────────────────────
const removeDoctor = async (doctorId) => {
  const doctor = await Doctor.findByPk(doctorId, {
    include: [{ model: User, as: 'user' }],
  });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };
  await doctor.destroy();
  await doctor.user.destroy();
  return { message: 'Doctor removed successfully.' };
};

// ─── REMOVE ALL DOCTORS ───────────────────────────────────────────────────────
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

// ─── CREATE DOCTOR ────────────────────────────────────────────────────────────
const createDoctor = async ({ full_name, email, password, phone, specialty_id, bio, license_number, years_experience, consultation_fee }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw { status: 409, message: 'Email already in use.' };

  const user = await User.create({ full_name, email, password, phone, role: 'doctor',  is_verified: true });
  const doctor = await Doctor.create({
    id: user.id,
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

  for (const s of schedules) {
    if (s.day_of_week === undefined || s.day_of_week === null)
      throw { status: 400, message: 'Each schedule must have a day_of_week (0=Sun … 6=Sat).' };
    if (!s.start_time || !s.end_time)
      throw { status: 400, message: 'Each schedule must have start_time and end_time.' };
    if (s.appointment_reminder !== undefined && s.appointment_reminder !== null) {
      const validReminders = ['5 minutes', '10 minutes', '15 minutes', '30 minutes', '1 hour', '2 hours', '1 day'];
      if (!validReminders.includes(s.appointment_reminder))
        throw { status: 400, message: `appointment_reminder must be one of: ${validReminders.join(', ')}.` };
    }
  }

  await DoctorSchedule.destroy({ where: { doctor_id: doctorId } });
  return DoctorSchedule.bulkCreate(schedules.map((s) => ({
    ...s,
    doctor_id: doctorId,
    appointment_reminder: s.appointment_reminder || null,
  })));
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
  getPatientById,
  removeDoctor,
  removeAllDoctors,
  getWeeklyVisits,
  getMonthlyAppointments,
  getNextAppointments,
};