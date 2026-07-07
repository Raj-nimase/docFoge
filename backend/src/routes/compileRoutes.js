/**
 * AcaDoc Compile Route
 *
 * POST /api/compile       — accepts { project }, returns { jobId }
 * GET  /api/compile/:id/status — job status
 * GET  /api/compile/:id/pdf    — stream PDF
 */

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { generateProjectLatex } = require("../services/latexGenerator");
const { compileTex, cleanupJob, warmUp } = require("../services/tectonicRunner");
const { logger } = require("../utils/logger");
const path = require("path");
const os = require("os");
const fs = require("fs");

const router = express.Router();

// In-memory job store (same pattern as exportQueue)
const jobs = new Map();

// Auto-cleanup jobs older than 30 min
setInterval(
  () => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, job] of jobs.entries()) {
      if (job.updatedAt < cutoff) {
        cleanupJob(id);
        jobs.delete(id);
      }
    }
  },
  5 * 60 * 1000,
);

// ─── POST /api/compile ────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { project } = req.body;

  if (!project) {
    return res
      .status(400)
      .json({ success: false, error: "`project` object is required" });
  }

  const jobId = uuidv4();
  jobs.set(jobId, {
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Process asynchronously
  setImmediate(() => processCompile(jobId, project));

  logger.info("CompileRoute", `Enqueued compile job ${jobId}`);
  return res.status(202).json({ success: true, jobId });
});

// ─── GET /api/compile/:id/status ─────────────────────────────────────────────
router.get("/:jobId/status", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job)
    return res.status(404).json({ success: false, error: "Job not found" });

  const response = { 
    success: true, 
    status: job.status,
    durationMs: job.durationMs || null
  };
  if (job.status === "failed") response.error = job.error;
  return res.json(response);
});

// ─── GET /api/compile/:id/pdf ─────────────────────────────────────────────────
router.get("/:jobId/pdf", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job)
    return res.status(404).json({ success: false, error: "Job not found" });
  if (job.status !== "done")
    return res
      .status(409)
      .json({ success: false, error: `Job is ${job.status}` });
  if (!job.pdfPath || !fs.existsSync(job.pdfPath)) {
    return res
      .status(500)
      .json({ success: false, error: "PDF not found on disk" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="document.pdf"');
  const stream = fs.createReadStream(job.pdfPath);
  stream.pipe(res);
  stream.on("end", () =>
    setTimeout(() => {
      cleanupJob(req.params.jobId);
      jobs.delete(req.params.jobId);
    }, 30_000),
  );
  stream.on("error", () => res.end());
});

// ─── POST /api/compile/preview-tex (debug: return raw LaTeX) ─────────────────
router.post("/preview-tex", (req, res) => {
  const { project } = req.body;
  if (!project)
    return res.status(400).json({ success: false, error: "project required" });
  try {
    const { latex } = generateProjectLatex(project);
    res.setHeader("Content-Type", "text/plain");
    res.send(latex);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Processing ───────────────────────────────────────────────────────────────
async function processCompile(jobId, project) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "processing";
  job.updatedAt = Date.now();
  job.startTime = Date.now();

  const t0 = Date.now();
  const ts = () => `[BACKEND][${new Date().toISOString()}][+${Date.now() - t0}ms]`;
  console.log(`${ts()} ── processCompile START jobId=${jobId}`);

  try {
    // ── Step A: LaTeX generation ──────────────────────────────────────────────
    console.log(`${ts()} Step A: Generating LaTeX...`);
    // Use a stable imagePrefix derived from project content — NOT jobId.
    // jobId changes on every compile, which makes every LaTeX source unique
    // and defeats the content-hash PDF cache in tectonicRunner.
    const imagePrefix = project.id ?? jobId;
    const { latex, images, safe, reason } = generateProjectLatex(project, imagePrefix);
    console.log(`${ts()} Step A done. safe=${safe} latexBytes=${latex.length} images=${images?.length ?? 0}`);
    if (!safe) throw new Error(`LaTeX safety check failed: ${reason}`);

    // ── Step B: Write temp dir & save images ─────────────────────────────────
    const tmpDir = path.join(os.tmpdir(), "docforge");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    if (images && images.length > 0) {
      console.log(`${ts()} Step B: Saving ${images.length} image(s)...`);
      for (const img of images) {
        const imgPath = path.join(tmpDir, img.filename);
        if (img.base64) {
          fs.writeFileSync(imgPath, img.base64, "base64");
          console.log(`${ts()} Step B: Saved base64 image: ${img.filename}`);
        } else if (img.url) {
          try {
            console.log(`${ts()} Step B: Fetching remote image: ${img.url}`);
            const response = await fetch(img.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            fs.writeFileSync(imgPath, Buffer.from(arrayBuffer));
            console.log(`${ts()} Step B: Downloaded remote image: ${img.filename}`);
          } catch (fetchErr) {
            console.log(`${ts()} Step B: FAILED to download ${img.url}: ${fetchErr.message}`);
            logger.error("CompileRoute", `Failed to download ${img.url}`, fetchErr.message);
          }
        }
      }
      console.log(`${ts()} Step B done.`);
    }

    // ── Step C: Run Tectonic ──────────────────────────────────────────────────
    console.log(`${ts()} Step C: Starting Tectonic compilation...`);
    const { pdfPath, cached } = await compileTex(latex, jobId);
    console.log(`${ts()} Step C done. PDF at ${pdfPath} (cached=${cached})`);

    job.status = "done";
    job.pdfPath = pdfPath;
    job.cached  = cached;
    job.updatedAt = Date.now();
    job.durationMs = Date.now() - job.startTime;
    console.log(`
===================================================
[BACKEND SUCCESS] PDF Generation Completed!
Job ID    : ${jobId}
Cache hit : ${cached}
Total Time: ${job.durationMs}ms (${(job.durationMs / 1000).toFixed(2)}s)
===================================================
`);
    logger.info("CompileRoute", `Job done: ${jobId}`);
  } catch (err) {
    job.status = "failed";
    job.error = err.message;
    job.updatedAt = Date.now();
    job.durationMs = Date.now() - job.startTime;
    console.log(`
===================================================
[BACKEND FAILED] PDF Generation Failed!
Job ID: ${jobId}
Error: ${err.message}
Total Backend Time: ${job.durationMs}ms (${(job.durationMs / 1000).toFixed(2)}s)
===================================================
`);
    logger.error("CompileRoute", `Job failed: ${jobId}`, err.message);
  }
}

module.exports = router;
module.exports.warmUp = warmUp;
