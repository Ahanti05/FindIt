const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { detectObjects, respondToMatch } = require('../controllers/aiController');

router.post('/detect', authenticate, detectObjects);

module.exports = router;
