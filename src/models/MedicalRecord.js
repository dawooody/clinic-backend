const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const MedicalRecord = sequelize.define('MedicalRecord', {
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
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  file_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  storage_path: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  file_type: {
    type: DataTypes.ENUM('pdf', 'image'),
    allowNull: false,
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // Gemini-generated summary of this record
  ai_summary: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ai_detailed_analysis: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ai_analysis_json: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  analysis_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  analyzed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  record_type: {
    type: DataTypes.ENUM('lab_result', 'radiology', 'prescription', 'other'),
    defaultValue: 'other',
  },
  record_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
}, { tableName: 'medical_records' });

module.exports = MedicalRecord;
