const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // user_id from the users table (patient, doctor, or admin)
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('appointment', 'prescription', 'family_link', 'general'),
    defaultValue: 'general',
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Extra payload for the Flutter app to navigate on tap (e.g. { appointment_id: "..." })
  data: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, { tableName: 'notifications' });

module.exports = Notification;
