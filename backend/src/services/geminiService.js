const { model } = require("../config/gemini");
const { buildPrompt } = require("../prompts/sectionPrompts");

/**
 * Calls Gemini to convert raw text into formatted LaTeX for a given section.
 *
 * @param {string} sectionType  - 'acknowledgement' | 'abstract' | 'introduction' | 'conclusion' | 'custom'
 * @param {string} rawText      - user's raw unformatted text
 * @param {string} [title]      - for custom sections, the section heading
 * @returns {Promise<string>}   - LaTeX body string
 */
async function formatSectionWithAI(sectionType, rawText, title = "") {
  const prompt = buildPrompt(sectionType, rawText, title);

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let latex = response.text().trim();

  // Strip markdown code fences if the model wraps output anyway
  latex = latex
    .replace(/^```(?:latex)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return latex;
}

module.exports = { formatSectionWithAI };
