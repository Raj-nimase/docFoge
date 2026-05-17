/**
 * Tectonic Runner
 *
 * Wraps tectonic.exe compilation in a promise-based interface.
 * Writes .tex to OS temp dir, runs tectonic, returns PDF path.
 * Caller is responsible for cleanup.
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { logger } = require('../utils/logger');

// Cross-platform tectonic resolution (local tectonic.exe / local tectonic / system fallback)
const localBinary = path.resolve(__dirname, '..', '..', process.platform === 'win32' ? 'tectonic.exe' : 'tectonic');
const TECTONIC_PATH = fs.existsSync(localBinary) ? localBinary : 'tectonic';

/**
 * Compile a LaTeX string to PDF using Tectonic.
 *
 * @param {string} latexSource
 * @param {string} jobId
 * @returns {Promise<{ pdfPath: string, texPath: string, logs: string }>}
 */
async function compileTex(latexSource, jobId) {
  const tmpDir = path.join(os.tmpdir(), 'docforge');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const texPath = path.join(tmpDir, `${jobId}.tex`);
  const pdfPath = path.join(tmpDir, `${jobId}.pdf`);

  // Write .tex file
  fs.writeFileSync(texPath, latexSource, 'utf8');
  logger.info('TectonicRunner', `Wrote .tex: ${texPath}`);

  const logs = await runTectonic(texPath, tmpDir);

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`Tectonic did not produce a PDF.\nLogs:\n${logs}`);
  }

  logger.info('TectonicRunner', `PDF ready: ${pdfPath}`);
  return { pdfPath, texPath, logs };
}

function runTectonic(texPath, outDir) {
  return new Promise((resolve, reject) => {
    const args = [
      '--outdir', outDir,
      '--keep-logs',
      texPath,
    ];

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
 * Clean up temp files for a job.
 * @param {string} jobId
 */
function cleanupJob(jobId) {
  const tmpDir = path.join(os.tmpdir(), 'docforge');
  if (!fs.existsSync(tmpDir)) return;
  
  const files = fs.readdirSync(tmpDir);
  for (const file of files) {
    if (file.startsWith(jobId)) {
      try {
        fs.unlinkSync(path.join(tmpDir, file));
      } catch (_) {}
    }
  }
}

module.exports = { compileTex, cleanupJob };
