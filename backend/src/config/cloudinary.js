const cloudinary = require('cloudinary').v2;
const multer = require('multer');

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name'
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Files are kept in memory so the same bytes can go to storage and to the AI
// service without a second download. services/storage.js persists them.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      const err = new Error('Only JPG, PNG or WEBP images are allowed');
      err.statusCode = 400;
      return cb(err, false);
    }
    cb(null, true);
  },
});

module.exports = { cloudinary, upload, isCloudinaryConfigured };
