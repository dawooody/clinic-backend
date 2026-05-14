const { Patient, User, Appointment, Doctor } = require('../../models');
const path = require('path');

const getProfile = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['password', 'refresh_token'] },
    include: [{ model: Patient, as: 'patientProfile' }],
  });
  if (!user) throw { status: 404, message: 'Patient not found.' };
  return user;
};

const updateProfile = async (userId, body, file) => {
  const user = await User.findByPk(userId);
  if (!user) throw { status: 404, message: 'User not found.' };

  const { full_name, phone, date_of_birth, gender, blood_type,
          allergies, chronic_conditions, emergency_contact_name,
          emergency_contact_phone, address } = body;

  // Update user fields
  const userUpdates = {};
  if (full_name) userUpdates.full_name = full_name;
  if (phone)     userUpdates.phone     = phone;
  if (file)      userUpdates.profile_photo = `${process.env.BASE_URL}/uploads/${file.filename}`;

  if (Object.keys(userUpdates).length) await user.update(userUpdates);

  // Update patient profile fields
  const patient = await Patient.findOne({ where: { user_id: userId } });
  if (patient) {
    const patientUpdates = {};
    if (date_of_birth)           patientUpdates.date_of_birth           = date_of_birth;
    if (gender)                  patientUpdates.gender                   = gender;
    if (blood_type)              patientUpdates.blood_type               = blood_type;
    if (allergies !== undefined) patientUpdates.allergies                = allergies;
    if (chronic_conditions !== undefined) patientUpdates.chronic_conditions = chronic_conditions;
    if (emergency_contact_name)  patientUpdates.emergency_contact_name  = emergency_contact_name;
    if (emergency_contact_phone) patientUpdates.emergency_contact_phone = emergency_contact_phone;
    if (address)                 patientUpdates.address                  = address;

    if (Object.keys(patientUpdates).length) await patient.update(patientUpdates);
  }

  return getProfile(userId);
};

// Used by doctors to view a patient's basic profile
const getPatientById = async (patientId) => {
  const patient = await Patient.findByPk(patientId, {
    include: [{
      model: User,
      as: 'user',
      attributes: ['full_name', 'email', 'phone', 'profile_photo'],
    }],
  });
  if (!patient) throw { status: 404, message: 'Patient not found.' };
  return patient;
};

const getDoctorPatients = async (doctorUserId) => {
  // Find doctor profile using logged-in user id
  const doctor = await Doctor.findOne({
    where: { user_id: doctorUserId },
  });

  if (!doctor) {
    throw { status: 404, message: 'Doctor not found.' };
  }

  const patients = await Patient.findAll({
    include: [
      {
        model: Appointment,
        as: 'appointments',
        where: {
          doctor_id: doctor.id,
        },
        attributes: [],
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'full_name', 'email', 'phone', 'profile_photo'],
      },
    ],
    distinct: true,
  });

  return patients;
};

module.exports = {
  getProfile,
  updateProfile,
  getPatientById,
  getDoctorPatients,
};
