const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const FamilyLink = sequelize.define('FamilyLink', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Who sent the request
  requester_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'patients', key: 'id' },
  },
  // Who received the request
  receiver_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'patients', key: 'id' },
  },
  // Relationship from requester's perspective (e.g. "I am the parent")
  relationship: {
    type: DataTypes.ENUM('parent', 'child', 'sibling', 'spouse', 'other'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    defaultValue: 'pending',
  },
}, { tableName: 'family_links' });

module.exports = FamilyLink;
