const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const c = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// Stricter limit on credential endpoints to slow down guessing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Try again in a few minutes.' },
});

router.post('/register', authLimiter, c.register);
router.post('/login', authLimiter, c.login);
router.post('/forgot-password', authLimiter, c.forgotPassword);
router.post('/reset-password/:token', authLimiter, c.resetPassword);
router.get('/me', authenticate, c.getMe);
router.patch('/profile', authenticate, upload.single('avatar'), c.updateProfile);
router.patch('/password', authenticate, authLimiter, c.changePassword);

module.exports = router;
