const router = require('express').Router();
const ctrl   = require('./prescriptions.controller');
const { protect } = require('../../middleware/auth');
const { roles }   = require('../../middleware/roles');

// Doctor creates a prescription
router.post('/',                          protect, roles('doctor'),  ctrl.create);
router.get('/patient/:patientId',         protect, roles('doctor'),  ctrl.getPatientPrescriptions);

// Patient views their own prescriptions
router.get('/',                           protect, roles('patient'), ctrl.getMyPrescriptions);
router.get('/:id',                        protect,                   ctrl.getById);

module.exports = router;
