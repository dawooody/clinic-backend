const router = require('express').Router();
const ctrl   = require('./records.controller');
const { protect } = require('../../middleware/auth');
const { roles }   = require('../../middleware/roles');
const uploadMedicalFile = require('./medical-upload');

router.post('/', protect, roles('patient'), uploadMedicalFile('file'), ctrl.upload);
router.get('/', protect, roles('patient'), ctrl.getMyRecords);
router.get('/:id', protect, roles('patient'), ctrl.getRecord);
router.delete('/:id', protect, roles('patient'), ctrl.deleteRecord);

module.exports = router;
