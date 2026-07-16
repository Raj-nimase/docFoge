const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
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

/**
 * POST /api/documents/upload
 * File: Multipart file under key 'file'
 * Returns: { success, text }
 */
async function uploadAndParseDocument(req, res) {
  let filePath = '';
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    filePath = file.path;
    let extractedText = '';
    const mimeType = file.mimetype;

    logger.info('ParseController', `Extracting text from file: ${file.originalname} (${mimeType})`);

    if (mimeType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      const pdfData = await parser.getText();
      extractedText = pdfData.text;
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.originalname.endsWith('.docx')
    ) {
      const docData = await mammoth.extractRawText({ path: filePath });
      extractedText = docData.value;
    } else if (mimeType === 'text/plain' || file.originalname.endsWith('.txt') || file.originalname.endsWith('.md')) {
      extractedText = fs.readFileSync(filePath, 'utf8');
    } else {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, error: 'Unsupported file format. Please upload PDF, DOCX, or TXT file.' });
    }

    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    logger.info('ParseController', `Successfully extracted ${extractedText.length} characters`);
    return res.json({ success: true, text: extractedText });
  } catch (err) {
    logger.error('ParseController', 'File extraction failed', err.message);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { parseDocument, uploadAndParseDocument };
