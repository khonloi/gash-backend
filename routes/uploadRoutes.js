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

module.exports = router;