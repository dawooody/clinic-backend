const { askGemini } = require('../../config/gemini');
const {
  Patient, Doctor, Appointment, MedicalRecord,
  Prescription, SymptomLog, FamilyLink, User, Specialty,
} = require('../../models');
const { Op } = require('sequelize');

// ─── 1. AI CHATBOT ───────────────────────────────────────────────────────────
const chatWithBot = async (messages) => {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw { status: 400, message: 'messages array is required.' };
  }
  const conversation = messages
    .map((m) => `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const promptLines = [
    'You are a friendly medical triage assistant for a clinic mobile app.',
    'Your job: ask about symptoms conversationally, suggest the right specialty, remind users you are not a doctor.',
    'Keep responses short and mobile-friendly (2-4 sentences max).',
    '',
    'Available specialties: General Practice, Cardiology, Neurology, Orthopedics, Dermatology,',
    'Pediatrics, Gynecology, Ophthalmology, ENT, Psychiatry, Endocrinology, Gastroenterology,',
    'Pulmonology, Nephrology, Oncology, Urology, Rheumatology, Hematology.',
    '',
    'When you have enough info to suggest a specialty, end your reply with this exact JSON on its own line:',
    '{"suggested_specialty": "SpecialtyName"}',
    '',
    'If not enough information, do NOT include JSON.',
    '',
    'Conversation so far:',
    conversation,
  ];

  const reply = await askGemini(promptLines.join('\n'));

  let suggested_specialty = null;
  const jsonMatch = reply.match(/\{"suggested_specialty"\s*:\s*"([^"]+)"\}/);
  if (jsonMatch) suggested_specialty = jsonMatch[1];

  const cleanReply = reply.replace(/\{[^}]*"suggested_specialty"[^}]*\}/g, '').trim();
  return { reply: cleanReply, suggested_specialty };
};

// ─── 2. PRE-VISIT PATIENT BRIEF FOR DOCTOR ───────────────────────────────────
const getPreVisitSummary = async (appointmentId, doctorUserId) => {
  const doctor = await Doctor.findOne({ where: { user_id: doctorUserId } });
  if (!doctor) throw { status: 404, message: 'Doctor profile not found.' };

  const appointment = await Appointment.findByPk(appointmentId, {
    include: [{
      model: Patient, as: 'patient',
      include: [{ model: User, as: 'user', attributes: ['full_name', 'phone'] }],
    }],
  });
  if (!appointment) throw { status: 404, message: 'Appointment not found.' };
  if (appointment.doctor_id !== doctor.id) throw { status: 403, message: 'Access denied.' };

  const patient = appointment.patient;

  const records = await MedicalRecord.findAll({
    where: { patient_id: patient.id },
    order: [['created_at', 'DESC']],
    limit: 5,
    attributes: ['title', 'ai_summary', 'record_type', 'record_date'],
  });

  const recentLogs = await SymptomLog.findAll({
    where: { patient_id: patient.id },
    order: [['log_date', 'DESC']],
    limit: 7,
  });

  const pastPrescriptions = await Prescription.findAll({
    where: { patient_id: patient.id },
    order: [['created_at', 'DESC']],
    limit: 3,
    attributes: ['diagnosis', 'medicines', 'created_at'],
  });

  const dataLines = [
    'Patient: ' + patient.user.full_name,
    'Gender: ' + (patient.gender || 'N/A') + ' | Blood type: ' + (patient.blood_type || 'N/A'),
    'Allergies: ' + (patient.allergies || 'None'),
    'Chronic conditions: ' + (patient.chronic_conditions || 'None'),
    '',
    'Reason for visit (chatbot summary): ' + (appointment.ai_chatbot_summary || 'Not provided'),
    'Patient notes: ' + (appointment.patient_notes || 'None'),
    '',
    'Recent medical records:',
    records.length
      ? records.map((r) => '  - ' + r.title + ' (' + (r.record_date || 'N/A') + '): ' + (r.ai_summary || 'No summary')).join('\n')
      : '  None uploaded',
    '',
    'Last 7 days symptom logs:',
    recentLogs.length
      ? recentLogs.map((l) => '  - ' + l.log_date + ': pain=' + l.pain_level + '/5, meds_taken=' + l.medications_taken).join('\n')
      : '  No logs',
    '',
    'Past diagnoses:',
    pastPrescriptions.length
      ? pastPrescriptions.map((p) => '  - ' + p.diagnosis).join('\n')
      : '  None on record',
  ];

  const promptLines = [
    'You are a medical AI assistant helping a doctor prepare for a patient visit.',
    'Based on the data below, write a concise pre-visit brief in 5-8 bullet points.',
    'Highlight: key concerns, symptom trends, relevant history, things the doctor should pay attention to.',
    'Be factual. Do not suggest a diagnosis.',
    '',
    ...dataLines,
  ];

  const brief = await askGemini(promptLines.join('\n'));
  return { appointment, patient, brief };
};

// ─── 3. GENETIC / HEREDITARY RISK ANALYSIS ───────────────────────────────────
const getGeneticRisks = async (patientId, doctorUserId) => {
  const doctor = await Doctor.findOne({ where: { user_id: doctorUserId } });
  if (!doctor) throw { status: 404, message: 'Doctor not found.' };

  const patient = await Patient.findByPk(patientId);
  if (!patient) throw { status: 404, message: 'Patient not found.' };

  const links = await FamilyLink.findAll({
    where: {
      [Op.or]: [{ requester_id: patientId }, { receiver_id: patientId }],
      status: 'accepted',
    },
    include: [
      { model: Patient, as: 'requester', include: [{ model: User, as: 'user', attributes: ['full_name'] }] },
      { model: Patient, as: 'receiver',  include: [{ model: User, as: 'user', attributes: ['full_name'] }] },
    ],
  });

  if (links.length === 0) {
    return {
      analysis: 'No family members linked. Ask the patient to link family profiles for genetic risk analysis.',
      family_members: [],
    };
  }

  const familyData = [];
  for (const link of links) {
    const memberId = link.requester_id === patientId ? link.receiver_id : link.requester_id;
    const member   = link.requester_id === patientId ? link.receiver   : link.requester;
    const prescriptions = await Prescription.findAll({ where: { patient_id: memberId }, attributes: ['diagnosis'] });
    familyData.push({
      name: member.user.full_name,
      relation: link.relationship,
      diagnoses: prescriptions.map((p) => p.diagnosis),
    });
  }

  const familyBlock = familyData
    .map((f) => f.relation + ' (' + f.name + '): ' + (f.diagnoses.join(', ') || 'No recorded diagnoses'))
    .join('\n');

  const promptLines = [
    'You are a medical AI. Analyze this family medical history and identify hereditary/genetic risks.',
    'List conditions that may be inherited and suggest preventive screenings.',
    'Use bullet points. Be concise. This is for a doctor to read quickly.',
    '',
    'Family history:',
    familyBlock,
  ];

  const analysis = await askGemini(promptLines.join('\n'));
  return { analysis, family_members: familyData };
};

// ─── 4. RE-SUMMARIZE A MEDICAL RECORD (on demand) ────────────────────────────
const summarizeRecord = async (recordId, userId) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  const record  = await MedicalRecord.findByPk(recordId);

  if (!record) throw { status: 404, message: 'Record not found.' };
  if (record.patient_id !== patient.id) throw { status: 403, message: 'Access denied.' };
  if (record.file_type !== 'pdf') throw { status: 400, message: 'AI summarization only works on PDF records.' };

  const fs       = require('fs');
  const pdfParse = require('pdf-parse');
  const path     = require('path');

  const filePath = path.join(__dirname, '../../../uploads', path.basename(record.file_url));
  if (!fs.existsSync(filePath)) throw { status: 404, message: 'File not found on server.' };

  const buffer  = fs.readFileSync(filePath);
  const pdfData = await pdfParse(buffer);
  const text    = pdfData.text.substring(0, 3000);

  const prompt = [
    'You are a medical AI. Read this document and write a 3-5 sentence summary for a doctor.',
    'Focus on key findings and important values. Do not give medical advice.',
    '',
    text,
  ].join('\n');

  const summary = await askGemini(prompt);
  await record.update({ ai_summary: summary });
  return { summary, record };
};

module.exports = { chatWithBot, getPreVisitSummary, getGeneticRisks, summarizeRecord };
