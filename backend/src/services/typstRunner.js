/**
 * Typst Runner
 *
 * Wraps Typst compilation in a promise-based interface.
 * Writes .typ to OS temp dir, runs `typst compile`, returns PDF path.
 *
 * Optimisations:
 *  1. Disk-persisted content-hash cache — survives server restarts.
 *     The cache key is sha256(typstSource) so identical documents return
 *     the cached PDF in <50ms instead of spawning Typst again.
 *  2. Single-pass — Typst always compiles in a single pass (no reruns
 *     needed for TOC/cross-refs, unlike LaTeX).
 *  3. Pre-warm — callers can invoke warmUp() at server start so the first
 *     real compile doesn't pay cold-start cost.
 */

const { spawn }  = require('child_process');
const path       = require('path');
const os         = require('os');
const fs         = require('fs');
const crypto     = require('crypto');
const { logger } = require('../utils/logger');

// ── Binary path resolver ──────────────────────────────────────────────────────
function getTypstBinaryPath() {
  const localBinary = path.resolve(
    __dirname, '..', '..',
    process.platform === 'win32' ? 'typst.exe' : 'typst'
  );
  if (fs.existsSync(localBinary)) {
    return localBinary;
  }
  return 'typst';
}

// ── Temp & cache dirs ─────────────────────────────────────────────────────────
const TMP_DIR        = path.join(os.tmpdir(), 'docforge');
const PDF_CACHE_DIR  = path.join(TMP_DIR, '_cache');
const CACHE_INDEX    = path.join(PDF_CACHE_DIR, 'index.json');

// Ensure directories exist at module load
fs.mkdirSync(PDF_CACHE_DIR, { recursive: true });

// ── In-memory index (mirrors the on-disk index for fast lookups) ─────────────
// Maps sha256(typstSource) → absolute path of the cached PDF file
let memCache = new Map();

(function loadCacheIndex() {
  try {
    if (fs.existsSync(CACHE_INDEX)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_INDEX, 'utf8'));
      // Validate each entry — drop any whose PDF has been deleted
      let dirty = false;
      for (const [hash, entry] of Object.entries(raw)) {
        if (fs.existsSync(entry.pdfPath)) {
          memCache.set(hash, entry.pdfPath);
        } else {
          dirty = true;
        }
      }
      if (dirty) persistCacheIndex();
      logger.info('TypstRunner', `Cache index loaded. ${memCache.size} valid entries.`);
    }
  } catch (err) {
    logger.warn?.('TypstRunner', `Failed to load cache index: ${err.message}`);
    memCache = new Map();
  }
})();

function persistCacheIndex() {
  try {
    const obj = {};
    for (const [hash, pdfPath] of memCache.entries()) {
      obj[hash] = { pdfPath };
    }
    fs.writeFileSync(CACHE_INDEX, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    logger.warn?.('TypstRunner', `Failed to persist cache index: ${err.message}`);
  }
}

/**
 * Compile a Typst string to PDF.
 *
 * @param {string} typstSource
 * @param {string} jobId
 * @returns {Promise<{ pdfPath: string, typPath: string|null, logs: string, cached: boolean }>}
 */
async function compileTypst(typstSource, jobId) {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const t0  = Date.now();
  const ts  = (label) => console.log(`[TYPST][${new Date().toISOString()}][+${Date.now() - t0}ms] ${label}`);

  // ── 1. Cache check ────────────────────────────────────────────────────────
  const hashBuilder = crypto.createHash('sha256').update(typstSource);

  // Include hashes of any cert_vector_*.pdf files in TMP_DIR so certificate updates invalidate cache
  try {
    if (fs.existsSync(TMP_DIR)) {
      const files = fs.readdirSync(TMP_DIR);
      for (const file of files) {
        if (file.startsWith('cert_vector_') && file.endsWith('.pdf')) {
          const filePath = path.join(TMP_DIR, file);
          if (fs.existsSync(filePath)) {
            hashBuilder.update(fs.readFileSync(filePath));
          }
        }
      }
    }
  } catch (e) {
    // Ignore read errors
  }

  const hash = hashBuilder.digest('hex');
  const shortHash = hash.slice(0, 8);

  if (memCache.has(hash)) {
    const cachedPath = memCache.get(hash);
    if (fs.existsSync(cachedPath)) {
      ts(`Cache HIT (hash=${shortHash}…). Returning cached PDF instantly.`);
      return { pdfPath: cachedPath, typPath: null, logs: '', cached: true };
    }
    // Stale entry — PDF was deleted externally
    memCache.delete(hash);
    persistCacheIndex();
  }
  ts(`Cache MISS (hash=${shortHash}…). Compiling…`);

  // ── 2. Write .typ ─────────────────────────────────────────────────────────
  const typPath = path.join(TMP_DIR, `${jobId}.typ`);
  const jobPdfPath = path.join(TMP_DIR, `${jobId}.pdf`);
  // The cached copy lives in PDF_CACHE_DIR named by content hash
  const cachedPdfPath = path.join(PDF_CACHE_DIR, `${hash}.pdf`);

  ts(`Writing .typ (${typstSource.length} bytes)`);
  const cleanTypstSource = (typstSource || "")
    .replace(/[\uFFFD]/g, "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  fs.writeFileSync(typPath, cleanTypstSource, 'utf8');
  ts('Write done. Spawning Typst…');

  // ── 3. Run Typst ──────────────────────────────────────────────────────────
  // Typst always compiles in a single pass (no multi-pass needed)
  const logs = await runTypst(typPath, jobPdfPath);

  ts('Typst finished.');

  if (!fs.existsSync(jobPdfPath)) {
    throw new Error(`Typst did not produce a PDF.\nLogs:\n${logs}`);
  }

  // ── 4. Copy to persistent cache dir & update index ────────────────────────
  fs.copyFileSync(jobPdfPath, cachedPdfPath);
  memCache.set(hash, cachedPdfPath);
  persistCacheIndex();

  const elapsed = Date.now() - t0;
  ts(`PDF ready. Cached under hash ${shortHash}…. Total compileTypst time: ${elapsed}ms`);

  return { pdfPath: cachedPdfPath, typPath, logs, cached: false };
}

/**
 * @param {string} typPath  - Path to the .typ input file
 * @param {string} pdfPath  - Path for the output .pdf file
 */
function runTypst(typPath, pdfPath) {
  return new Promise((resolve, reject) => {
    // Typst CLI: typst compile <input.typ> <output.pdf>
    // --root sets the root directory for file access (images etc.)
    const rootDir = path.dirname(typPath);
    const args = [
      'compile',
      '--root', rootDir,
      typPath,
      pdfPath,
    ];

    const binaryPath = getTypstBinaryPath();
    logger.info('TypstRunner', `Spawning: ${binaryPath} ${args.join(' ')}`);

    const proc = spawn(binaryPath, args, { cwd: rootDir });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => {
      stdout += d.toString();
      if (stdout.length > 500000) stdout = stdout.slice(-250000);
    });
    proc.stderr.on('data', d => {
      stderr += d.toString();
      if (stderr.length > 500000) stderr = stderr.slice(-250000);
    });

    proc.on('error', err => {
      reject(new Error(`Failed to spawn typst: ${err.message}`));
    });

    proc.on('close', code => {
      const logs = [stdout, stderr].filter(Boolean).join('\n');
      if (code === 0) {
        resolve(logs);
      } else {
        reject(new Error(`Typst exited with code ${code}.\nLogs:\n${logs}`));
      }
    });
  });
}

/**
 * Pre-warm Typst by compiling a minimal document.
 * This ensures the binary is loaded and the OS file cache is primed.
 */
async function warmUp() {
  const MINIMAL_TYP = `#set page(paper: "a4")
#set text(size: 12pt)
Warm-up compile.
`;

  const warmHash = crypto.createHash('sha256').update(MINIMAL_TYP).digest('hex');

  // Skip if already warmed (cached from a previous run)
  if (memCache.has(warmHash)) {
    logger.info('TypstRunner', 'Warm-up skipped — already cached from previous run.');
    return;
  }

  logger.info('TypstRunner', 'Starting Typst warm-up compile…');
  const t0 = Date.now();
  try {
    await compileTypst(MINIMAL_TYP, `warmup_${Date.now()}`);
    logger.info('TypstRunner', `Warm-up done in ${Date.now() - t0}ms. First real compile will be fast.`);
  } catch (err) {
    // Non-fatal — warm-up failure just means the first real compile takes longer
    logger.warn?.('TypstRunner', `Warm-up failed (non-fatal): ${err.message}`);
  }
}

const MAX_CACHE_SIZE_BYTES = (parseInt(process.env.MAX_PDF_CACHE_MB, 10) || 500) * 1024 * 1024;

/**
 * Clean up temp files for a job (.typ, .pdf, .log, cert_vector_*, and extra image files).
 * Does NOT delete cached PDFs in PDF_CACHE_DIR — those are kept for reuse.
 * @param {string} jobId
 * @param {string[]} [extraFiles] Array of extra filenames or file paths created in TMP_DIR
 */
function cleanupJob(jobId, extraFiles = []) {
  if (!fs.existsSync(TMP_DIR)) return;

  // 1. Standard job compilation files
  for (const ext of ['.typ', '.pdf']) {
    try { fs.unlinkSync(path.join(TMP_DIR, `${jobId}${ext}`)); } catch (_) {}
  }

  // 2. Extra image filenames or file paths specified
  if (Array.isArray(extraFiles)) {
    for (const file of extraFiles) {
      if (!file) continue;
      const targetPath = path.isAbsolute(file) ? file : path.join(TMP_DIR, file);
      try {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      } catch (_) {}
    }
  }

  // 3. Clean any orphan vector PDF files if present
  try {
    const files = fs.readdirSync(TMP_DIR);
    for (const f of files) {
      if (f.startsWith('cert_vector_') && f.endsWith('.pdf')) {
        try { fs.unlinkSync(path.join(TMP_DIR, f)); } catch (_) {}
      }
    }
  } catch (_) {}
}

/**
 * Evict cache entries older than maxAgeMs OR when total size exceeds maxSizeBytes (LRU).
 * Called periodically to prevent unbounded disk growth.
 * @param {number} maxAgeMs  default: 24 hours
 * @param {number} maxSizeBytes default: 500 MB (or MAX_PDF_CACHE_MB env var)
 */
function evictOldCache(maxAgeMs = 24 * 60 * 60 * 1000, maxSizeBytes = MAX_CACHE_SIZE_BYTES) {
  try {
    if (!fs.existsSync(PDF_CACHE_DIR)) return;
    const now = Date.now();
    let evicted = 0;

    const files = fs.readdirSync(PDF_CACHE_DIR)
      .filter(f => f.endsWith('.pdf'))
      .map(file => {
        const filePath = path.join(PDF_CACHE_DIR, file);
        try {
          const { mtimeMs, size } = fs.statSync(filePath);
          return { file, filePath, mtimeMs, size, hash: file.replace('.pdf', '') };
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);

    let totalSize = files.reduce((acc, f) => acc + f.size, 0);

    // 1. Age-based eviction
    for (const f of files) {
      if (now - f.mtimeMs > maxAgeMs) {
        try {
          fs.unlinkSync(f.filePath);
          memCache.delete(f.hash);
          totalSize -= f.size;
          evicted++;
        } catch (_) {}
      }
    }

    // 2. Size-capped LRU eviction if quota is exceeded
    if (totalSize > maxSizeBytes) {
      const remainingFiles = files
        .filter(f => fs.existsSync(f.filePath))
        .sort((a, b) => a.mtimeMs - b.mtimeMs); // oldest first

      const targetSize = maxSizeBytes * 0.8; // Evict down to 80% capacity
      for (const f of remainingFiles) {
        if (totalSize <= targetSize) break;
        try {
          fs.unlinkSync(f.filePath);
          memCache.delete(f.hash);
          totalSize -= f.size;
          evicted++;
        } catch (_) {}
      }
    }

    if (evicted > 0) {
      persistCacheIndex();
      logger.info('TypstRunner', `Cache eviction: removed ${evicted} PDF(s). Current size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
    }
  } catch (err) {
    logger.warn?.('TypstRunner', `Cache eviction error: ${err.message}`);
  }
}

// Run eviction once at startup and then every 6 hours
evictOldCache();
setInterval(() => evictOldCache(), 6 * 60 * 60 * 1000);

module.exports = { compileTypst, cleanupJob, warmUp };
