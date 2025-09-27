const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gash_app',
    resource_type: 'image',
    transformation: [{ width: 1200, crop: 'limit' }],
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      const multer = require('multer');
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
      err.customMessage = `Invalid file type: "${file.mimetype}". Only image files are allowed (image/*).`;
      cb(err, false);
    }
  },
});

module.exports = upload;
