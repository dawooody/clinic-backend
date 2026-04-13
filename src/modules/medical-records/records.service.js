const { MedicalRecord, Patient, Doctor, Appointment } = require('../../models');
const { Op } = require('sequelize');
const fs   = require('fs');
const path = require('path');
const { askGemini } = require('../../config/gemini');

// ─── UPLOAD RECORD ────────────────────────────────────────────────────────────
const uploadRecord = async (userId, body, file) => {
  if (!file) throw { status: 400, message: 'No file uploaded.' };

  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (!patient) throw { status: 404, message: 'Patient profile not found.' };

  const { title, record_type, record_date } = body;
  if (!title) throw { status: 400, message: 'Title is required.' };

  const fileUrl  = `${process.env.BASE_URL}/uploads/${file.filename}`;
  const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';

  let ai_summary = null;
  if (fileType === 'pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const buffer   = fs.readFileSync(file.path);
      const pdfData  = await pdfParse(buffer);
      const text     = pdfData.text.substring(0, 3000);

      if (text.trim().length > 50) {
        ai_summary = await askGemini(
          'You are a medical AI. Read this document and write a 3-5 sentence summary for a doctor.\n' +
          'Focus on key findings and important values. Do not give medical advice.\n\n' + text
        );
      }
    } catch (e) {
      console.error('AI summary failed (non-fatal):', e.message);
    }
  }

  return MedicalRecord.create({
    patient_id:  patient.id,
    title,
    file_url:    fileUrl,
    file_type:   fileType,
    file_size:   file.size,
    record_type: record_type || 'other',
    record_date: record_date || new Date(),
    ai_summary,
  });
};

// ─── GET MY RECORDS ───────────────────────────────────────────────────────────
const getMyRecords = async (userId, { record_type, page = 1, limit = 10 }) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (!patient) throw { status: 404, message: 'Patient profile not found.' };

  const where = { patient_id: patient.id };
  if (record_type) where.record_type = record_type;

  const offset = (page - 1) * limit;
  const { rows, count } = await MedicalRecord.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset,
  });

  return { rows, count };
};

// ─── DOCTOR VIEWS PATIENT RECORDS ────────────────────────────────────────────
// BUG FIX: removed duplicate require() — Doctor & Appointment already imported at top
const getPatientRecords = async (doctorUserId, patientId, query) => {
  const doctor = await Doctor.findOne({ where: { user_id: doctorUserId } });
  if (!doctor) throw { status: 404, message: 'Doctor profile not found.' };

  const hasRelation = await Appointment.findOne({
    where: {
      doctor_id:  doctor.id,
      patient_id: patientId,
      status:     { [Op.in]: ['confirmed', 'completed', 'pending'] },
    },
  });
  if (!hasRelation) throw { status: 403, message: 'You have no appointment with this patient.' };

  const where = { patient_id: patientId };
  const { record_type, page = 1, limit = 10 } = query;
  if (record_type) where.record_type = record_type;

  const offset = (page - 1) * limit;
  const { rows, count } = await MedicalRecord.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset,
  });
  return { rows, count };
};

// ─── DELETE RECORD ────────────────────────────────────────────────────────────
// BUG FIX: added null check for patient before accessing patient.id
const deleteRecord = async (userId, recordId) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (!patient) throw { status: 404, message: 'Patient profile not found.' };

  const record = await MedicalRecord.findByPk(recordId);
  if (!record) throw { status: 404, message: 'Record not found.' };
  if (record.patient_id !== patient.id) throw { status: 403, message: 'Access denied.' };

  const filePath = path.join(__dirname, '../../../uploads', path.basename(record.file_url));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await record.destroy();
};

module.exports = { uploadRecord, getMyRecords, getPatientRecords, deleteRecord };
