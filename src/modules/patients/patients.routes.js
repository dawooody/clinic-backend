const router = require('express').Router();
const ctrl   = require('./patients.controller');
const { protect } = require('../../middleware/auth');
const { roles }   = require('../../middleware/roles');
const upload      = require('../../middleware/upload');

// Patient: own profile
router.get('/profile',    protect, roles('patient'),          ctrl.getProfile);
router.put('/profile',    protect, roles('patient'), upload.single('profile_photo'), ctrl.updateProfile);

// Doctor/Admin: view a specific patient
router.get('/:id',        protect, roles('doctor', 'admin'),  ctrl.getPatientById);

module.exports = router;
