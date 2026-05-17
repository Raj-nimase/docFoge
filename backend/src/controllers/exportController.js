const { v4: uuidv4 } = require('uuid');
const { enqueueJob, getJob, removeJob } = require('../services/exportQueue');
const { logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * POST /api/documents/export
 * Body: { title, blocks, template }
 * Returns: { success, jobId } with 202 Accepted
 */
async function enqueueExport(req, res) {
  try {
    const { title, blocks, template = 'default' } = req.body;

    if (!Array.isArray(blocks) || blocks.length === 0) {
      return res.status(400).json({ success: false, error: 'blocks must be a non-empty array' });
    }

    const validTemplates = ['default', 'academic', 'report', 'resume'];
    if (!validTemplates.includes(template)) {
      return res.status(400).json({ success: false, error: `Invalid template: ${template}` });
    }

    const jobId = uuidv4();
    enqueueJob(jobId, { title: title || 'Untitled Document', blocks, template });

    logger.info('ExportController', `Enqueued export job ${jobId}, template=${template}`);
    return res.status(202).json({ success: true, jobId });
  } catch (err) {
    logger.error('ExportController', 'Enqueue failed', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/documents/export/:jobId/status
 * Returns: { status, pdfUrl?, error? }
 */
async function getJobStatus(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  const response = { success: true, status: job.status };
  if (job.status === 'done') {
    response.pdfUrl = `/api/documents/export/${jobId}/pdf`;
  }
  if (job.status === 'failed') {
    response.error = job.error;
  }

  return res.json(response);
}

/**
 * GET /api/documents/export/:jobId/pdf
 * Streams the compiled PDF.
 */
async function downloadPdf(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  if (job.status !== 'done') return res.status(409).json({ success: false, error: `Job is ${job.status}` });
  if (!job.pdfPath || !fs.existsSync(job.pdfPath)) {
    return res.status(500).json({ success: false, error: 'PDF file not found on disk' });
  }

  const filename = encodeURIComponent((job.data?.title || 'document').replace(/[^a-z0-9 ]/gi, '_'));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);

  const stream = fs.createReadStream(job.pdfPath);
  stream.pipe(res);

  stream.on('end', () => {
    // Give client a moment then clean up
    setTimeout(() => removeJob(jobId), 30_000);
  });
  stream.on('error', (err) => {
    logger.error('ExportController', 'PDF stream error', err.message);
    res.end();
  });
}

module.exports = { enqueueExport, getJobStatus, downloadPdf };
