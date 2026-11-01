const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name department avatar role studentId');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
