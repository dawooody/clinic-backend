const notify = require('../../utils/notify');
const { Prescription, Doctor, Patient, Appointment, User, Specialty } = require('../../models');
const { Op } = require('sequelize');

const prescriptionInclude = [
  {
    model: Doctor, as: 'doctor',
    include: [{ model: User, as: 'user', attributes: ['full_name', 'profile_photo'] },
              { model: Specialty, as: 'specialty', attributes: ['name'] }],
  },
  {
    model: Patient, as: 'patient',
    include: [{ model: User, as: 'user', attributes: ['full_name'] }],
  },
  { model: Appointment, as: 'appointment', attributes: ['appointment_date', 'time_slot'] },
];

const createPrescription = async (doctorUserId, body) => {
  const { appointment_id, patient_id, diagnosis, medicines, instructions, follow_up_date } = body;

  if (!appointment_id || !patient_id || !diagnosis || !medicines) {
    throw { status: 400, message: 'appointment_id, patient_id, diagnosis, and medicines are required.' };
  }

  const doctor = await Doctor.findOne({ where: { user_id: doctorUserId } });
  if (!doctor) throw { status: 404, message: 'Doctor profile not found.' };

  // Check appointment belongs to this doctor
  const appointment = await Appointment.findByPk(appointment_id);
  if (!appointment || appointment.doctor_id !== doctor.id) {
    throw { status: 403, message: 'Appointment not found or access denied.' };
  }

  // Check prescription doesn't already exist for this appointment
  const existing = await Prescription.findOne({ where: { appointment_id } });
  if (existing) throw { status: 409, message: 'Prescription already exists for this appointment.' };

  const prescription = await Prescription.create({
    appointment_id,
    doctor_id: doctor.id,
    patient_id,
    diagnosis,
    medicines,          // JSON array: [{name, dosage, frequency, duration}]
    instructions,
    follow_up_date,
  });

  // Notify patient that a prescription was created
  await notify(
    patient.user_id,
    'New Prescription',
    'Your doctor has written a new prescription for you. Open the app to view it.',
    'prescription',
    { prescription_id: prescription.id }
  );

  return Prescription.findByPk(prescription.id, { include: prescriptionInclude });
};

const getMyPrescriptions = async (userId, { page = 1, limit = 10 }) => {
  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (!patient) throw { status: 404, message: 'Patient profile not found.' };

  const offset = (page - 1) * limit;
  const { rows, count } = await Prescription.findAndCountAll({
    where: { patient_id: patient.id },
    include: prescriptionInclude,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset,
    distinct: true,
  });

  return { rows, count };
};

const getPrescriptionById = async (id, userId, role) => {
  const prescription = await Prescription.findByPk(id, { include: prescriptionInclude });
  if (!prescription) throw { status: 404, message: 'Prescription not found.' };

  if (role === 'patient') {
    const patient = await Patient.findOne({ where: { user_id: userId } });
    if (prescription.patient_id !== patient.id) throw { status: 403, message: 'Access denied.' };
  }

  return prescription;
};

const getPatientPrescriptions = async (doctorUserId, patientId, query) => {
  const doctor = await Doctor.findOne({ where: { user_id: doctorUserId } });
  const offset = ((query.page || 1) - 1) * (query.limit || 10);

  const { rows, count } = await Prescription.findAndCountAll({
    where: { doctor_id: doctor.id, patient_id: patientId },
    include: prescriptionInclude,
    order: [['created_at', 'DESC']],
    limit: parseInt(query.limit || 10),
    offset,
    distinct: true,
  });

  return { rows, count };
};

module.exports = { createPrescription, getMyPrescriptions, getPrescriptionById, getPatientPrescriptions };
