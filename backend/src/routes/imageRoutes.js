/**
 * imageRoutes.js — POST /api/images/upload
 *
 * Accepts a multipart/form-data request with a single `file` field.
 * Validates type and size, then uploads to Cloudinary via storageService.
 * Returns { success: true, url: "https://res.cloudinary.com/..." }
 */

const express = require('express');
const multer  = require('multer');
const { requireAuth } = require('../middleware/auth');
const { uploadImageBuffer } = require('../services/storageService');

const router = express.Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

router.post(
  '/upload',
  requireAuth,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    try {
      const userId = req.user._id.toString();
      const url = await uploadImageBuffer(userId, req.file.buffer, req.file.mimetype);
      res.json({ success: true, url });
    } catch (err) {
      console.error('[images] upload failed', err.message);
      res.status(500).json({ success: false, error: 'Image upload failed' });
    }
  },
);

module.exports = router;
