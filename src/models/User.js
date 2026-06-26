const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  full_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('patient', 'doctor', 'admin'),
    defaultValue: 'patient',
  },
  profile_photo: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  fcm_token: {
  type: DataTypes.TEXT,
  allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  reset_code: {
    type: DataTypes.STRING(6),
    allowNull: true,
  },
  reset_code_expiry: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  is_verified: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
},

verification_code: {
  type: DataTypes.STRING,
},

verification_code_expiry: {
  type: DataTypes.DATE,
},
}, {
  tableName: 'users',
  hooks: {
    // Hash password before saving
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
  },
});

// Instance method to compare passwords
User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = User;
