const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { authenticateToken } = require('../middleware/auth');

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

// File filter for allowed community file types
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|svg|mp4|webm|mkv|mov|mp3|wav|ogg|aac|pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip)$/i;
  const isExtAllowed = allowedExtensions.test(path.extname(file.originalname).toLowerCase());

  if (isExtAllowed) {
    return cb(null, true);
  }
  cb(new Error('File format not supported! Allowed: Images, Videos, Audio, PDFs, Office Documents, TXT & ZIP files.'));
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  fileFilter
});

function getCategoryFromMime(mimetype, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (ext.match(/\.(doc|docx|ppt|pptx|xls|xlsx|txt|zip)$/i)) return 'document';
  return 'other';
}

// POST file upload endpoint
router.post('/', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const category = getCategoryFromMime(req.file.mimetype, req.file.originalname);
    const fileUrl = `/uploads/${req.file.filename}`;

    const uploadRecord = {
      id: uuidv4(),
      user_id: req.user.id,
      uploader_name: req.user.username,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_url: fileUrl,
      file_size: req.file.size,
      category: category,
      created_at: new Date().toISOString()
    };

    store.uploads.unshift(uploadRecord);

    res.json({
      message: 'File uploaded successfully!',
      file: uploadRecord
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all uploaded files metadata (for file explorer / admin)
router.get('/', authenticateToken, (req, res) => {
  res.json(store.uploads);
});

module.exports = router;
