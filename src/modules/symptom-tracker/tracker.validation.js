const Joi = require('joi');

const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const timeOnly = Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/);

const medicationSchema = Joi.object({
  medicineName: Joi.string().trim().max(255),
  medicine_name: Joi.string().trim().max(255),
  dose: Joi.string().trim().max(255).allow('', null),
  takenTime: timeOnly.allow('', null),
  taken_time: timeOnly.allow('', null),
  isTaken: Joi.boolean(),
  is_taken: Joi.boolean(),
}).or('medicineName', 'medicine_name');

const buildSchema = (requirePainLevel = false) => {
  let schema = Joi.object({
    logDate: dateOnly,
    log_date: dateOnly,
    painLevel: Joi.number().integer().min(0).max(10),
    pain_level: Joi.number().integer().min(0).max(10),
    temperature: Joi.number().precision(1).min(0).max(60).allow(null),
    mood: Joi.string().trim().max(100).allow('', null),
    symptoms: Joi.alternatives().try(
      Joi.array().items(Joi.string().trim().allow('').max(255)),
      Joi.string().allow('')
    ).allow(null),
    notes: Joi.string().allow('').max(5000).allow(null),
    wellnessScore: Joi.number().integer().min(0).max(100).allow(null),
    wellness_score: Joi.number().integer().min(0).max(100).allow(null),
    medications: Joi.array().items(medicationSchema).empty(null).default([]),
    medications_taken: Joi.boolean(),
  }).unknown(false);

  if (requirePainLevel) {
    schema = schema.or('painLevel', 'pain_level');
  }

  return schema;
};

module.exports = {
  createLogSchema: buildSchema(true),
  updateLogSchema: buildSchema(false),
};
