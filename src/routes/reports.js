const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const reportsController = require('../controllers/reportsController');

router.get('/', requireAuth, requirePermission('manage_settings'), reportsController.index);
router.post('/:id/delete', requireAuth, requirePermission('manage_settings'), reportsController.destroy);

module.exports = router;
