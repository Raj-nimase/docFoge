/**
 * LaTeX Document Assembler
 * Tectonic runs XeTeX by default.
 * Uses mathptmx for Times-like fonts — loaded from Tectonic's own package cache,
 * no system fonts or fontconfig needed.
 */

const PREAMBLE = `\\documentclass[12pt,a4paper]{report}

% ─── Packages ──────────────────────────────────────────────────────────────────
\\usepackage[a4paper, margin=1in]{geometry}
\\usepackage{fontspec}            % Fontspec for XeTeX/Tectonic
\\setmainfont{FreeSerif}[
  Extension = .otf,
  UprightFont = *,
  BoldFont = *Bold,
  ItalicFont = *Italic,
  BoldItalicFont = *BoldItalic,
]
\\setsansfont{FreeSans}[
  Extension = .otf,
  UprightFont = *,
  BoldFont = *Bold,
  ItalicFont = *Oblique,
  BoldItalicFont = *BoldOblique,
]
\\setmonofont{FreeMono}[
  Extension = .otf,
  UprightFont = *,
  BoldFont = *Bold,
  ItalicFont = *Oblique,
  BoldItalicFont = *BoldOblique,
]
\\usepackage{setspace}            % Line spacing
\\usepackage{titlesec}            % Section heading customisation
\\usepackage{fancyhdr}            % Headers/footers
\\usepackage{graphicx}            % Images
\\usepackage{hyperref}            % Hyperlinks in PDF
\\usepackage{amsmath}             % Math
\\usepackage{array}               % Better tables
\\usepackage{booktabs}            % Professional table rules
\\usepackage{enumitem}            % List customisation
\\usepackage{parskip}             % Paragraph spacing instead of indent
\\usepackage{xcolor}              % Colours

% ─── Spacing ───────────────────────────────────────────────────────────────────
\\onehalfspacing

% ─── Section heading style ─────────────────────────────────────────────────────
\\titleformat{\\section}{\\large\\bfseries}{\\thesection}{1em}{}
\\titleformat{\\subsection}{\\normalsize\\bfseries}{\\thesubsection}{1em}{}

% ─── Header / Footer ───────────────────────────────────────────────────────────
\\pagestyle{fancy}
\\fancyhf{}
\\rhead{\\small Project Report}
\\lhead{\\small DocForge AI}
\\cfoot{\\thepage}
\\renewcommand{\\headrulewidth}{0.4pt}

% ─── Hyperref setup ────────────────────────────────────────────────────────────
\\hypersetup{
  colorlinks=true,
  linkcolor=black,
  urlcolor=blue,
  pdfborder={0 0 0}
}
`;

/**
 * Safely escape any LaTeX special characters in plain-text fields.
 * Only applies to user-supplied metadata strings, NOT latexBody content.
 */
function escapeLatex(str) {
  return (str || "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g,  "\\&")
    .replace(/%/g,  "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g,  "\\#")
    .replace(/_/g,  "\\_")
    .replace(/\^/g, "\\^{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g,  "\\textasciitilde{}");
}

/**
 * Build the title page LaTeX block.
 * Uses \vspace instead of \\[Xpt] to avoid "no line here to end" when fields are empty.
 *
 * @param {object} meta - { projectTitle, collegeName, department, authors, guide, year }
 */
function buildTitlePage(meta = {}) {
  const {
    projectTitle = "Project Title",
    collegeName  = "College Name",
    department   = "Department of Computer Engineering",
    authors      = ["Author Name"],
    guide        = "Prof. Guide Name",
    year         = new Date().getFullYear(),
  } = meta;

  // Use defaults for any empty strings
  const safeTitle   = escapeLatex(projectTitle.trim()  || "Project Title");
  const safeCollege = escapeLatex(collegeName.trim()   || "College Name");
  const safeDept    = escapeLatex(department.trim()    || "Department");
  const safeGuide   = escapeLatex(guide.trim()         || "Guide Name");
  const safeYear    = String(year || new Date().getFullYear());

  const authorLines = (authors.length > 0 ? authors : ["Author Name"])
    .map((a) => `  {\\Large ${escapeLatex(a.trim() || "Author")}}\\\\[4pt]`)
    .join("\n");

  return `
\\begin{titlepage}
  \\centering
  \\vspace*{1cm}

  {\\LARGE \\textbf{${safeCollege}}}
  \\vspace{8pt}

  {\\large ${safeDept}}
  \\vspace{30pt}

  \\rule{\\linewidth}{0.5mm}
  \\vspace{10pt}

  {\\Huge \\bfseries ${safeTitle}}
  \\vspace{10pt}

  \\rule{\\linewidth}{0.5mm}
  \\vspace{20pt}

  {\\large \\textit{Submitted by:}}
  \\vspace{8pt}

${authorLines}

  \\vfill

  {\\large Under the guidance of}
  \\vspace{4pt}
  {\\large \\textbf{${safeGuide}}}
  \\vspace{20pt}

  {\\large Academic Year: ${safeYear}}
  \\vspace{10pt}
\\end{titlepage}
\\newpage
\\tableofcontents
\\newpage
`;
}

/**
 * Assemble a full compilable LaTeX document.
 *
 * @param {Array<{ latexBody: string }>} sections  - ordered section bodies
 * @param {object} meta                             - title page metadata
 * @returns {string}  - complete LaTeX source
 */
function assembleDocument(sections, meta = {}) {
  const titlePage = buildTitlePage(meta);

  const body = sections
    .map((s) => s.latexBody)
    .join("\n\n% ─────────────────────────────────────────\n\n");

  return `${PREAMBLE}
\\begin{document}

${titlePage}

${body}

\\end{document}
`;
}

module.exports = { assembleDocument };
