const { compileLaTeX } = require("../services/tectonicService");
const { assembleDocument } = require("../utils/latexAssembler");
const { v4: uuidv4 } = require("uuid");

/**
 * POST /api/compile
 *
 * Assembles a full document from pre-formatted section LaTeX bodies
 * and compiles it with Tectonic. Returns the PDF as a binary stream.
 *
 * Body (JSON):
 * {
 *   "meta": {
 *     "projectTitle": "...",
 *     "collegeName": "...",
 *     "department": "...",
 *     "authors": ["Name1", "Name2"],
 *     "guide": "Prof. ...",
 *     "year": 2025
 *   },
 *   "sections": [
 *     { "latexBody": "...latex for acknowledgement..." },
 *     { "latexBody": "...latex for abstract..." },
 *     ...
 *   ]
 * }
 *
 * Response: PDF binary (application/pdf)
 */
async function compileDocument(req, res) {
  const { meta = {}, sections = [] } = req.body;

  if (!Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({
      success: false,
      error: "sections array is required and must not be empty.",
    });
  }

  // Validate each section has a latexBody
  for (let i = 0; i < sections.length; i++) {
    if (!sections[i].latexBody || typeof sections[i].latexBody !== "string") {
      return res.status(400).json({
        success: false,
        error: `sections[${i}].latexBody is missing or not a string.`,
      });
    }
  }

  const jobId = uuidv4();

  try {
    const latexSource = assembleDocument(sections, meta);
    console.log(`[compileDocument] Job ${jobId} — compiling document...`);

    const pdfBuffer = await compileLaTeX(latexSource, jobId);

    console.log(
      `[compileDocument] Job ${jobId} — success (${pdfBuffer.length} bytes)`
    );

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="document-${jobId}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error(`[compileDocument] Job ${jobId} — error:`, err.message);
    return res.status(500).json({
      success: false,
      error: "LaTeX compilation failed. " + err.message,
    });
  }
}

/**
 * POST /api/compile/preview
 *
 * Convenience endpoint that returns the assembled LaTeX source as plain text
 * (for frontend previewing/editing before compilation).
 */
async function previewLatex(req, res) {
  const { meta = {}, sections = [] } = req.body;

  if (!Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({
      success: false,
      error: "sections array is required and must not be empty.",
    });
  }

  try {
    const latexSource = assembleDocument(sections, meta);
    return res.status(200).json({
      success: true,
      latexSource,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Assembly failed. " + err.message,
    });
  }
}

module.exports = { compileDocument, previewLatex };
