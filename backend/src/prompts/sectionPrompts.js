/**
 * Returns the Gemini system prompt for a given document section type.
 * Each prompt instructs the model to produce ONLY the LaTeX body content
 * for that section — no \documentclass, no preamble, no \begin{document}.
 */

const BASE_INSTRUCTIONS = `
You are an expert LaTeX formatter for academic project documents (engineering / science colleges in India).
Rules:
- Output ONLY raw LaTeX code for the section body — NO preamble, NO \\documentclass, NO \\begin{document}, NO \\end{document}.
- Use \\section*{...} or the heading level appropriate for the section so it fits inside a larger document.
- Do NOT include page numbers or headers/footers.
- Format text professionally: fix grammar, improve clarity, keep technical facts intact.
- Use proper LaTeX environments: itemize, enumerate, tabular, figure, etc. as needed.
- Return ONLY LaTeX code — no markdown fences, no explanations.
`;

const SECTION_PROMPTS = {
  acknowledgement: `
${BASE_INSTRUCTIONS}
Section: Acknowledgement
- Write a formal academic acknowledgement in paragraph form.
- Thank guide, institution, family, friends (infer from context if not mentioned).
- Keep it concise (150–200 words).
- Use \\section*{Acknowledgement} as the heading.
`,

  abstract: `
${BASE_INSTRUCTIONS}
Section: Abstract
- Write a structured abstract: background, objective, methodology, results/outcome, conclusion.
- 200–300 words in a single paragraph.
- Use \\section*{Abstract} as the heading.
- Add keywords line: \\textbf{Keywords:} ... at the end.
`,

  introduction: `
${BASE_INSTRUCTIONS}
Section: Introduction
- Write a proper academic introduction with: background/context, problem statement, motivation, objectives, scope, and organization of the report.
- Use \\section{Introduction} as the heading.
- Use \\subsection{} for sub-topics if the raw text suggests sub-points.
- Minimum 3–4 paragraphs.
`,

  conclusion: `
${BASE_INSTRUCTIONS}
Section: Conclusion
- Summarise what was achieved, what problems were solved, and future scope.
- Use \\section{Conclusion} as the heading.
- 200–300 words.
- End with a brief future work paragraph.
`,

  custom: `
${BASE_INSTRUCTIONS}
Section: Custom / Generic
- The user has provided a custom section title and raw content.
- Use \\section{<title>} as the heading (infer the title from the raw text or the provided title field).
- Format the body with appropriate subsections, lists, and paragraphs.
- Preserve all technical terminology exactly.
`,
};

/**
 * Build the final prompt string for Gemini.
 * @param {string} sectionType  - one of the SECTION_PROMPTS keys or 'custom'
 * @param {string} rawText      - the raw user-provided text
 * @param {string} [title]      - optional custom section title
 */
function buildPrompt(sectionType, rawText, title = "") {
  const systemPrompt =
    SECTION_PROMPTS[sectionType] || SECTION_PROMPTS["custom"];

  const userMessage = title
    ? `Section Title: ${title}\n\nRaw Content:\n${rawText}`
    : `Raw Content:\n${rawText}`;

  return `${systemPrompt}\n\n---\n${userMessage}\n\nGenerate the LaTeX code now:`;
}

module.exports = { buildPrompt, SECTION_PROMPTS };
