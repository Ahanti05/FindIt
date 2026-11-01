const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const c = require('../controllers/recoveryController');

router.use(authenticate);

router.post('/', upload.array('evidenceImages', 3), c.createRecovery);
router.get('/mine', c.getMyRecoveries);
router.get('/:id', c.getRecovery);
router.patch('/:id/review', c.reviewRecovery);
router.post('/:id/complete', c.completeRecovery);
router.post('/:id/cancel', c.cancelRecovery);

module.exports = router;
