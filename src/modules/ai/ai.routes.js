const router = require('express').Router();
const multer = require('multer');
const ctrl = require('./ai.controller');
const { protect } = require('../../middleware/auth');
const { roles } = require('../../middleware/roles');
const { SUPPORTED_REPORT_MIME_TYPES } = require('../../config/gemini');

const reportUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (SUPPORTED_REPORT_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }

    const error = new Error('Unsupported file type. Upload a PDF, JPG, PNG, or WEBP file.');
    error.status = 400;
    return cb(error);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/search', ctrl.search);
router.post('/chat', ctrl.chat);

// router.post('/chatbot', protect, roles('patient'), ctrl.chatbot);
router.post('/analyze-report', protect, roles('patient'), reportUpload.single('file'), ctrl.analyzeReport);
router.get('/pre-visit/:appointmentId', protect, roles('doctor'), ctrl.preVisitSummary);
router.get('/genetic-risks/:patientId', protect, roles('doctor'), ctrl.geneticRisks);
router.post('/summarize/:recordId', protect, roles('patient'), ctrl.summarizeRecord);

module.exports = router;
