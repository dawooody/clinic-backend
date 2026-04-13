const router = require('express').Router();
const ctrl   = require('./records.controller');
const { protect } = require('../../middleware/auth');
const { roles }   = require('../../middleware/roles');
const upload      = require('../../middleware/upload');

// Patient uploads and views their own records
router.post('/',                     protect, roles('patient'), upload.single('file'), ctrl.upload);
router.get('/',                      protect, roles('patient'),                        ctrl.getMyRecords);
router.delete('/:id',                protect, roles('patient'),                        ctrl.deleteRecord);

// Doctor views a specific patient's records
router.get('/patient/:patientId',    protect, roles('doctor'),                         ctrl.getPatientRecords);

module.exports = router;
