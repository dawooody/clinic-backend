const router = require('express').Router();
const ctrl = require('./ai.controller');
const { protect } = require('../../middleware/auth');
const { roles } = require('../../middleware/roles');

router.post('/search', ctrl.search);
router.post('/chat', ctrl.chat);

router.post('/chatbot', protect, roles('patient'), ctrl.chatbot);
router.get('/pre-visit/:appointmentId', protect, roles('doctor'), ctrl.preVisitSummary);
router.get('/genetic-risks/:patientId', protect, roles('doctor'), ctrl.geneticRisks);
router.post('/summarize/:recordId', protect, roles('patient'), ctrl.summarizeRecord);

module.exports = router;
