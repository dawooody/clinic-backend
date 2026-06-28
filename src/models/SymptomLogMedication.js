const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SymptomLogMedication = sequelize.define('SymptomLogMedication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  symptom_log_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'symptom_logs', key: 'id' },
  },
  medicine_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dose: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  taken_time: {
    type: DataTypes.TIME,
    allowNull: true,
  },
  is_taken: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, { 
  tableName: 'symptom_log_medications',
});

module.exports = SymptomLogMedication;
