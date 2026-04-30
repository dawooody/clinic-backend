const router = require('express').Router();
const ctrl = require('./appointments.controller');
const validate = require('../../middleware/validate');
const { protect, roles } = require('../../middleware/auth');
const { bookSchema, cancelSchema, rateSchema } = require('./appointments.validation');

router.use(protect);

// ── Patient ──────────────────────────────────────────────────────────────────
router.post('/',              roles('patient'), validate(bookSchema), ctrl.book);
router.post('/:id/rate',      roles('patient'), validate(rateSchema), ctrl.rate);

// ── Doctor ───────────────────────────────────────────────────────────────────
router.get('/today',          roles('doctor'), ctrl.getToday);
router.put('/:id/confirm',    roles('doctor'), ctrl.confirm);
router.put('/:id/complete',   roles('doctor'), ctrl.complete);

// ── Patient & Doctor ─────────────────────────────────────────────────────────
router.put('/:id/cancel',     roles('patient', 'doctor'), validate(cancelSchema), ctrl.cancel);
router.put('/:id/reschedule', roles('patient', 'doctor'), ctrl.reschedule);
router.delete('/:id',         roles('patient', 'doctor'), ctrl.remove);

// ── Shared ───────────────────────────────────────────────────────────────────
router.get('/',    ctrl.getMyAppointments);
router.get('/:id', ctrl.getById);

module.exports = router;