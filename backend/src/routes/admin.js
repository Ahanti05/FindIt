const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/adminController');

router.use(authenticate, authorize('admin'));

router.get('/stats', c.getStats);
router.get('/pending', c.getPendingItems);
router.patch('/moderate/:itemType/:itemId', c.moderateItem);
router.get('/recoveries', c.getRecoveries);
router.get('/users', c.getUsers);
router.patch('/users/:userId/toggle', c.toggleUserStatus);
router.post('/ai/backfill', c.backfillAI);

module.exports = router;
