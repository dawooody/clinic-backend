const sequelize = require('../config/db');

const User           = require('./User');
const Patient        = require('./Patient');
const Doctor         = require('./Doctor');
const Specialty      = require('./Specialty');
const DoctorSchedule = require('./DoctorSchedule');
const Appointment    = require('./Appointment');
const MedicalRecord  = require('./MedicalRecord');
const Prescription   = require('./Prescription');
const SymptomLog     = require('./SymptomLog');
const FamilyLink     = require('./FamilyLink');
const Notification   = require('./Notification');
const Conversation   = require('./Conversation');
const Chat           = require('./Chat');
const DoctorBreak    = require('./DoctorBreak');

// ─── Associations ────────────────────────────────────────────────────────────

// User ↔ Patient  (one-to-one)
User.hasOne(Patient, { foreignKey: 'user_id', as: 'patientProfile', onDelete: 'CASCADE' });
Patient.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User ↔ Doctor  (one-to-one)
User.hasOne(Doctor, { foreignKey: 'user_id', as: 'doctorProfile', onDelete: 'CASCADE' });
Doctor.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Specialty ↔ Doctor  (one-to-many)
Specialty.hasMany(Doctor, { foreignKey: 'specialty_id', as: 'doctors' });
Doctor.belongsTo(Specialty, { foreignKey: 'specialty_id', as: 'specialty' });

// Doctor ↔ DoctorSchedule  (one-to-many)
Doctor.hasMany(DoctorSchedule, { foreignKey: 'doctor_id', as: 'schedules', onDelete: 'CASCADE' });
DoctorSchedule.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });

// Patient ↔ Appointment  (one-to-many)
Patient.hasMany(Appointment, { foreignKey: 'patient_id', as: 'appointments', onDelete: 'CASCADE' });
Appointment.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

// Doctor ↔ Appointment  (one-to-many)
Doctor.hasMany(Appointment, { foreignKey: 'doctor_id', as: 'doctorAppointments' });
Appointment.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });

// Appointment ↔ Prescription  (one-to-one)
Appointment.hasOne(Prescription, { foreignKey: 'appointment_id', as: 'prescription', onDelete: 'CASCADE' });
Prescription.belongsTo(Appointment, { foreignKey: 'appointment_id', as: 'appointment' });

// Doctor ↔ Prescription
Doctor.hasMany(Prescription, { foreignKey: 'doctor_id', as: 'prescriptions' });
Prescription.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });

// Patient ↔ Prescription
Patient.hasMany(Prescription, { foreignKey: 'patient_id', as: 'prescriptions' });
Prescription.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

// Patient ↔ MedicalRecord  (one-to-many)
Patient.hasMany(MedicalRecord, { foreignKey: 'patient_id', as: 'medicalRecords', onDelete: 'CASCADE' });
MedicalRecord.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

// Patient ↔ SymptomLog  (one-to-many)
Patient.hasMany(SymptomLog, { foreignKey: 'patient_id', as: 'symptomLogs', onDelete: 'CASCADE' });
SymptomLog.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });

// Patient ↔ FamilyLink  (many-to-many via self-join)
Patient.hasMany(FamilyLink, { foreignKey: 'requester_id', as: 'sentLinks' });
Patient.hasMany(FamilyLink, { foreignKey: 'receiver_id', as: 'receivedLinks' });
FamilyLink.belongsTo(Patient, { foreignKey: 'requester_id', as: 'requester' });
FamilyLink.belongsTo(Patient, { foreignKey: 'receiver_id', as: 'receiver' });

// User ↔ Notification  (one-to-many)
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User ↔ Conversation  (one-to-many)
User.hasMany(Conversation, { foreignKey: 'user_id', as: 'conversations', onDelete: 'CASCADE' });
Conversation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
// Doctor ↔ DoctorBreak  (one-to-many)
Doctor.hasMany(DoctorBreak, { foreignKey: 'doctor_id', as: 'breaks', onDelete: 'CASCADE' });
DoctorBreak.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });

module.exports = {
  sequelize,
  User,
  Patient,
  Doctor,
  Specialty,
  DoctorSchedule,
  Appointment,
  MedicalRecord,
  Prescription,
  SymptomLog,
  FamilyLink,
  Notification,
  Conversation,
  Chat,
  DoctorBreak,
};
