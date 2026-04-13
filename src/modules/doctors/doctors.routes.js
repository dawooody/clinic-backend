const router = require('express').Router();
const ctrl   = require('./doctors.controller');
const { protect } = require('../../middleware/auth');
const { roles }   = require('../../middleware/roles');
const upload      = require('../../middleware/upload');

// ── Doctor-specific routes MUST come before /:id  ──────────────────────────
// If /me/profile is after /:id, Express matches "me" as the :id param (critical bug)
router.get('/me/profile',    protect, roles('doctor'), ctrl.getMyProfile);
router.put('/me/profile',    protect, roles('doctor'), upload.single('profile_photo'), ctrl.updateProfile);
router.put('/me/schedule',   protect, roles('doctor'), ctrl.setSchedule);

// Public — anyone (including mobile guests) can browse doctors
router.get('/',              ctrl.getAllDoctors);
router.get('/:id',           ctrl.getDoctorById);
router.get('/:id/slots',     ctrl.getAvailableSlots);

module.exports = router;
