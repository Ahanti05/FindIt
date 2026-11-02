const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/matchController');

router.use(authenticate);

router.get('/mine', c.getMyMatches);
router.get('/conversations', c.getConversations);
router.get('/unread', c.getUnreadCount);
router.get('/item/:type/:itemId', c.getMatchesForItem);
router.get('/:matchId', c.getMatch);
router.patch('/:matchId/respond', c.respondToMatch);
router.get('/:matchId/messages', c.getMessages);
router.post('/:matchId/messages', c.sendMessage);
router.post('/:matchId/messages/read', c.readMessages);

module.exports = router;
