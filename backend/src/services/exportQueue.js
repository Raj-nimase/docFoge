/**
 * In-Memory Export Queue
 *
 * Implements the same interface as a BullMQ queue but runs jobs
 * asynchronously in-process. Can be swapped for BullMQ + Redis later
 * by replacing this module — all callers stay the same.
 *
 * Job lifecycle: pending → processing → done | failed
 */

const { generateLatex } = require('./latexGenerator');
const { compileTex, cleanupJob } = require('./tectonicRunner');
const { validateBlocks } = require('../utils/blockSchema');
const { logger } = require('../utils/logger');
const path = require('path');
const os = require('os');

// Map<jobId, Job>
const jobs = new Map();

/**
 * @typedef {{
 *   jobId: string,
 *   status: 'pending'|'processing'|'done'|'failed',
 *   pdfPath?: string,
 *   error?: string,
 *   createdAt: number,
 *   updatedAt: number,
 * }} Job
 */

/**
 * Enqueue a new export job.
 * @param {string} jobId
 * @param {{ title: string, blocks: Block[], template: string }} data
 */
function enqueueJob(jobId, data) {
  const job = {
    jobId,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    data,
  };
  jobs.set(jobId, job);

  // Start processing asynchronously (non-blocking)
  setImmediate(() => processJob(jobId));

  logger.info('ExportQueue', `Job enqueued: ${jobId}`);
}

async function processJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'processing';
  job.updatedAt = Date.now();
  logger.info('ExportQueue', `Processing job: ${jobId}`);

  try {
    const { title, blocks, template } = job.data;

    // Validate blocks
    const validation = validateBlocks(blocks);
    if (!validation.valid) {
      throw new Error(`Block validation failed: ${validation.errors.join('; ')}`);
    }

    // Generate LaTeX
    const { latex, safe, reason } = generateLatex(title, validation.blocks, template);
    if (!safe) throw new Error(`LaTeX safety check failed: ${reason}`);

    // Compile
    const { pdfPath } = await compileTex(latex, jobId);

    job.status = 'done';
    job.pdfPath = pdfPath;
    job.updatedAt = Date.now();
    logger.info('ExportQueue', `Job done: ${jobId} → ${pdfPath}`);
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    job.updatedAt = Date.now();
    logger.error('ExportQueue', `Job failed: ${jobId}`, err.message);
  }
}

/**
 * Get the current status of a job.
 * @param {string} jobId
 * @returns {Job|null}
 */
function getJob(jobId) {
  return jobs.get(jobId) || null;
}

/**
 * Clean up a completed/failed job and its temp files.
 * @param {string} jobId
 */
function removeJob(jobId) {
  cleanupJob(jobId);
  jobs.delete(jobId);
}

// Auto-cleanup jobs older than 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.updatedAt < cutoff && (job.status === 'done' || job.status === 'failed')) {
      removeJob(id);
    }
  }
}, 5 * 60 * 1000);

module.exports = { enqueueJob, getJob, removeJob };
