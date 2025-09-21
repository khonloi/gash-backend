const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gash_app',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 1200, crop: 'limit' }],
  },
});

const upload = multer({ storage });

module.exports = upload;