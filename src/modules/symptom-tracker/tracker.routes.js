const router = require('express').Router();
const ctrl   = require('./tracker.controller');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { roles }   = require('../../middleware/roles');
const { createLogSchema, updateLogSchema } = require('./tracker.validation');

router.post('/',                       protect, roles('patient'), validate(createLogSchema), ctrl.addLog);
router.get('/',                        protect, roles('patient'), ctrl.getMyLogs);
router.put('/:id',                     protect, roles('patient'), validate(updateLogSchema), ctrl.updateLog);

// Doctor views patient logs
router.get('/patient/:patientId',      protect, roles('doctor'),  ctrl.getPatientLogs);

module.exports = router;
