const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Chat = sequelize.define('Chat', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  conversation_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'conversations', key: 'id' },
  },
  role: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  message_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  attachments: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'chats',
  timestamps: false,
});

module.exports = Chat;
