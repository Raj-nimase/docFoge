/**
 * Design Tokens → LaTeX Preamble Variables
 *
 * Mirrors frontend tokens.js into the LaTeX compilation pipeline,
 * ensuring PDF and screen rendering stay visually consistent.
 */

const TEMPLATES = {
  default: {
    topMargin: "2.54cm",
    bottomMargin: "2.54cm",
    leftMargin: "3.17cm",
    rightMargin: "3.17cm",
    fontSize: "11pt",
    lineSpread: "1.3",
    usesTitlePage: false,
    titleFormat: "center-bold",
  },
  academic: {
    topMargin: "2.54cm",
    bottomMargin: "2.54cm",
    leftMargin: "3.81cm",
    rightMargin: "3.81cm",
    fontSize: "12pt",
    lineSpread: "1.6",
    usesTitlePage: false,
    titleFormat: "center-bold",
  },
  report: {
    topMargin: "2.5cm",
    bottomMargin: "1.25cm",
    leftMargin: "3.5cm",
    rightMargin: "1.25cm",
    fontSize: "12pt",
    lineSpread: "1.6", // Standard word double space
    usesTitlePage: true,
    titleFormat: "center-bold",
  },
  resume: {
    topMargin: "1.5cm",
    bottomMargin: "1.5cm",
    leftMargin: "2cm",
    rightMargin: "2cm",
    fontSize: "10pt",
    lineSpread: "1.1",
    usesTitlePage: false,
    titleFormat: "left-bold",
  },
};

/**
 * Get template configuration (falls back to 'default').
 * @param {string} templateName
 * @returns {object}
 */
function getTemplate(templateName) {
  return TEMPLATES[templateName] || TEMPLATES.default;
}

function buildPreamble(templateName, documentTitle) {
  const t = getTemplate(templateName);
  const safeTitle = documentTitle
    ? documentTitle.replace(
        /[&%$#_{}~^\\]/g,
        (m) =>
          ({
            "&": "\\&",
            "%": "\\%",
            $: "\\$",
            "#": "\\#",
            _: "\\_",
            "{": "\\{",
            "}": "\\}",
            "~": "\\~{}",
            "^": "\\^{}",
            "\\": "\\textbackslash{}",
          })[m],
      )
    : "Untitled Document";

  const isReport = templateName === "report";
  const fontPackage = isReport
    ? "\\usepackage{mathptmx} % Times New Roman"
    : "\\usepackage{lmodern}";

  // For report: H1 is 14pt (large) Caps Centered. For default: H1 is Large Bold Left.
  // We use name=\\section,numberless because latexGenerator uses \\section*
  const sectionFormat = isReport
    ? `\\titleformat{name=\\section,numberless}[block]{\\large\\bfseries\\centering\\MakeUppercase}{}{0em}{}
\\titleformat{name=\\subsection,numberless}[block]{\\normalsize\\bfseries\\MakeUppercase}{}{0em}{}
\\titleformat{name=\\subsubsection,numberless}[block]{\\normalsize\\bfseries}{}{0em}{}
\\titlespacing*{name=\\section,numberless}{0pt}{2em}{1em}
\\titlespacing*{name=\\subsection,numberless}{0pt}{1.5em}{0.8em}
\\titlespacing*{name=\\subsubsection,numberless}{0pt}{1.2em}{0.5em}`
    : `\\titleformat{name=\\section,numberless}[block]{\\Large\\bfseries}{}{0em}{}
\\titleformat{name=\\subsection,numberless}[block]{\\large\\bfseries}{}{0em}{}
\\titleformat{name=\\subsubsection,numberless}[block]{\\normalsize\\bfseries}{}{0em}{}
\\titlespacing*{name=\\section,numberless}{0pt}{2.5ex plus 1ex minus .2ex}{1.5ex plus .2ex}
\\titlespacing*{name=\\subsection,numberless}{0pt}{2ex plus 1ex minus .2ex}{1ex plus .2ex}
\\titlespacing*{name=\\subsubsection,numberless}{0pt}{1.5ex plus 1ex minus .2ex}{0.75ex plus .2ex}`;

  return `\\documentclass[${t.fontSize},a4paper]{article}

% ── Encoding & Font ───────────────────────────────────────────────────────────
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
${fontPackage}
\\usepackage{microtype}

% ── Page Layout ───────────────────────────────────────────────────────────────
\\usepackage[
  top=${t.topMargin},
  bottom=${t.bottomMargin},
  left=${t.leftMargin},
  right=${t.rightMargin}
]{geometry}

% ── Typography ────────────────────────────────────────────────────────────────
\\usepackage{setspace}
\\setstretch{${t.lineSpread}}
\\usepackage{parskip}
\\setlength{\\parskip}{6pt}

% ── Section Formatting ────────────────────────────────────────────────────────
\\usepackage{titlesec}
${sectionFormat}

% ── Lists ─────────────────────────────────────────────────────────────────────
\\usepackage{enumitem}
\\setlist[itemize]{leftmargin=*, itemsep=2pt, parsep=0pt, topsep=4pt}
\\setlist[enumerate]{leftmargin=*, itemsep=2pt, parsep=0pt, topsep=4pt}

% ── Links ─────────────────────────────────────────────────────────────────────
\\usepackage[hidelinks]{hyperref}

% ── Document Info ─────────────────────────────────────────────────────────────
\\title{\\textbf{${safeTitle}}}
\\date{}
\\author{}
`;
}

module.exports = { buildPreamble, getTemplate, TEMPLATES };
