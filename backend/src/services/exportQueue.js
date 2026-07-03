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
  job.startTime = Date.now();
  logger.info('ExportQueue', `Processing job: ${jobId}`);

  const t0 = Date.now();
  const ts = () => `[BACKEND][${new Date().toISOString()}][+${Date.now() - t0}ms]`;
  console.log(`${ts()} ── processJob START jobId=${jobId}`);

  try {
    const { title, blocks, template } = job.data;
    console.log(`${ts()} Input data: title="${title}", blocksCount=${blocks.length}, template="${template}"`);

    // Validate blocks
    console.log(`${ts()} Step 1: Validating blocks...`);
    const validation = validateBlocks(blocks);
    if (!validation.valid) {
      throw new Error(`Block validation failed: ${validation.errors.join('; ')}`);
    }
    console.log(`${ts()} Step 1 done. Blocks valid.`);

    // Generate LaTeX
    console.log(`${ts()} Step 2: Generating LaTeX...`);
    const { latex, safe, reason } = generateLatex(title, validation.blocks, template);
    console.log(`${ts()} Step 2 done. safe=${safe} latexBytes=${latex.length}`);
    if (!safe) throw new Error(`LaTeX safety check failed: ${reason}`);

    // Compile
    console.log(`${ts()} Step 3: Compiling LaTeX to PDF...`);
    const { pdfPath, cached } = await compileTex(latex, jobId);
    console.log(`${ts()} Step 3 done. PDF at ${pdfPath}, cached=${cached}`);

    job.status = 'done';
    job.pdfPath = pdfPath;
    job.updatedAt = Date.now();
    job.durationMs = Date.now() - job.startTime;
    console.log(`
===================================================
[BACKEND SUCCESS] PDF Export Completed!
Job ID: ${jobId}
Total Backend Time: ${job.durationMs}ms (${(job.durationMs / 1000).toFixed(2)}s)
===================================================
`);
    logger.info('ExportQueue', `Job done: ${jobId} → ${pdfPath}`);
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    job.updatedAt = Date.now();
    job.durationMs = Date.now() - job.startTime;
    console.log(`
===================================================
[BACKEND FAILED] PDF Export Failed!
Job ID: ${jobId}
Error: ${err.message}
Total Backend Time: ${job.durationMs}ms (${(job.durationMs / 1000).toFixed(2)}s)
===================================================
`);
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
