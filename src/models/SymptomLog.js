const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SymptomLog = sequelize.define('SymptomLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  patient_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'patients', key: 'id' },
  },
  log_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  // Pain scale 1-5
  pain_level: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  symptoms: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  medications_taken: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  temperature: {
    type: DataTypes.DECIMAL(4, 1),
    allowNull: true,
  },
  mood: {
    type: DataTypes.ENUM('great', 'good', 'okay', 'bad', 'terrible'),
    allowNull: true,
  },
}, { tableName: 'symptom_logs' });

module.exports = SymptomLog;
