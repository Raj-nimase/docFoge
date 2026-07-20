const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Cross-platform tectonic resolution (local tectonic.exe / local tectonic / system fallback)
const localBinary = path.resolve(__dirname, "../../", process.platform === "win32" ? "tectonic.exe" : "tectonic");
const TECTONIC_PATH = fs.existsSync(localBinary) ? localBinary : "tectonic";

/**
 * Compiles a LaTeX string to PDF using Tectonic.
 *
 * @param {string} latexSource  - complete LaTeX document source
 * @param {string} jobId        - unique job identifier (used for tmp folder)
 * @returns {Promise<Buffer>}   - PDF file as a Buffer
 */
async function compileLaTeX(latexSource, jobId) {
  // Create a unique temp directory for this job
  const tmpDir = path.join(os.tmpdir(), `docforge-${jobId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const texFile = path.join(tmpDir, "document.tex");
  const pdfFile = path.join(tmpDir, "document.pdf");

  // Write the LaTeX source
  fs.writeFileSync(texFile, latexSource, "utf8");

  return new Promise((resolve, reject) => {
    // Tectonic flags:
    //   --outdir  → output directory
    //   --keep-logs → keep logs for debugging on error
    //   --print   → print output to stdout
    execFile(
      TECTONIC_PATH,
      ["-Z", "continue-on-errors", "--outdir", tmpDir, "--keep-logs", texFile],
      { cwd: tmpDir, timeout: 120_000 },
      (err, stdout, stderr) => {
        if (err) {
          // Try to read the tectonic log for better error messages
          const logFile = path.join(tmpDir, "document.log");
          let logContent = "";
          try {
            logContent = fs.readFileSync(logFile, "utf8").slice(-3000);
          } catch (_) {}

          // Cleanup
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch (_) {}

          return reject(
            new Error(
              `Tectonic compilation failed.\n\nSTDERR:\n${stderr}\n\nLOG (last 3000 chars):\n${logContent}`
            )
          );
        }

        // Read the generated PDF
        if (!fs.existsSync(pdfFile)) {
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch (_) {}
          return reject(new Error("Tectonic ran successfully but no PDF was generated."));
        }

        const pdfBuffer = fs.readFileSync(pdfFile);

        // Cleanup temp folder
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {}

        resolve(pdfBuffer);
      }
    );
  });
}

module.exports = { compileLaTeX };
