const express = require('express');
const upload = require('../middleware/cloudinaryUtils'); 

const router = express.Router();

// API upload 1 hoặc nhiều ảnh
router.post(
  '/',
  upload.fields([
    { name: 'image', maxCount: 1 },   // cho phép 1 ảnh
    { name: 'images', maxCount: 10 }, // cho phép nhiều ảnh
  ]),
  (req, res) => {
    try {
      if ((!req.files['image'] || req.files['image'].length === 0) &&
          (!req.files['images'] || req.files['images'].length === 0)) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      // Gom tất cả ảnh (1 hoặc nhiều) lại thành 1 mảng
      const allFiles = [
        ...(req.files['image'] || []),
        ...(req.files['images'] || []),
      ];

      const files = allFiles.map(file => ({
        url: file.path,        // link ảnh Cloudinary
        filename: file.filename // public_id
      }));

      res.json({
        success: true,
        message: 'File(s) uploaded successfully',
        files,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
