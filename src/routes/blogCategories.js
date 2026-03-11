const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const blogCategory = require('../controllers/blogCategoryController');

router.get('/', requireAuth, requirePermission('manage_settings'), blogCategory.listCategories);
router.get('/new', requireAuth, requirePermission('manage_settings'), blogCategory.createForm);
router.post('/', requireAuth, requirePermission('manage_settings'), blogCategory.store);
router.get('/:id/edit', requireAuth, requirePermission('manage_settings'), blogCategory.editForm);
router.post('/:id', requireAuth, requirePermission('manage_settings'), blogCategory.update);
router.post('/:id/delete', requireAuth, requirePermission('manage_settings'), blogCategory.destroy);

module.exports = router;
