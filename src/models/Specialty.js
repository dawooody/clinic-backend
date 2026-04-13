const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Specialty = sequelize.define('Specialty', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  icon: {
    type: DataTypes.STRING(100), // icon name for mobile UI
    allowNull: true,
  },
}, { tableName: 'specialties' });

module.exports = Specialty;
