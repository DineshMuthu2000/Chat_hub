const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { authenticateToken } = require('../middleware/auth');
const { supabaseService } = require('../config/supabase');
require('dotenv').config();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Supabase Storage integration — uses the Storage REST API directly so we
// don't depend on the supabase-js Realtime/WebSocket layer (which requires
// Node 22+ or the 'ws' package). Server-side uploads use the SERVICE ROLE
// key, which bypasses Row Level Security.
// ---------------------------------------------------------------------------
const SUPABASE_BUCKET = 'Chat_hub';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseReady = !!(SUPABASE_URL && SERVICE_KEY && SUPABASE_URL.startsWith('http'));

// Upload a local file to Supabase Storage and return its public URL.
// Returns null if Supabase is not configured.
async function uploadToSupabase(localPath, remoteName, contentType) {
  if (!supabaseReady) return null;
  const fileBuffer = fs.readFileSync(localPath);
  const { error } = await supabaseService.storage
    .from(SUPABASE_BUCKET)
    .upload(remoteName, fileBuffer, {
      contentType: contentType || 'application/octet-stream',
      upsert: false
    });
  if (error) {
    // If the object already exists, we still try to get the public URL
    if (!error.message.includes('already exists')) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }
  }
  const { data } = supabaseService.storage.from(SUPABASE_BUCKET).getPublicUrl(remoteName);
  return data.publicUrl;
}

// Multer Storage Configuration — always land on disk first, then push to
// Supabase (or keep local if Supabase is unavailable).
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

// File filter — validates by MIME type AND extension (never extension alone).
// Blocks executables/scripts; allows images, audio, video, PDFs, office docs, txt, zip.
const ALLOWED_MIMES = new Set([
  // images
  'image/jpeg', 'image/pjpeg', 'image/png', 'image/gif', 'image/webp',
  'image/svg+xml', 'image/heic', 'image/heif',
  // video
  'video/mp4', 'video/webm', 'video/x-matroska', 'video/quicktime',
  // audio
  'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/mp4',
  'audio/mp4a-latm', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/aac',
  // documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  // archives
  'application/zip', 'application/x-zip-compressed'
]);

const ALLOWED_EXT = /\.(jpeg|jpg|pjpg|png|gif|webp|svg|heic|heif|mp4|webm|mkv|mov|mp3|m4a|wav|ogg|aac|pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip)$/i;

const fileFilter = (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  // Both the detected MIME type and the extension must be on the allowlist
  if (ALLOWED_MIMES.has(mimetype) && ALLOWED_EXT.test(ext)) {
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
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  let localFilePath = req.file ? req.file.path : null;
  let publicUrl = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const category = getCategoryFromMime(req.file.mimetype, req.file.originalname);

    // Try Supabase Storage first; fall back to local disk path if unavailable
    if (supabaseReady) {
      try {
        publicUrl = await uploadToSupabase(req.file.path, req.file.filename, req.file.mimetype);
      } catch (supaErr) {
        console.warn('Supabase upload failed, falling back to local storage:', supaErr.message);
      }
    }
    // Fallback: local disk relative URL
    const fileUrl = publicUrl || `/uploads/${req.file.filename}`;

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
  } finally {
    // Clean up the local temp file if we successfully uploaded to Supabase
    if (localFilePath && publicUrl) {
      fs.unlink(localFilePath, () => {}); // best-effort cleanup
    }
  }
});

// GET all uploaded files metadata (for file explorer / admin)
router.get('/', authenticateToken, (req, res) => {
  res.json(store.uploads);
});

module.exports = router;
