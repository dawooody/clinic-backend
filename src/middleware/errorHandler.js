const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map((e) => e.message);
    return res.status(400).json({ success: false, message: 'Validation error', errors: messages });
  }

  // Sequelize unique constraint (e.g. duplicate email)
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ success: false, message: 'This record already exists.' });
  }

  // Multer file too large
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Max 10MB.' });
  }

  // Multer wrong field name or too many files
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: 'Upload a single file using the "file" field.' });
  }

  // Multer wrong file type
  if (err.status === 400 || (err.message && err.message.includes('Only JPG'))) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // Default
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};

module.exports = errorHandler;
