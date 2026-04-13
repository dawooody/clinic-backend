require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { sequelize, Specialty } = require('../models');

const specialties = [
  { name: 'General Practice',      description: 'Primary care for all ages',                     icon: 'stethoscope' },
  { name: 'Cardiology',            description: 'Heart and cardiovascular system',                icon: 'heart' },
  { name: 'Neurology',             description: 'Brain and nervous system disorders',             icon: 'brain' },
  { name: 'Orthopedics',           description: 'Bones, joints, and musculoskeletal system',      icon: 'bone' },
  { name: 'Dermatology',           description: 'Skin, hair, and nail conditions',                icon: 'skin' },
  { name: 'Pediatrics',            description: 'Medical care for infants and children',          icon: 'baby' },
  { name: 'Gynecology',            description: 'Women\'s reproductive health',                   icon: 'female' },
  { name: 'Ophthalmology',         description: 'Eyes and vision care',                           icon: 'eye' },
  { name: 'ENT',                   description: 'Ear, nose, and throat conditions',               icon: 'ear' },
  { name: 'Psychiatry',            description: 'Mental health and behavioral disorders',         icon: 'mind' },
  { name: 'Endocrinology',         description: 'Hormones and metabolism (diabetes, thyroid)',    icon: 'hormone' },
  { name: 'Gastroenterology',      description: 'Digestive system and gastrointestinal tract',    icon: 'stomach' },
  { name: 'Pulmonology',           description: 'Lungs and respiratory system',                   icon: 'lungs' },
  { name: 'Nephrology',            description: 'Kidneys and urinary tract',                      icon: 'kidney' },
  { name: 'Oncology',              description: 'Cancer diagnosis and treatment',                 icon: 'ribbon' },
  { name: 'Urology',               description: 'Urinary and male reproductive system',           icon: 'urology' },
  { name: 'Rheumatology',          description: 'Joints, muscles, and autoimmune conditions',     icon: 'joint' },
  { name: 'Hematology',            description: 'Blood disorders and diseases',                   icon: 'blood' },
];

const seed = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    for (const spec of specialties) {
      await Specialty.findOrCreate({ where: { name: spec.name }, defaults: spec });
    }

    console.log(`✅ Seeded ${specialties.length} specialties successfully`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
