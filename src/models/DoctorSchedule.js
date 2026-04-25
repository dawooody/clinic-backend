const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DoctorSchedule = sequelize.define('DoctorSchedule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  doctor_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'doctors', key: 'id' },
  },
  day_of_week: {
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    type: DataTypes.SMALLINT,
    allowNull: false,
    validate: { min: 0, max: 6 },
  },
  start_time: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  end_time: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  slot_duration_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 30, // each appointment = 30 minutes
  },
  is_available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, { tableName: 'doctor_schedules' });

module.exports = DoctorSchedule;
