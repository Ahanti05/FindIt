const express = require('express');
const { makeItemController } = require('../controllers/itemController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// Builds the router for /api/lost-items or /api/found-items.
const itemRouter = (type) => {
  const router = express.Router();
  const c = makeItemController(type);

  router.get('/', optionalAuth, c.list);
  router.get('/my', authenticate, c.mine);
  router.get('/:id', optionalAuth, c.getById);

  router.post('/', authenticate, upload.single('image'), c.create);
  router.patch('/:id', authenticate, c.update);
  router.delete('/:id', authenticate, c.remove);
  router.post('/:id/reprocess', authenticate, c.reprocess);
  router.post('/:id/flag', authenticate, c.flag);
  if (type === 'found') router.post('/:id/mine', authenticate, c.thisIsMine);

  return router;
};

module.exports = itemRouter;
