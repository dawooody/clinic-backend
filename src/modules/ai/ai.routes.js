const router = require('express').Router();
const multer = require('multer');
const ctrl = require('./ai.controller');
const conversationCtrl = require('./conversation.controller');
const voiceCtrl = require('./voice.controller');
const { protect } = require('../../middleware/auth');
const { roles } = require('../../middleware/roles');
const uploadMedicalFile = require('../medical-records/medical-upload');
const {
  MAX_AUDIO_FILE_SIZE_BYTES,
  isSupportedAudioFile,
} = require('./voice.helpers');

const audioUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (isSupportedAudioFile(file)) {
      return cb(null, true);
    }

    const error = new Error('Unsupported audio type. Upload a WEBM, MP3, WAV, or M4A file.');
    error.status = 400;
    return cb(error);
  },
  limits: { fileSize: MAX_AUDIO_FILE_SIZE_BYTES },
});

const uploadVoiceAudio = (req, res, next) => {
  audioUpload.single('audio')(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      const error = new Error('Audio file too large. Max 10MB.');
      error.status = 413;
      return next(error);
    }

    return next(err);
  });
};

router.use(protect);

router.post('/search', ctrl.search);
router.get('/voices', voiceCtrl.voices);

router.post('/conversations', conversationCtrl.createConversation);
router.get('/conversations', conversationCtrl.getConversations);
router.get('/conversations/:conversationId', conversationCtrl.getConversation);
router.patch('/conversations/:conversationId', conversationCtrl.renameConversation);
router.delete('/conversations/:conversationId', conversationCtrl.deleteConversation);

router.post('/chat', ctrl.chat);
router.post('/voice-chat', uploadVoiceAudio, voiceCtrl.voiceChat);

// router.post('/chatbot', protect, roles('patient'), ctrl.chatbot);
router.post('/analyze-report', roles('patient'), uploadMedicalFile('file'), ctrl.analyzeReport);
router.get('/pre-visit/:appointmentId', roles('doctor'), ctrl.preVisitSummary);
router.get('/genetic-risks/:patientId', roles('doctor'), ctrl.geneticRisks);
router.post('/summarize/:recordId', roles('patient'), ctrl.summarizeRecord);

module.exports = router;
