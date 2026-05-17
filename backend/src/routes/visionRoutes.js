const express = require("express");
const { model } = require("../config/gemini");
const { logger } = require("../utils/logger");

const router = express.Router();

router.post("/math", async (req, res) => {
  const { base64Image } = req.body;

  if (!base64Image) {
    return res.status(400).json({ success: false, error: "base64Image is required" });
  }

  try {
    const prompt = `Extract the content of this image with extremely high fidelity.
If the image contains ONLY a single mathematical formula, return type "math" and the raw LaTeX code.
If the image contains normal text, lists, or a mix of text and formulas, return type "html" and format it as valid HTML.

CRITICAL INSTRUCTIONS FOR HTML OUTPUT:
- You MUST preserve the exact document structure.
- If there are bullet points, you MUST use <ul> and <li> tags. Do NOT just write bullet characters like "•" inside a <p> tag.
- If there are numbered lists, you MUST use <ol> and <li> tags. Do NOT just write "1. text" inside a <p> tag.
- If there are section headings or titles, use <h1>, <h2>, or <h3> tags.
- Use <p>, <strong>, <em> for regular text paragraphs and styling.
- Do NOT use LaTeX for structure (no \\begin{itemize}, etc).
- For ANY mathematical formulas inside the text, wrap the raw LaTeX code exactly like this: <span data-latex="raw_latex_here"></span>
- Do NOT use $, $$, \\[, or \\( for math. ONLY use the <span data-latex="..."></span> format.

Return a valid JSON object with EXACTLY two fields:
{
  "type": "math" | "html",
  "content": "..."
}
Do not include markdown code block formatting like \`\`\`json.`;

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: "image/png"
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    let text = response.text().trim();

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    try {
      const parsed = JSON.parse(text);
      let content = parsed.content;
      if (parsed.type === "math") {
        content = content.replace(/^\s*\$\$?|^\s*\\\[|^\s*\\\(|\$\$?\s*$|\\\]\s*$|\\\)\s*$/g, "").trim();
      }
      return res.json({ success: true, type: parsed.type, content: content });
    } catch (e) {
      // Fallback if model didn't return valid JSON
      logger.error("VisionRoutes", "Failed to parse JSON from model", text);
      let fallbackContent = text.replace(/^\s*\$\$?|^\s*\\\[|^\s*\\\(|\$\$?\s*$|\\\]\s*$|\\\)\s*$/g, "").trim();
      return res.json({ success: true, type: "math", content: fallbackContent });
    }
  } catch (err) {
    logger.error("VisionRoutes", "Vision API error", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
