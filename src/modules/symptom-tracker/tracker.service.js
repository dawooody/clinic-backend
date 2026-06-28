const { Op } = require('sequelize');
const {
  sequelize,
  SymptomLog,
  SymptomLogMedication,
  Patient,
  Doctor,
  Appointment,
} = require('../../models');

const logInclude = [
  {
    model: SymptomLogMedication,
    as: 'medications',
  },
];

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const getValue = (body, camelKey, snakeKey) => {
  if (hasOwn(body, camelKey)) return body[camelKey];
  if (hasOwn(body, snakeKey)) return body[snakeKey];
  return undefined;
};

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const normalizeSymptoms = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((symptom) => String(symptom).trim())
      .filter(Boolean)
      .join(', ');
  }

  if (typeof value === 'string') {
    return value;
  }

  return value ?? null;
};

const normalizeMedication = (medication) => {
  const medicineName = getValue(medication, 'medicineName', 'medicine_name');
  if (!medicineName) {
    return null;
  }

  const dose = getValue(medication, 'dose', 'dose');
  const takenTime = getValue(medication, 'takenTime', 'taken_time');
  const isTaken = getValue(medication, 'isTaken', 'is_taken');

  return {
    medicine_name: String(medicineName).trim(),
    dose: dose === undefined || dose === null || dose === '' ? null : String(dose).trim(),
    taken_time: takenTime === undefined || takenTime === null || takenTime === '' ? null : takenTime,
    is_taken: isTaken ?? false,
  };
};

const normalizeMedications = (medications) => {
  if (!Array.isArray(medications)) {
    return [];
  }

  return medications.map(normalizeMedication).filter(Boolean);
};

const buildCreateData = (body, patientId) => {
  const logDate = getValue(body, 'logDate', 'log_date') || getTodayDate();
  const painLevel = getValue(body, 'painLevel', 'pain_level');
  const symptoms = getValue(body, 'symptoms', 'symptoms');
  const notes = getValue(body, 'notes', 'notes');
  const temperature = getValue(body, 'temperature', 'temperature');
  const mood = getValue(body, 'mood', 'mood');
  const wellnessScore = getValue(body, 'wellnessScore', 'wellness_score');

  return {
    patient_id: patientId,
    log_date: logDate,
    pain_level: painLevel,
    ...(symptoms !== undefined ? { symptoms: normalizeSymptoms(symptoms) } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(mood !== undefined ? { mood } : {}),
    ...(wellnessScore !== undefined ? { wellness_score: wellnessScore } : {}),
  };
};

const buildUpdateData = (body, existingLog) => {
  const updates = {};
  const logDate = getValue(body, 'logDate', 'log_date');
  const painLevel = getValue(body, 'painLevel', 'pain_level');
  const symptoms = getValue(body, 'symptoms', 'symptoms');
  const notes = getValue(body, 'notes', 'notes');
  const temperature = getValue(body, 'temperature', 'temperature');
  const mood = getValue(body, 'mood', 'mood');
  const wellnessScore = getValue(body, 'wellnessScore', 'wellness_score');

  if (logDate !== undefined) updates.log_date = logDate || existingLog.log_date;
  if (painLevel !== undefined) updates.pain_level = painLevel;
  if (symptoms !== undefined) updates.symptoms = normalizeSymptoms(symptoms);
  if (notes !== undefined) updates.notes = notes;
  if (temperature !== undefined) updates.temperature = temperature;
  if (mood !== undefined) updates.mood = mood;
  if (wellnessScore !== undefined) updates.wellness_score = wellnessScore;

  return updates;
};

const persistMedications = async (logId, medications, transaction) => {
  await SymptomLogMedication.destroy({
    where: { symptom_log_id: logId },
    transaction,
  });

  if (!medications.length) {
    return;
  }

  await SymptomLogMedication.bulkCreate(
    medications.map((medication) => ({
      ...medication,
      symptom_log_id: logId,
    })),
    { transaction }
  );
};

const addLog = async (userId, body) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (!patient) throw { status: 404, message: 'Patient profile not found.' };

  const painLevel = getValue(body, 'painLevel', 'pain_level');
  if (painLevel === undefined) {
    throw { status: 400, message: 'painLevel is required.' };
  }

  const transaction = await sequelize.transaction();
  try {
    const logData = buildCreateData(body, patient.id);

    const existing = await SymptomLog.findOne({
      where: { patient_id: patient.id, log_date: logData.log_date },
      transaction,
    });
    if (existing) throw { status: 409, message: 'You already have a log for this date.' };

    const log = await SymptomLog.create(logData, { transaction });
    const medications = normalizeMedications(body.medications);

    await persistMedications(log.id, medications, transaction);

    const createdLog = await SymptomLog.findByPk(log.id, {
      include: logInclude,
      transaction,
    });

    await transaction.commit();
    return createdLog;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

const updateLog = async (userId, logId, body) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (!patient) throw { status: 404, message: 'Patient profile not found.' };

  const transaction = await sequelize.transaction();
  try {
    const log = await SymptomLog.findByPk(logId, { transaction });

    if (!log) throw { status: 404, message: 'Log not found.' };
    if (log.patient_id !== patient.id) throw { status: 403, message: 'Access denied.' };

    const updates = buildUpdateData(body, log);
    await log.update(updates, { transaction });

    const medications = normalizeMedications(body.medications);
    await persistMedications(log.id, medications, transaction);

    const updatedLog = await SymptomLog.findByPk(log.id, {
      include: logInclude,
      transaction,
    });

    await transaction.commit();
    return updatedLog;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

const getMyLogs = async (userId, { from, to, page = 1, limit = 30 }) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (!patient) throw { status: 404, message: 'Patient profile not found.' };

  const where = { patient_id: patient.id };
  if (from && to) where.log_date = { [Op.between]: [from, to] };
  else if (from) where.log_date = { [Op.gte]: from };
  else if (to) where.log_date = { [Op.lte]: to };

  const safePage = parseInt(page, 10) || 1;
  const safeLimit = parseInt(limit, 10) || 30;
  const offset = (safePage - 1) * safeLimit;
  const { rows, count } = await SymptomLog.findAndCountAll({
    where,
    include: logInclude,
    distinct: true,
    order: [['log_date', 'DESC']],
    limit: safeLimit,
    offset,
  });

  return { rows, count };
};

// Doctor views a patient's recovery logs (must have an appointment)
const getPatientLogs = async (doctorUserId, patientId, query) => {
  const doctor = await Doctor.findOne({ where: { user_id: doctorUserId } });
  if (!doctor) throw { status: 404, message: 'Doctor profile not found.' };

  const hasRelation = await Appointment.findOne({
    where: { doctor_id: doctor.id, patient_id: patientId },
  });
  if (!hasRelation) throw { status: 403, message: 'No appointment relationship with this patient.' };

  const where = { patient_id: patientId };
  const { from, to, page = 1, limit = 30 } = query;
  if (from && to) where.log_date = { [Op.between]: [from, to] };
  else if (from) where.log_date = { [Op.gte]: from };
  else if (to) where.log_date = { [Op.lte]: to };

  const safePage = parseInt(page, 10) || 1;
  const safeLimit = parseInt(limit, 10) || 30;
  const offset = (safePage - 1) * safeLimit;
  const { rows, count } = await SymptomLog.findAndCountAll({
    where,
    include: logInclude,
    distinct: true,
    order: [['log_date', 'ASC']],
    limit: safeLimit,
    offset,
  });

  return { rows, count };
};

module.exports = { addLog, updateLog, getMyLogs, getPatientLogs };
