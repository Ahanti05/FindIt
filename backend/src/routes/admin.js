const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getStats, getPendingItems, moderateItem, getUsers, toggleUserStatus } = require('../controllers/adminController');

router.use(authenticate, authorize('admin'));

router.get('/stats', getStats);
router.get('/pending', getPendingItems);
router.patch('/moderate/:itemType/:itemId', moderateItem);
router.get('/users', getUsers);
router.patch('/users/:userId/toggle', toggleUserStatus);

module.exports = router;
