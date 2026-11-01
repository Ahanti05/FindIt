const express = require('express');
const router = express.Router();
const {
  createLostItem, getLostItems, getLostItemById,
  updateLostItem, deleteLostItem, getMyLostItems,
} = require('../controllers/lostItemController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// Public
router.get('/', optionalAuth, getLostItems);
router.get('/my', authenticate, getMyLostItems);
router.get('/:id', optionalAuth, getLostItemById);

// Protected
router.post('/', authenticate, upload.single('image'), createLostItem);
router.patch('/:id', authenticate, updateLostItem);
router.delete('/:id', authenticate, deleteLostItem);

module.exports = router;
