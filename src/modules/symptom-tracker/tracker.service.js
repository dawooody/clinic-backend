const { SymptomLog, Patient, Doctor, Appointment } = require('../../models');
const { Op } = require('sequelize');

const addLog = async (userId, body) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (!patient) throw { status: 404, message: 'Patient profile not found.' };

  const { log_date, pain_level, symptoms, medications_taken, notes, temperature, mood } = body;

  if (!log_date || pain_level === undefined) {
    throw { status: 400, message: 'log_date and pain_level are required.' };
  }

  // Only one log per day allowed
  const existing = await SymptomLog.findOne({
    where: { patient_id: patient.id, log_date },
  });
  if (existing) throw { status: 409, message: 'You already have a log for this date.' };

  const log = await SymptomLog.create({
    patient_id: patient.id,
    log_date,
    pain_level,
    symptoms,
    medications_taken: medications_taken || false,
    notes,
    temperature,
    mood,
  });

  return log;
};

const updateLog = async (userId, logId, body) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  const log = await SymptomLog.findByPk(logId);

  if (!log) throw { status: 404, message: 'Log not found.' };
  if (log.patient_id !== patient.id) throw { status: 403, message: 'Access denied.' };

  await log.update(body);
  return log;
};

const getMyLogs = async (userId, { from, to, page = 1, limit = 30 }) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (!patient) throw { status: 404, message: 'Patient profile not found.' };

  const where = { patient_id: patient.id };
  if (from && to) where.log_date = { [Op.between]: [from, to] };
  else if (from)  where.log_date = { [Op.gte]: from };
  else if (to)    where.log_date = { [Op.lte]: to };

  const offset = (page - 1) * limit;
  const { rows, count } = await SymptomLog.findAndCountAll({
    where,
    order: [['log_date', 'DESC']],
    limit: parseInt(limit),
    offset,
  });

  return { rows, count };
};

// Doctor views a patient's recovery logs (must have an appointment)
const getPatientLogs = async (doctorUserId, patientId, query) => {
  const doctor = await Doctor.findOne({ where: { user_id: doctorUserId } });

  const hasRelation = await Appointment.findOne({
    where: { doctor_id: doctor.id, patient_id: patientId },
  });
  if (!hasRelation) throw { status: 403, message: 'No appointment relationship with this patient.' };

  const where = { patient_id: patientId };
  const { from, to, page = 1, limit = 30 } = query;
  if (from && to) where.log_date = { [Op.between]: [from, to] };

  const offset = (page - 1) * limit;
  const { rows, count } = await SymptomLog.findAndCountAll({
    where,
    order: [['log_date', 'ASC']],
    limit: parseInt(limit),
    offset,
  });

  return { rows, count };
};

module.exports = { addLog, updateLog, getMyLogs, getPatientLogs };
