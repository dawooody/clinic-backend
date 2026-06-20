const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DoctorBreak = sequelize.define('DoctorBreak', {
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
  title: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('upcoming', 'active', 'completed'),
    defaultValue: 'upcoming',
  },
}, { tableName: 'doctor_breaks' });

module.exports = DoctorBreak;