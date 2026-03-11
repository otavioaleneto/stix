const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const eventTypes = require('../controllers/eventTypeController');

router.get('/', requireAuth, requirePermission('manage_settings'), eventTypes.listTypes);
router.get('/new', requireAuth, requirePermission('manage_settings'), eventTypes.createForm);
router.post('/', requireAuth, requirePermission('manage_settings'), eventTypes.store);
router.get('/:id/edit', requireAuth, requirePermission('manage_settings'), eventTypes.editForm);
router.post('/:id', requireAuth, requirePermission('manage_settings'), eventTypes.update);
router.post('/:id/delete', requireAuth, requirePermission('manage_settings'), eventTypes.destroy);

module.exports = router;
