/**
 * Tectonic Runner
 *
 * Wraps tectonic.exe compilation in a promise-based interface.
 * Writes .tex to OS temp dir, runs tectonic, returns PDF path.
 *
 * Optimisations:
 *  1. Disk-persisted content-hash cache — survives server restarts.
 *     The cache key is sha256(latexSource) so identical documents return
 *     the cached PDF in <50ms instead of spawning Tectonic again.
 *  2. Smart pass selection — documents without TOC/cross-refs use
 *     --reruns 0 (1 pass, ~40% faster). Documents with \tableofcontents,
 *     \listoffigures, \ref, or \cite get --reruns 1 (2 passes).
 *  3. --only-cached — prevents Tectonic from hitting the network for
 *     packages. Falls back to network only if a package is genuinely missing.
 *  4. --format latex — forces pdflatex engine (2-3x faster than XeTeX).
 *  5. Pre-warm export — callers can invoke warmUp() at server start so
 *     the first real compile doesn't pay cold-start cost.
 */

const { spawn }  = require('child_process');
const path       = require('path');
const os         = require('os');
const fs         = require('fs');
const crypto     = require('crypto');
const { logger } = require('../utils/logger');

// ── Binary path ────────────────────────────────────────────────────────────────
const localBinary = path.resolve(
  __dirname, '..', '..',
  process.platform === 'win32' ? 'tectonic.exe' : 'tectonic'
);
const TECTONIC_PATH = fs.existsSync(localBinary) ? localBinary : 'tectonic';

// ── Temp & cache dirs ─────────────────────────────────────────────────────────
const TMP_DIR        = path.join(os.tmpdir(), 'docforge');
const PDF_CACHE_DIR  = path.join(TMP_DIR, '_cache');
const CACHE_INDEX    = path.join(PDF_CACHE_DIR, 'index.json');

// Ensure directories exist at module load
fs.mkdirSync(PDF_CACHE_DIR, { recursive: true });

// ── In-memory index (mirrors the on-disk index for fast lookups) ─────────────
// Maps sha256(latexSource) → absolute path of the cached PDF file
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
      logger.info('TectonicRunner', `Cache index loaded. ${memCache.size} valid entries.`);
    }
  } catch (err) {
    logger.warn?.('TectonicRunner', `Failed to load cache index: ${err.message}`);
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
    logger.warn?.('TectonicRunner', `Failed to persist cache index: ${err.message}`);
  }
}

// ── Pass-count heuristic ──────────────────────────────────────────────────────
// Returns true if the LaTeX source needs a second pass (TOC, cross-refs, etc.)
const MULTI_PASS_TRIGGERS = [
  '\\tableofcontents',
  '\\listoffigures',
  '\\listoftables',
  '\\ref{',
  '\\cite{',
  '\\label{',
];

function needsMultiPass(latexSource) {
  return MULTI_PASS_TRIGGERS.some(trigger => latexSource.includes(trigger));
}

/**
 * Compile a LaTeX string to PDF using Tectonic.
 *
 * @param {string} latexSource
 * @param {string} jobId
 * @returns {Promise<{ pdfPath: string, texPath: string|null, logs: string, cached: boolean }>}
 */
async function compileTex(latexSource, jobId) {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const t0  = Date.now();
  const ts  = (label) => console.log(`[TECTONIC][${new Date().toISOString()}][+${Date.now() - t0}ms] ${label}`);

  // ── 1. Cache check ────────────────────────────────────────────────────────
  const hash = crypto.createHash('sha256').update(latexSource).digest('hex');
  const shortHash = hash.slice(0, 8);

  if (memCache.has(hash)) {
    const cachedPath = memCache.get(hash);
    if (fs.existsSync(cachedPath)) {
      ts(`Cache HIT (hash=${shortHash}…). Returning cached PDF instantly.`);
      return { pdfPath: cachedPath, texPath: null, logs: '', cached: true };
    }
    // Stale entry — PDF was deleted externally
    memCache.delete(hash);
    persistCacheIndex();
  }
  ts(`Cache MISS (hash=${shortHash}…). Compiling…`);

  // ── 2. Write .tex ─────────────────────────────────────────────────────────
  const texPath = path.join(TMP_DIR, `${jobId}.tex`);
  // The output PDF will land in TMP_DIR as <jobId>.pdf
  const jobPdfPath = path.join(TMP_DIR, `${jobId}.pdf`);
  // The cached copy lives in PDF_CACHE_DIR named by content hash
  const cachedPdfPath = path.join(PDF_CACHE_DIR, `${hash}.pdf`);

  ts(`Writing .tex (${latexSource.length} bytes)`);
  fs.writeFileSync(texPath, latexSource, 'utf8');
  ts('Write done. Spawning Tectonic…');

  // ── 3. Determine pass count ───────────────────────────────────────────────
  const multiPass = needsMultiPass(latexSource);
  ts(`Pass mode: ${multiPass ? '2-pass (TOC/refs detected)' : '1-pass (simple document)'}`);

  // ── 4. Run Tectonic ───────────────────────────────────────────────────────
  let logs;
  try {
    logs = await runTectonic(texPath, TMP_DIR, { multiPass, allowNetwork: false });
  } catch (err) {
    if (err.message.includes('not available') || err.message.includes('not cached')) {
      ts('Package not cached — retrying with network access…');
      logs = await runTectonic(texPath, TMP_DIR, { multiPass, allowNetwork: true });
    } else {
      throw err;
    }
  }

  ts('Tectonic finished.');

  if (!fs.existsSync(jobPdfPath)) {
    throw new Error(`Tectonic did not produce a PDF.\nLogs:\n${logs}`);
  }

  // ── 5. Copy to persistent cache dir & update index ────────────────────────
  fs.copyFileSync(jobPdfPath, cachedPdfPath);
  memCache.set(hash, cachedPdfPath);
  persistCacheIndex();

  const elapsed = Date.now() - t0;
  ts(`PDF ready. Cached under hash ${shortHash}…. Total compileTex time: ${elapsed}ms`);

  return { pdfPath: cachedPdfPath, texPath, logs, cached: false };
}

/**
 * @param {string} texPath
 * @param {string} outDir
 * @param {{ multiPass?: boolean, allowNetwork?: boolean }} opts
 */
function runTectonic(texPath, outDir, { multiPass = true, allowNetwork = false } = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      '--outdir', outDir,
      '--reruns', multiPass ? '1' : '0',  // 0 = 1 pass, 1 = 2 passes
      '--format', 'latex',                // pdflatex engine (faster than XeTeX)
    ];

    if (!allowNetwork) {
      args.push('--only-cached');
    }

    args.push(texPath);

    logger.info('TectonicRunner', `Spawning: ${TECTONIC_PATH} ${args.join(' ')}`);

    const proc = spawn(TECTONIC_PATH, args, { cwd: outDir });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('error', err => {
      reject(new Error(`Failed to spawn tectonic: ${err.message}`));
    });

    proc.on('close', code => {
      const logs = [stdout, stderr].filter(Boolean).join('\n');
      if (code === 0) {
        resolve(logs);
      } else {
        reject(new Error(`Tectonic exited with code ${code}.\nLogs:\n${logs}`));
      }
    });
  });
}

/**
 * Pre-warm Tectonic by compiling a minimal document that uses the same
 * document class and packages as real documents. This initialises the
 * Tectonic format cache and loads all packages into the OS file cache
 * so the first real user compile doesn't pay cold-start cost.
 */
async function warmUp() {
  // Mirrors the preamble from latexGenerator.js buildPreamble() for the
  // diploma-project-report template (most common, uses the full package set)
  const MINIMAL_TEX = `\\documentclass[12pt,a4paper]{report}
\\usepackage{amsmath, amssymb, amsfonts}
\\usepackage[a4paper,top=2.5cm,bottom=2.5cm,left=3.5cm,right=1.25cm]{geometry}
\\usepackage{setspace}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{array}
\\usepackage{longtable}
\\usepackage{verbatim}
\\usepackage{tabularx}
\\usepackage{listings}
\\usepackage{xcolor}
\\usepackage[framemethod=default]{mdframed}
\\usepackage[normalem]{ulem}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{fancyhdr}
\\begin{document}
Warm-up compile.
\\end{document}
`;

  const warmHash = crypto.createHash('sha256').update(MINIMAL_TEX).digest('hex');

  // Skip if already warmed (cached from a previous run)
  if (memCache.has(warmHash)) {
    logger.info('TectonicRunner', 'Warm-up skipped — already cached from previous run.');
    return;
  }

  logger.info('TectonicRunner', 'Starting Tectonic warm-up compile…');
  const t0 = Date.now();
  try {
    await compileTex(MINIMAL_TEX, `warmup_${Date.now()}`);
    logger.info('TectonicRunner', `Warm-up done in ${Date.now() - t0}ms. First real compile will be fast.`);
  } catch (err) {
    // Non-fatal — warm-up failure just means the first real compile takes longer
    logger.warn?.('TectonicRunner', `Warm-up failed (non-fatal): ${err.message}`);
  }
}

/**
 * Clean up temp files for a job (the .tex and the job-specific .pdf).
 * Does NOT delete cached PDFs in PDF_CACHE_DIR — those are kept for reuse.
 * @param {string} jobId
 */
function cleanupJob(jobId) {
  if (!fs.existsSync(TMP_DIR)) return;
  for (const ext of ['.tex', '.pdf', '.log', '.aux']) {
    try { fs.unlinkSync(path.join(TMP_DIR, `${jobId}${ext}`)); } catch (_) {}
  }
}

/**
 * Evict cache entries older than maxAgeMs and clean up their PDF files.
 * Called periodically to prevent unbounded disk growth.
 * @param {number} maxAgeMs  default: 24 hours
 */
function evictOldCache(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    if (!fs.existsSync(PDF_CACHE_DIR)) return;
    const now = Date.now();
    let evicted = 0;
    for (const file of fs.readdirSync(PDF_CACHE_DIR)) {
      if (!file.endsWith('.pdf')) continue;
      const filePath = path.join(PDF_CACHE_DIR, file);
      try {
        const { mtimeMs } = fs.statSync(filePath);
        if (now - mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          const hash = file.replace('.pdf', '');
          memCache.delete(hash);
          evicted++;
        }
      } catch (_) {}
    }
    if (evicted > 0) {
      persistCacheIndex();
      logger.info('TectonicRunner', `Cache eviction: removed ${evicted} old PDF(s).`);
    }
  } catch (err) {
    logger.warn?.('TectonicRunner', `Cache eviction error: ${err.message}`);
  }
}

// Run eviction once at startup and then every 6 hours
evictOldCache();
setInterval(() => evictOldCache(), 6 * 60 * 60 * 1000);

module.exports = { compileTex, cleanupJob, warmUp };
