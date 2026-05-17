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
const { compileTex, cleanupJob } = require("../services/tectonicRunner");
const { TEMPLATES } = require("../data/templates");
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

  const response = { success: true, status: job.status };
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

  try {
    // ── DEBUG: Dump incoming chapter content to see if bold marks exist ──
    if (project.chapters && project.chapters.length > 0) {
      for (const ch of project.chapters) {
        console.log(`\n===== DEBUG: Chapter "${ch.title}" raw content =====`);
        console.log(JSON.stringify(ch.content, null, 2));
        // Specifically look for any marks
        const findMarks = (node) => {
          if (!node) return;
          if (node.marks && node.marks.length > 0) {
            console.log(`  FOUND MARKS on text "${node.text}":`, JSON.stringify(node.marks));
          }
          if (node.content) node.content.forEach(findMarks);
        };
        if (ch.content) findMarks(ch.content);
      }
    }

    const { latex, images, safe, reason } = generateProjectLatex(project, jobId);
    if (!safe) throw new Error(`LaTeX safety check failed: ${reason}`);

    // Save images to disk so tectonic can find them
    const tmpDir = path.join(os.tmpdir(), "docforge");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    if (images && images.length > 0) {
      for (const img of images) {
        const imgPath = path.join(tmpDir, img.filename);
        fs.writeFileSync(imgPath, img.base64, "base64");
        logger.info("CompileRoute", `Saved image: ${imgPath}`);
      }
    }

    // ── DEBUG: Show generated LaTeX to verify \textbf appears ──
    console.log(`\n===== DEBUG: Generated LaTeX (first 80 lines) =====`);
    console.log(latex.split("\n").slice(0, 80).join("\n"));
    console.log(`===== END DEBUG =====\n`);

    // Log generated LaTeX for debugging (first 60 lines)
    const preview = latex.split("\n").slice(0, 60).join("\n");
    logger.info("CompileRoute", `LaTeX preview:\n${preview}`);

    const { pdfPath } = await compileTex(latex, jobId);

    job.status = "done";
    job.pdfPath = pdfPath;
    job.updatedAt = Date.now();
    logger.info("CompileRoute", `Job done: ${jobId}`);
  } catch (err) {
    job.status = "failed";
    job.error = err.message;
    job.updatedAt = Date.now();
    logger.error("CompileRoute", `Job failed: ${jobId}`, err.message);
  }
}

module.exports = router;
