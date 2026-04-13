const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Doctor = sequelize.define('Doctor', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  specialty_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'specialties', key: 'id' },
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  license_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
  },
  years_experience: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  consultation_fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0,
  },
  total_reviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, { tableName: 'doctors' });

module.exports = Doctor;
