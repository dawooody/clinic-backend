const multer = require('multer');
const { SUPPORTED_REPORT_MIME_TYPES } = require('../../config/gemini');

const upload = multer({
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

const uploadMedicalFile = (fieldName = 'file') => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      const error = new Error('File too large. Max 10MB.');
      error.status = 413;
      return next(error);
    }

    return next(err);
  });
};

module.exports = uploadMedicalFile;
