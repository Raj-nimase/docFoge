const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');

/**
 * Clean up files in backend/uploads/ older than maxAgeMs.
 * @param {number} maxAgeMs default: 1 hour (3,600,000 ms)
 */
function cleanUploadsDirectory(maxAgeMs = 60 * 60 * 1000) {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) return;
    const now = Date.now();
    let count = 0;

    const files = fs.readdirSync(UPLOADS_DIR);
    for (const file of files) {
      if (file === '.gitkeep') continue;
      const filePath = path.join(UPLOADS_DIR, file);
      try {
        const { mtimeMs } = fs.statSync(filePath);
        if (now - mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          count++;
        }
      } catch (_) {}
    }

    if (count > 0) {
      logger.info('FileCleanup', `Cleaned ${count} orphan upload file(s) from uploads/`);
    }
  } catch (err) {
    logger.warn?.('FileCleanup', `Uploads cleanup error: ${err.message}`);
  }
}

/**
 * Start periodic uploads directory cleanup scheduler.
 * @param {number} intervalMs default: every 30 minutes
 */
function startUploadsCleanupScheduler(intervalMs = 30 * 60 * 1000) {
  cleanUploadsDirectory();
  setInterval(() => cleanUploadsDirectory(), intervalMs);
}

module.exports = { cleanUploadsDirectory, startUploadsCleanupScheduler };
