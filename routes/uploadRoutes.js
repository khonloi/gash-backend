const express = require('express');
const multer = require('multer');
const upload = require('../middleware/cloudinaryUtils'); // sử dụng Cloudinary middleware

const router = express.Router();



// API upload 1 file (key: image)
router.post('/', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    res.json({
      success: true,
      message: 'File uploaded successfully',
      url: req.file.path, // link ảnh Cloudinary
      filename: req.file.filename, // public_id
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API upload nhiều file (key: images)
router.post('/multiple', upload.array('images', 10), (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    const files = req.files.map((file) => ({
      url: file.path, // link ảnh Cloudinary
      filename: file.filename, // public_id
    }));
    res.json({
      success: true,
      message: 'Files uploaded successfully',
      files,
    });
  } catch (err) {
    console.error('Upload multiple error:', err);
    next(err);
  }
}, (err, req, res, next) => {
  // Xử lý lỗi multer
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB per file.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  }
  // Xử lý lỗi Cloudinary timeout
  if (err && (err.name === 'TimeoutError' || err.http_code === 499)) {
    console.error('Cloudinary timeout error:', err);
    return res.status(504).json({
      success: false,
      message: 'Upload timeout. The request took too long. Please try again with fewer or smaller files.'
    });
  }
  if (err) {
    console.error('Upload error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Upload failed. Please try again.'
    });
  }
  next();
});

// ======================
// 🔥 ADD: CÁC API MỞ RỘNG
// ======================

// 👉 Upload emoji riêng (key: emoji)
router.post('/emoji', upload.single('emoji'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No emoji uploaded' });
    }
    res.json({
      success: true,
      message: 'Emoji uploaded successfully',
      type: 'emoji',
      url: req.file.path,
      filename: req.file.filename,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 👉 Upload sticker riêng (key: sticker)
router.post('/sticker', upload.single('sticker'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No sticker uploaded' });
    }
    res.json({
      success: true,
      message: 'Sticker uploaded successfully',
      type: 'sticker',
      url: req.file.path,
      filename: req.file.filename,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 👉 Upload generic file (PDF, DOCX, ZIP,...)
router.post('/file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    res.json({
      success: true,
      message: 'File uploaded successfully',
      type: 'file',
      url: req.file.path,
      filename: req.file.filename,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======================
// EXPORT ROUTER
// ======================
module.exports = router;