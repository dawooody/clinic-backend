const { askGemini } = require('../../config/gemini');
const { createClient } = require('@supabase/supabase-js');
const {
  Patient, Doctor, Appointment, MedicalRecord,
  Prescription, SymptomLog, FamilyLink, User,
} = require('../../models');
const { Op } = require('sequelize');

const EMBEDDING_MODEL = 'Xenova/bge-base-en-v1.5';
const EMBEDDING_SIZE = 768;
const SEARCH_RESULT_LIMIT = 5;

let extractor;
let extractorPromise;
let supabase;

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getSupabaseClient = () => {
  if (supabase) {
    return supabase;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    throw createHttpError(500, 'Supabase configuration is missing.');
  }

  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  return supabase;
};

const getExtractor = async () => {
  if (extractor) {
    return extractor;
  }

  if (!extractorPromise) {
    extractorPromise = import('@xenova/transformers')
      .then(({ pipeline }) => pipeline('feature-extraction', EMBEDDING_MODEL))
      .then((loadedExtractor) => {
        extractor = loadedExtractor;
        return extractor;
      })
      .catch((error) => {
        extractorPromise = null;
        throw error;
      });
  }

  return extractorPromise;
};

const getEmbedding = async (text) => {
  const trimmedText = text?.trim();

  if (!trimmedText) {
    throw createHttpError(400, 'Query text is required.');
  }

  try {
    const embeddingExtractor = await getExtractor();
    const output = await embeddingExtractor(trimmedText, {
      pooling: 'mean',
      normalize: true,
    });

    const embedding = Array.from(output.data);

    if (embedding.length !== EMBEDDING_SIZE) {
      throw new Error(`Expected embedding size ${EMBEDDING_SIZE}, received ${embedding.length}.`);
    }

    return embedding;
  } catch (error) {
    if (error.status) {
      throw error;
    }

    throw createHttpError(500, `Failed to generate embedding: ${error.message}`);
  }
};

const searchDocuments = async (query, limit = SEARCH_RESULT_LIMIT) => {
  const trimmedQuery = query?.trim();

  if (!trimmedQuery) {
    throw createHttpError(400, 'Query is required.');
  }

  const embedding = await getEmbedding(trimmedQuery);

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('match_documents', {
      query_embedding: embedding,
      match_count: limit,
    });

    if (error) {
      throw error;
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((row) => row?.content)
      .filter(Boolean)
      .slice(0, limit);
  } catch (error) {
    throw createHttpError(500, `Failed to search documents: ${error.message}`);
  }
};

const buildChatContext = async (message) => {
  const trimmedMessage = message?.trim();

  if (!trimmedMessage) {
    throw createHttpError(400, 'Message is required.');
  }

  const results = await searchDocuments(trimmedMessage, SEARCH_RESULT_LIMIT);
  const numberedResults = results.length > 0
    ? results.map((result, index) => `${index + 1}. ${result}`).join('\n')
    : 'No relevant medical data found.';

  const context = [
    'Based on the following medical data:',
    '',
    numberedResults,
    '',
    `User question: ${trimmedMessage}`,
  ].join('\n');

  return {
    context,
    message: 'This is where LLM will generate the final answer later',
    results,
  };
};

const chatWithBot = async (messages) => {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw createHttpError(400, 'messages array is required.');
  }

  const conversation = messages
    .map((message) => `${message.role === 'user' ? 'Patient' : 'Assistant'}: ${message.content}`)
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
  if (jsonMatch) {
    suggested_specialty = jsonMatch[1];
  }

  const cleanReply = reply.replace(/\{[^}]*"suggested_specialty"[^}]*\}/g, '').trim();
  return { reply: cleanReply, suggested_specialty };
};

const getPreVisitSummary = async (appointmentId, doctorUserId) => {
  const doctor = await Doctor.findOne({ where: { user_id: doctorUserId } });
  if (!doctor) {
    throw createHttpError(404, 'Doctor profile not found.');
  }

  const appointment = await Appointment.findByPk(appointmentId, {
    include: [{
      model: Patient,
      as: 'patient',
      include: [{ model: User, as: 'user', attributes: ['full_name', 'phone'] }],
    }],
  });

  if (!appointment) {
    throw createHttpError(404, 'Appointment not found.');
  }

  if (appointment.doctor_id !== doctor.id) {
    throw createHttpError(403, 'Access denied.');
  }

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
    `Patient: ${patient.user.full_name}`,
    `Gender: ${patient.gender || 'N/A'} | Blood type: ${patient.blood_type || 'N/A'}`,
    `Allergies: ${patient.allergies || 'None'}`,
    `Chronic conditions: ${patient.chronic_conditions || 'None'}`,
    '',
    `Reason for visit (chatbot summary): ${appointment.ai_chatbot_summary || 'Not provided'}`,
    `Patient notes: ${appointment.patient_notes || 'None'}`,
    '',
    'Recent medical records:',
    records.length > 0
      ? records.map((record) => `  - ${record.title} (${record.record_date || 'N/A'}): ${record.ai_summary || 'No summary'}`).join('\n')
      : '  None uploaded',
    '',
    'Last 7 days symptom logs:',
    recentLogs.length > 0
      ? recentLogs.map((log) => `  - ${log.log_date}: pain=${log.pain_level}/5, meds_taken=${log.medications_taken}`).join('\n')
      : '  No logs',
    '',
    'Past diagnoses:',
    pastPrescriptions.length > 0
      ? pastPrescriptions.map((prescription) => `  - ${prescription.diagnosis}`).join('\n')
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

const getGeneticRisks = async (patientId, doctorUserId) => {
  const doctor = await Doctor.findOne({ where: { user_id: doctorUserId } });
  if (!doctor) {
    throw createHttpError(404, 'Doctor not found.');
  }

  const patient = await Patient.findByPk(patientId);
  if (!patient) {
    throw createHttpError(404, 'Patient not found.');
  }

  const links = await FamilyLink.findAll({
    where: {
      [Op.or]: [{ requester_id: patientId }, { receiver_id: patientId }],
      status: 'accepted',
    },
    include: [
      { model: Patient, as: 'requester', include: [{ model: User, as: 'user', attributes: ['full_name'] }] },
      { model: Patient, as: 'receiver', include: [{ model: User, as: 'user', attributes: ['full_name'] }] },
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
    const member = link.requester_id === patientId ? link.receiver : link.requester;
    const prescriptions = await Prescription.findAll({
      where: { patient_id: memberId },
      attributes: ['diagnosis'],
    });

    familyData.push({
      name: member.user.full_name,
      relation: link.relationship,
      diagnoses: prescriptions.map((prescription) => prescription.diagnosis),
    });
  }

  const familyBlock = familyData
    .map((familyMember) => `${familyMember.relation} (${familyMember.name}): ${familyMember.diagnoses.join(', ') || 'No recorded diagnoses'}`)
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

const summarizeRecord = async (recordId, userId) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  const record = await MedicalRecord.findByPk(recordId);

  if (!record) {
    throw createHttpError(404, 'Record not found.');
  }

  if (!patient || record.patient_id !== patient.id) {
    throw createHttpError(403, 'Access denied.');
  }

  if (record.file_type !== 'pdf') {
    throw createHttpError(400, 'AI summarization only works on PDF records.');
  }

  const fs = require('fs');
  const pdfParse = require('pdf-parse');
  const path = require('path');

  const filePath = path.join(__dirname, '../../../uploads', path.basename(record.file_url));
  if (!fs.existsSync(filePath)) {
    throw createHttpError(404, 'File not found on server.');
  }

  const buffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(buffer);
  const text = pdfData.text.substring(0, 3000);

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

module.exports = {
  buildChatContext,
  chatWithBot,
  getEmbedding,
  getGeneticRisks,
  getPreVisitSummary,
  searchDocuments,
  summarizeRecord,
};
