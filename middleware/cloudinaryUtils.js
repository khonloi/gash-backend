const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gash_app',
    transformation: [{ width: 1200, crop: 'limit' }],
    resource_type: 'image', // chỉ cho phép ảnh, chặn video/file khác
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif'], // Cho phép tất cả định dạng ảnh phổ biến
    timeout: 60000, // 60 giây timeout cho mỗi file
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Cho phép tất cả định dạng ảnh
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/x-icon',
      'image/tiff',
      'image/x-tiff'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

module.exports = upload;