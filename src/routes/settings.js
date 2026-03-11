const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const settingsController = require('../controllers/settingsController');

router.get('/', requireAuth, requireRole('super_admin', 'admin'), settingsController.index);
router.post('/webdav', requireAuth, requireRole('super_admin', 'admin'), settingsController.saveWebDAV);
router.post('/webdav/test', requireAuth, requireRole('super_admin', 'admin'), settingsController.testWebDAV);
router.post('/wordpress', requireAuth, requireRole('super_admin', 'admin'), settingsController.saveWordPress);
router.post('/wordpress/test', requireAuth, requireRole('super_admin', 'admin'), settingsController.testWordPress);
router.post('/timezone', requireAuth, requireRole('super_admin', 'admin'), settingsController.saveTimezone);
router.post('/pydio', requireAuth, requireRole('super_admin', 'admin'), settingsController.savePydio);
router.post('/pydio/test', requireAuth, requireRole('super_admin', 'admin'), settingsController.testPydio);
router.post('/warp/test', requireAuth, requireRole('super_admin', 'admin'), settingsController.testWarp);
router.post('/gemini', requireAuth, requireRole('super_admin', 'admin'), settingsController.saveGemini);
router.post('/gemini/test', requireAuth, requireRole('super_admin', 'admin'), settingsController.testGemini);
module.exports = router;
