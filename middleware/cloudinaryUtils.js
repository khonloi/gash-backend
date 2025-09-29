const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gash_app',
    transformation: [{ width: 1200, crop: 'limit' }],
    resource_type: 'image', // chỉ cho phép ảnh, chặn video/file khác
  },
});

const upload = multer({ storage });

module.exports = upload;