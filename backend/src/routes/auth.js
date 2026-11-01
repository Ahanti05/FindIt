const express = require('express');
const router = express.Router();
const { register, login, getMe, forgotPassword, resetPassword, updateProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, upload.single('avatar'), updateProfile);

module.exports = router;
