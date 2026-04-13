const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Prescription = sequelize.define('Prescription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  appointment_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'appointments', key: 'id' },
  },
  doctor_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'doctors', key: 'id' },
  },
  patient_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'patients', key: 'id' },
  },
  diagnosis: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  // Array of { name, dosage, frequency, duration } stored as JSON
  medicines: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  instructions: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  follow_up_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
}, { tableName: 'prescriptions' });

module.exports = Prescription;
