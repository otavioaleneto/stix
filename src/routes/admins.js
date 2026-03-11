const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, requirePermission } = require('../middleware/auth');
const adminsController = require('../controllers/adminsController');
const rolesController = require('../controllers/rolesController');

router.get('/', requireAuth, requirePermission('manage_admins'), adminsController.index);
router.get('/new', requireAuth, requirePermission('manage_admins'), adminsController.create);
router.post('/', requireAuth, requirePermission('manage_admins'), adminsController.store);

router.get('/roles', requireAuth, requirePermission('manage_admins'), rolesController.index);
router.post('/roles', requireAuth, requirePermission('manage_admins'), rolesController.store);
router.post('/roles/:id', requireAuth, requirePermission('manage_admins'), rolesController.update);
router.post('/roles/:id/delete', requireAuth, requirePermission('manage_admins'), rolesController.destroy);

router.get('/:id/edit', requireAuth, requirePermission('manage_admins'), adminsController.edit);
router.post('/:id', requireAuth, requirePermission('manage_admins'), adminsController.update);
router.post('/:id/delete', requireAuth, requirePermission('manage_admins'), adminsController.destroy);

module.exports = router;
