const express = require('express');
const { parseDocument } = require('../controllers/parseController');
const { enqueueExport, getJobStatus, downloadPdf } = require('../controllers/exportController');

const router = express.Router();

// Parse raw text → blocks
router.post('/parse', parseDocument);

// Export pipeline
router.post('/export',                     enqueueExport);
router.get('/export/:jobId/status',        getJobStatus);
router.get('/export/:jobId/pdf',           downloadPdf);

module.exports = router;
