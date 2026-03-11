const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn('[UPLOAD] Could not create uploads directory:', err.message);
  console.warn('[UPLOAD] Please create the folder manually: src/public/uploads/');
  console.warn('[UPLOAD] And set permissions to 775 or 777 (chmod 775 src/public/uploads)');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      return cb(new Error('Upload directory does not exist. Create src/public/uploads/ manually and set permissions to 775.'));
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed (jpg, png, gif, webp)'));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
});

module.exports = upload;
