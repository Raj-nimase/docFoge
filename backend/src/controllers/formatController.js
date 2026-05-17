const { formatSectionWithAI } = require("../services/geminiService");

/**
 * POST /api/format/section
 *
 * Body (JSON):
 * {
 *   "sectionType": "acknowledgement" | "abstract" | "introduction" | "conclusion" | "custom",
 *   "rawText": "...user's raw text...",
 *   "title": "Optional custom section title"   // only for 'custom' type
 * }
 *
 * Response (JSON):
 * {
 *   "success": true,
 *   "sectionType": "...",
 *   "latexBody": "...formatted LaTeX..."
 * }
 */
async function formatSection(req, res) {
  const { sectionType, rawText, title } = req.body;

  if (!sectionType || !rawText) {
    return res.status(400).json({
      success: false,
      error: "sectionType and rawText are required.",
    });
  }

  const validTypes = [
    "acknowledgement",
    "abstract",
    "introduction",
    "conclusion",
    "custom",
  ];
  if (!validTypes.includes(sectionType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid sectionType. Must be one of: ${validTypes.join(", ")}`,
    });
  }

  if (rawText.trim().length < 10) {
    return res.status(400).json({
      success: false,
      error: "rawText is too short. Please provide meaningful content.",
    });
  }

  try {
    const latexBody = await formatSectionWithAI(sectionType, rawText, title);
    return res.status(200).json({
      success: true,
      sectionType,
      latexBody,
    });
  } catch (err) {
    console.error("[formatSection] Gemini error:", err.message);
    return res.status(500).json({
      success: false,
      error: "AI formatting failed. " + err.message,
    });
  }
}

module.exports = { formatSection };
