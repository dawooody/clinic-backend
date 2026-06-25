const { MedicalRecord, Patient } = require('../../models');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { askGemini } = require('../../config/gemini');
const {
  deleteMedicalFile,
  downloadMedicalFileBuffer,
  uploadMedicalFile,
} = require('./supabase.storage');

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const RECORD_TYPE_ALIASES = {
  'lab-result': 'lab_result',
  'lab-results': 'lab_result',
  lab_result: 'lab_result',
  'lab result': 'lab_result',
  radiology: 'radiology',
  xray: 'radiology',
  'x-ray': 'radiology',
  prescription: 'prescription',
  other: 'other',
};

const normalizeRecordType = (value) => {
  const key = String(value || 'other').trim().toLowerCase();
  return RECORD_TYPE_ALIASES[key] || 'other';
};

const toPublicRecordType = (value) => {
  switch (normalizeRecordType(value)) {
    case 'lab_result':
      return 'lab-result';
    case 'radiology':
      return 'xray';
    case 'prescription':
      return 'prescription';
    default:
      return 'other';
  }
};

const getRecordTypeFolder = (value) => {
  switch (normalizeRecordType(value)) {
    case 'lab_result':
      return 'lab-results';
    case 'radiology':
      return 'xray';
    case 'prescription':
      return 'prescription';
    default:
      return 'other';
  }
};

const getFileType = (mimetype) => (mimetype === 'application/pdf' ? 'pdf' : 'image');

const sanitizeFileName = (filename) => {
  const baseName = path.basename(filename || 'medical-file');
  const safeName = baseName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
  return safeName || 'medical-file';
};

const buildStoragePath = (patientId, recordType, originalFilename) => {
  return `patients/${patientId}/${getRecordTypeFolder(recordType)}/${uuidv4()}-${sanitizeFileName(originalFilename)}`;
};

const getPatientForUser = async (userId) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (!patient) throw createHttpError(404, 'Patient profile not found.');
  return patient;
};

const getLegacyRecordPath = (fileUrl) => {
  if (!fileUrl) {
    return null;
  }

  return path.join(__dirname, '../../../uploads', path.basename(fileUrl));
};

const formatRecord = (record, { detailed = false } = {}) => {
  const data = record.get({ plain: true });
  const base = {
    id: data.id,
    title: data.title,
    fileUrl: data.file_url,
    recordType: toPublicRecordType(data.record_type),
    recordDate: data.record_date,
    createdAt: data.created_at,
  };

  if (!detailed) {
    return base;
  }

  return {
    ...base,
    patientId: data.patient_id,
    fileType: data.file_type,
    fileSize: data.file_size,
    aiSummary: data.ai_summary,
    updatedAt: data.updated_at,
  };
};

const maybeGenerateAiSummary = async (file) => {
  if (getFileType(file.mimetype) !== 'pdf') {
    return null;
  }

  try {
    const pdfParse = require('pdf-parse');
    const buffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);

    if (!buffer) {
      return null;
    }

    const pdfData = await pdfParse(buffer);
    const text = pdfData.text.substring(0, 3000);

    if (text.trim().length <= 50) {
      return null;
    }

    return await askGemini(
      'You are a medical AI. Read this document and write a 3-5 sentence summary for a doctor.\n'
      + 'Focus on key findings and important values. Do not give medical advice.\n\n'
      + text
    );
  } catch (error) {
    console.error('AI summary failed (non-fatal):', error.message);
    return null;
  }
};

const uploadRecord = async (userId, body, file, options = {}) => {
  if (!file) throw createHttpError(400, 'No file uploaded.');

  const patient = await getPatientForUser(userId);
  const title = (body?.title || path.parse(file.originalname || 'medical-file').name || '').trim();
  if (!title) throw createHttpError(400, 'Title is required.');

  const recordType = normalizeRecordType(body?.record_type || body?.recordType || options.recordType);
  const recordDate = body?.record_date || body?.recordDate || options.recordDate || new Date().toISOString().slice(0, 10);
  const fileType = getFileType(file.mimetype);
  const storagePath = buildStoragePath(patient.id, recordType, file.originalname);

  const { fileUrl } = await uploadMedicalFile({
    storagePath,
    buffer: file.buffer,
    contentType: file.mimetype,
  });

  let aiSummary = options.aiSummary;
  if (aiSummary === undefined) {
    aiSummary = await maybeGenerateAiSummary(file);
  }

  try {
    const record = await MedicalRecord.create({
      patient_id: patient.id,
      title,
      file_url: fileUrl,
      storage_path: storagePath,
      file_type: fileType,
      file_size: file.size,
      record_type: recordType,
      record_date: recordDate,
      ai_summary: aiSummary || null,
    });

    return formatRecord(record, { detailed: true });
  } catch (error) {
    await deleteMedicalFile(storagePath).catch(() => {});
    throw error;
  }
};

const getMyRecords = async (userId, query = {}) => {
  const patient = await getPatientForUser(userId);
  const where = { patient_id: patient.id };
  const recordType = query.recordType || query.record_type;

  if (recordType) {
    where.record_type = normalizeRecordType(recordType);
  }

  const records = await MedicalRecord.findAll({
    where,
    order: [['created_at', 'DESC']],
  });

  return records.map((record) => formatRecord(record));
};

const getRecord = async (userId, recordId) => {
  const patient = await getPatientForUser(userId);
  const record = await MedicalRecord.findByPk(recordId);

  if (!record) {
    throw createHttpError(404, 'Record not found.');
  }

  if (record.patient_id !== patient.id) {
    throw createHttpError(403, 'Access denied.');
  }

  return formatRecord(record, { detailed: true });
};

const deleteRecord = async (userId, recordId) => {
  const patient = await getPatientForUser(userId);
  const record = await MedicalRecord.findByPk(recordId);

  if (!record) {
    throw createHttpError(404, 'Record not found.');
  }

  if (record.patient_id !== patient.id) {
    throw createHttpError(403, 'Access denied.');
  }

  if (record.storage_path) {
    await deleteMedicalFile(record.storage_path);
  } else {
    const legacyFilePath = getLegacyRecordPath(record.file_url);
    if (legacyFilePath && fs.existsSync(legacyFilePath)) {
      fs.unlinkSync(legacyFilePath);
    }
  }

  await record.destroy();
};

const getRecordBuffer = async (record) => {
  if (record.storage_path) {
    return downloadMedicalFileBuffer(record.storage_path);
  }

  const legacyFilePath = getLegacyRecordPath(record.file_url);
  if (!legacyFilePath || !fs.existsSync(legacyFilePath)) {
    throw createHttpError(404, 'File not found on server.');
  }

  return fs.readFileSync(legacyFilePath);
};

module.exports = {
  deleteRecord,
  formatRecord,
  getMyRecords,
  getRecord,
  getRecordBuffer,
  normalizeRecordType,
  uploadRecord,
};
