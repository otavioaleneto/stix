const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const attributesController = require('../controllers/attributesController');

router.use(requireAuth);

router.get('/', attributesController.index);
router.post('/', attributesController.store);
router.post('/json', attributesController.storeJson);
router.post('/:id/update', attributesController.update);
router.post('/:id/delete', attributesController.destroy);

module.exports = router;
