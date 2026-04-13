const router = require('express').Router();
const ctrl   = require('./family.controller');
const { protect, roles } = require('../../middleware/auth');

router.use(protect);
router.use(roles('patient'));

router.post('/',          ctrl.requestLink);
router.get('/',           ctrl.getMyFamily);
router.get('/pending',    ctrl.getPending);
router.put('/:id/accept', ctrl.acceptLink);
router.put('/:id/reject', ctrl.rejectLink);

module.exports = router;