const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const { requireAuth, requirePermission, requireGamePermission } = require('../middleware/auth');
const gamesController = require('../controllers/gamesController');
const upload = require('../middleware/upload');

const csvUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv') return cb(null, true);
    cb(new Error('Only CSV files are allowed'));
  }
});

router.get('/webdav-browse', requireAuth, requirePermission('manage_games'), gamesController.webdavBrowse);
router.get('/export-csv', requireAuth, requirePermission('manage_games'), gamesController.exportCsv);
router.get('/csv-template', requireAuth, requirePermission('manage_games'), gamesController.csvTemplate);
router.post('/import-csv', requireAuth, requirePermission('manage_games'), csvUpload.single('csv_file'), gamesController.importCsv);
router.get('/', requireAuth, requirePermission('manage_games'), gamesController.index);
router.get('/new', requireAuth, requirePermission('manage_games'), gamesController.create);
router.post('/', requireAuth, requirePermission('manage_games'), upload.single('cover_image'), gamesController.store);
router.get('/:id', requireAuth, requirePermission('manage_games'), gamesController.show);
router.get('/:id/edit', requireAuth, requirePermission('manage_games'), requireGamePermission('games_edit_others'), gamesController.edit);
router.post('/:id', requireAuth, requirePermission('manage_games'), requireGamePermission('games_edit_others'), upload.single('cover_image'), gamesController.update);
router.post('/:id/ai-complete', requireAuth, requirePermission('manage_games'), gamesController.aiComplete);
router.post('/:id/delete', requireAuth, requirePermission('manage_games'), requireGamePermission('games_delete'), gamesController.destroy);
router.post('/:id/comments/:commentId/delete', requireAuth, requirePermission('manage_games'), gamesController.deleteComment);

module.exports = router;
