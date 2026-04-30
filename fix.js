require('dotenv').config();
const { Patient, Appointment, Doctor, User } = require('./src/models');
const { Op } = require('sequelize');

const today = new Date().toISOString().split('T')[0];

Patient.findAll({
  include: [
    {
      model: Appointment,
      as: 'appointments',
      where: {
        appointment_date: { [Op.gte]: today },
      },
      required: false,
      attributes: ['id', 'appointment_date', 'time_slot', 'status'],
    },
  ],
  limit: 5,
  logging: console.log,
})
.then(r => console.log('Done:', r.length))
.catch(e => console.error('Error:', e.message))
.finally(() => process.exit());