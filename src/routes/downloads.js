const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const downloadsController = require('../controllers/downloadsController');

router.use(requireAuth);

router.get('/', downloadsController.index);
router.get('/history', downloadsController.historyJson);
router.get('/active', downloadsController.activeJson);
router.post('/:id/cancel', downloadsController.cancel);

module.exports = router;
