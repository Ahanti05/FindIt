const express = require('express');
const router = express.Router();
const {
  createFoundItem, getFoundItems, getFoundItemById,
  getMyFoundItems, updateFoundItem, deleteFoundItem,
} = require('../controllers/foundItemController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

router.get('/', optionalAuth, getFoundItems);
router.get('/my', authenticate, getMyFoundItems);
router.get('/:id', optionalAuth, getFoundItemById);
router.post('/', authenticate, upload.single('image'), createFoundItem);
router.patch('/:id', authenticate, updateFoundItem);
router.delete('/:id', authenticate, deleteFoundItem);

module.exports = router;
