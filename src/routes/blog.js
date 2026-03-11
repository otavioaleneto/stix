const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requirePermission } = require('../middleware/auth');
const blog = require('../controllers/blogController');

const blogUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'blog');
try {
  if (!fs.existsSync(blogUploadDir)) {
    fs.mkdirSync(blogUploadDir, { recursive: true });
  }
} catch (err) {
  console.warn('[BLOG] Could not create blog uploads directory:', err.message);
}

const blogStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(blogUploadDir)) {
      return cb(new Error('Blog upload directory does not exist.'));
    }
    cb(null, blogUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const blogUpload = multer({
  storage: blogStorage,
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

router.get('/', requireAuth, requirePermission('manage_settings'), blog.listPosts);
router.get('/new', requireAuth, requirePermission('manage_settings'), blog.createForm);
router.post('/', requireAuth, requirePermission('manage_settings'), blog.store);
router.post('/upload', requireAuth, requirePermission('manage_settings'), (req, res, next) => {
  blogUpload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Upload failed' });
    }
    next();
  });
}, blog.uploadImage);
router.get('/:id/edit', requireAuth, requirePermission('manage_settings'), blog.editForm);
router.post('/:id', requireAuth, requirePermission('manage_settings'), blog.update);
router.post('/:id/delete', requireAuth, requirePermission('manage_settings'), blog.destroy);
router.delete('/:id/comments/:commentId', requireAuth, requirePermission('manage_settings'), blog.adminDeleteBlogComment);

module.exports = router;
