const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requirePermission } = require('../middleware/auth');
const events = require('../controllers/eventController');

const eventsUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'events');
try {
  if (!fs.existsSync(eventsUploadDir)) {
    fs.mkdirSync(eventsUploadDir, { recursive: true });
  }
} catch (err) {
  console.warn('[EVENTS] Could not create events uploads directory:', err.message);
}

const eventsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(eventsUploadDir)) {
      return cb(new Error('Events upload directory does not exist.'));
    }
    cb(null, eventsUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const eventsUpload = multer({
  storage: eventsStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpg, png, gif, webp)'));
  }
});

router.get('/', requireAuth, requirePermission('manage_settings'), events.listEvents);
router.get('/new', requireAuth, requirePermission('manage_settings'), events.createForm);
router.post('/', requireAuth, requirePermission('manage_settings'), events.store);
router.post('/upload', requireAuth, requirePermission('manage_settings'), (req, res, next) => {
  eventsUpload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Upload failed' });
    }
    next();
  });
}, events.uploadImage);
router.get('/:id/edit', requireAuth, requirePermission('manage_settings'), events.editForm);
router.post('/:id', requireAuth, requirePermission('manage_settings'), events.update);
router.post('/:id/delete', requireAuth, requirePermission('manage_settings'), events.destroy);

module.exports = router;
