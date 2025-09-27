const express = require('express');
const multer = require('multer');
const upload = require('../middleware/cloudinaryUtils');

const router = express.Router();

// Middleware xử lý lỗi upload
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(415).json({
      success: false,
      error: 'Unsupported Media Type',
      message: err.customMessage || 'Only image files are allowed!',
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: err.message,
    });
  }
  next();
}

// === Upload 1 file (key: image) ===
router.post('/', upload.single('image'), handleUploadError, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  res.json({
    success: true,
    message: 'File uploaded successfully',
    url: req.file.path,
    filename: req.file.filename,
  });
});

// === Upload nhiều file (key: images) ===
router.post('/multiple', upload.array('images', 10), handleUploadError, (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded' });
  }
  const files = req.files.map((file) => ({
    url: file.path,
    filename: file.filename,
  }));
  res.json({
    success: true,
    message: 'Files uploaded successfully',
    files,
  });
});

module.exports = router;