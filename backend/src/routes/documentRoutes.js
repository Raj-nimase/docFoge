const express = require('express');
const multer = require('multer');
const { parseDocument, uploadAndParseDocument } = require('../controllers/parseController');
const { enqueueExport, getJobStatus, downloadPdf } = require('../controllers/exportController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Require authentication for all document parsing, upload, and export operations
router.use(requireAuth);

// Parse raw text → blocks
router.post('/parse', parseDocument);
router.post('/upload', upload.single('file'), uploadAndParseDocument);

// Export pipeline
router.post('/export',                     enqueueExport);
router.get('/export/:jobId/status',        getJobStatus);
router.get('/export/:jobId/pdf',           downloadPdf);

module.exports = router;
