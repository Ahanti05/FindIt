const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const { analyzePreview, status } = require('../controllers/aiController');

router.get('/status', status);
router.post('/analyze', authenticate, upload.single('image'), analyzePreview);

module.exports = router;
