const { parseRawText } = require('../services/parserService');
const { logger } = require('../utils/logger');

/**
 * POST /api/documents/parse
 * Body: { rawText: string }
 * Returns: { success, blocks, hasLowConfidence }
 */
async function parseDocument(req, res) {
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ success: false, error: 'rawText is required and must be a string' });
    }
    if (rawText.length > 100_000) {
      return res.status(400).json({ success: false, error: 'rawText exceeds 100,000 character limit' });
    }

    logger.info('ParseController', `Parsing ${rawText.length} chars`);
    const { blocks, hasLowConfidence } = parseRawText(rawText);
    logger.info('ParseController', `Parsed → ${blocks.length} blocks, lowConf=${hasLowConfidence}`);

    return res.json({ success: true, blocks, hasLowConfidence });
  } catch (err) {
    logger.error('ParseController', 'Parse failed', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { parseDocument };
