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
  pain_level: {
    type: DataTypes.SMALLINT,
    allowNull: true,
    validate: { min: 0, max: 10 },
  },
  symptoms: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('symptoms');
      if (!value) {
        return [];
      }

      return String(value)
        .split(',')
        .map((symptom) => symptom.trim())
        .filter(Boolean);
    },
    set(value) {
      if (Array.isArray(value)) {
        this.setDataValue(
          'symptoms',
          value.map((symptom) => String(symptom).trim()).filter(Boolean).join(', ')
        );
      } else {
        this.setDataValue('symptoms', value);
      }
    },
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
    type: DataTypes.STRING,
    allowNull: true,
  },
  wellness_score: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 0, max: 100 },
  }
}, { tableName: 'symptom_logs' });

module.exports = SymptomLog;
