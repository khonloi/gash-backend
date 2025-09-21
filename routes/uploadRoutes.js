const express = require('express');
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
      url: req.file.path,      // link ảnh Cloudinary
      filename: req.file.filename, // public_id
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API upload nhiều file (key: images)
router.post('/multiple', upload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    const files = req.files.map(file => ({
      url: file.path,         // link ảnh Cloudinary
      filename: file.filename // public_id
    }));
    res.json({
      success: true,
      message: 'Files uploaded successfully',
      files
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;