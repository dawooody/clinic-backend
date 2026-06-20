const router = require('express').Router();
const ctrl   = require('./doctors.controller');
const { protect } = require('../../middleware/auth');
const { roles }   = require('../../middleware/roles');
const upload      = require('../../middleware/upload');

// ── Doctor-specific routes MUST come before /:id  ──────────────────────────
router.get('/me/profile',    protect, roles('doctor'), ctrl.getMyProfile);
router.put('/me/profile',    protect, roles('doctor'), upload.single('profile_photo'), ctrl.updateProfile);

// Weekly Performance Stats
router.get('/me/stats/weekly', protect, roles('doctor'), ctrl.getWeeklyStats);

// Clinic Availability (weekly schedule)
router.get('/me/schedule',        protect, roles('doctor'), ctrl.getSchedule);
router.put('/me/schedule',        protect, roles('doctor'), ctrl.setSchedule);
router.patch('/me/schedule/:day', protect, roles('doctor'), ctrl.patchScheduleDay);

// Upcoming Breaks
router.get('/me/breaks',        protect, roles('doctor'), ctrl.getBreaks);
router.post('/me/breaks',       protect, roles('doctor'), ctrl.createBreak);
router.delete('/me/breaks/:id', protect, roles('doctor'), ctrl.deleteBreak);

// Public — anyone (including mobile guests) can browse doctors
router.get('/',              ctrl.getAllDoctors);
router.get('/:id',           ctrl.getDoctorById);
router.get('/:id/slots',     ctrl.getAvailableSlots);

module.exports = router;