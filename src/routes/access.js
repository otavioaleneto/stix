const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const accessController = require('../controllers/accessController');

router.get('/', requireAuth, requirePermission('manage_settings'), accessController.index);
router.post('/save', requireAuth, requirePermission('manage_settings'), accessController.save);
router.post('/add', requireAuth, requirePermission('manage_settings'), accessController.addLevel);
router.post('/delete/:levelId', requireAuth, requirePermission('manage_settings'), accessController.deleteLevel);

module.exports = router;
