const Joi = require('joi');

const bookSchema = Joi.object({
  doctorId: Joi.string().uuid().required(),           // ✅ UUID فقط
  appointmentDate: Joi.date().min('now').required(),  // ✅ مش في الماضي
  timeSlot: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)          // ✅ format HH:MM بس
    .required(),
  notes: Joi.string().max(500).optional(),            // ✅ max length
});

const cancelSchema = Joi.object({
  reason: Joi.string().max(300).optional(),           // ✅ max length
});

const rateSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(), // ✅ integer فقط
});

module.exports = { bookSchema, cancelSchema, rateSchema };