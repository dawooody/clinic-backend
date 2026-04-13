const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  patient_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  doctor_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  appointment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: { isDate: true },
  },
  time_slot: {
    type: DataTypes.TIME,
    allowNull: false,
    validate: { notEmpty: true },
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled'),
    defaultValue: 'pending',
  },
  ai_chatbot_summary: DataTypes.TEXT,
  ai_suggested_specialty: DataTypes.STRING(100),
  patient_notes: DataTypes.TEXT,
  doctor_notes: DataTypes.TEXT,
  cancellation_reason: DataTypes.TEXT,
  rating: {
    type: DataTypes.TINYINT,
    validate: { min: 1, max: 5 },
  },
}, 
{tableName: 'appointments',
  indexes: [
    {
      unique: true,
      fields: ['doctor_id', 'appointment_date', 'time_slot'],
    },
  ],
});

module.exports = Appointment;

