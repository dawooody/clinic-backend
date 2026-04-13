const router = require('express').Router();
const ctrl   = require('./tracker.controller');
const { protect } = require('../../middleware/auth');
const { roles }   = require('../../middleware/roles');

router.post('/',                       protect, roles('patient'), ctrl.addLog);
router.get('/',                        protect, roles('patient'), ctrl.getMyLogs);
router.put('/:id',                     protect, roles('patient'), ctrl.updateLog);

// Doctor views patient logs
router.get('/patient/:patientId',      protect, roles('doctor'),  ctrl.getPatientLogs);

module.exports = router;
