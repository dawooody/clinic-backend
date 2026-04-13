const router = require('express').Router();
const ctrl   = require('./ai.controller');
const { protect } = require('../../middleware/auth');
const { roles }   = require('../../middleware/roles');

// Chatbot — patient uses it to describe symptoms before booking
router.post('/chatbot',                    protect, roles('patient'),        ctrl.chatbot);

// Doctor gets a full AI-generated patient brief before the visit
router.get('/pre-visit/:appointmentId',    protect, roles('doctor'),         ctrl.preVisitSummary);

// Doctor requests genetic risk analysis for a patient
router.get('/genetic-risks/:patientId',    protect, roles('doctor'),         ctrl.geneticRisks);

// Patient requests re-summarization of one of their records
router.post('/summarize/:recordId',        protect, roles('patient'),        ctrl.summarizeRecord);

module.exports = router;
