/**
 * AcaDoc LaTeX Generator — Project-Aware
 * Simplified preamble for Tectonic compatibility.
 */

const {
  escapeLatex,
  auditLatexSource,
  sanitizeLatex,
} = require("./latexSanitizer");

function stripAllPrefixes(text) {
  let cleaned = text;
  let lastCleaned;
  do {
    lastCleaned = cleaned;
    cleaned = cleaned.replace(/^\d+(?:\.\d+)*\.?\s*/, ""); // numeric prefixes
    cleaned = cleaned.replace(/^[a-zA-Z][.)]\s*/, ""); // alpha prefixes
    cleaned = cleaned.replace(
      /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[.)]\s*/i,
      "",
    ); // roman numeral prefixes
  } while (cleaned !== lastCleaned);
  return cleaned.trim();
}

// ─── Public API ──────────────────────────────────────────────────────────────

let imageCounter = 0;
let extractedImages = [];
let currentPrefix = "";

function generateProjectLatex(project, imagePrefix = "") {
  const {
    metadata = {},
    templateId = "blank",
    frontMatter = [],
    chapters = [],
  } = project;

  imageCounter = 0;
  extractedImages = [];
  currentPrefix = imagePrefix;

  const preamble = buildPreamble(templateId, metadata);
  const body = buildBody(templateId, metadata, frontMatter, chapters);
  const latex = `${preamble}\n\\begin{document}\n\n${body}\n\n\\end{document}\n`;

  const audit = auditLatexSource(latex);
  return {
    latex,
    images: extractedImages,
    safe: audit.safe,
    reason: audit.reason,
  };
}

// ─── Preamble ─────────────────────────────────────────────────────────────────

function buildPreamble(templateId, metadata) {
  const title = escapeLatex(metadata.title || "Untitled Document");
  const author = escapeLatex(metadata.authors || "");
  const date = escapeLatex(metadata.year || "");
  const isIEEE = templateId === "ieee-paper";
  const isReport = ["blank", "diploma-project-report", "thesis", "assignment"].includes(
    templateId,
  );
  const isDoubleSided = !!metadata.isDoubleSided;

  const docclass = isIEEE
    ? "\\documentclass[twocolumn,10pt]{article}"
    : isDoubleSided
      ? "\\documentclass[12pt,a4paper,twoside]{report}"
      : "\\documentclass[12pt,a4paper]{report}";

  const enableHeader = !!metadata.enableHeader;
  const topMargin = enableHeader ? "15mm" : "30mm";

  let geometryPackage;
  if (isReport) {
    if (isDoubleSided) {
      geometryPackage = `\\usepackage[a4paper,top=2.5cm,bottom=1.25cm,inner=3.5cm,outer=1.25cm,headheight=14pt,headsep=8mm,footskip=8mm]{geometry}`;
    } else {
      geometryPackage = `\\usepackage[a4paper,top=2.5cm,bottom=1.25cm,left=3.5cm,right=1.25cm,headheight=14pt,headsep=8mm,footskip=8mm]{geometry}`;
    }
  } else if (isIEEE) {
    geometryPackage =
      "\\usepackage[a4paper,top=2.5cm,bottom=2.5cm,left=1.5cm,right=1.5cm]{geometry}";
  } else {
    geometryPackage =
      "\\usepackage[a4paper,top=2.5cm,bottom=1.25cm,left=3.5cm,right=1.25cm]{geometry}";
  }

  // Minimal, Tectonic-safe package set
  const lines = [
    docclass,
    "\\usepackage{amsmath, amssymb, amsfonts}",
    geometryPackage,
    "\\usepackage{fontspec}",
    "\\setmainfont{FreeSerif}[",
    "  Extension = .otf,",
    "  UprightFont = *,",
    "  BoldFont = *Bold,",
    "  ItalicFont = *Italic,",
    "  BoldItalicFont = *BoldItalic,",
    "]",
    "\\setsansfont{FreeSans}[",
    "  Extension = .otf,",
    "  UprightFont = *,",
    "  BoldFont = *Bold,",
    "  ItalicFont = *Oblique,",
    "  BoldItalicFont = *BoldOblique,",
    "]",
    "\\setmonofont{FreeMono}[",
    "  Extension = .otf,",
    "  UprightFont = *,",
    "  BoldFont = *Bold,",
    "  ItalicFont = *Oblique,",
    "  BoldItalicFont = *BoldOblique,",
    "]",
    "\\usepackage{setspace}",
    "\\usepackage{graphicx}",
    "\\usepackage{pdfpages}",
    "\\usepackage{caption}",
    "\\captionsetup[table]{position=below, skip=10pt}",
    "\\captionsetup[figure]{position=below, skip=10pt}",
    "\\usepackage{booktabs}",
    "\\usepackage{array}",
    "\\usepackage{longtable}",
    "\\usepackage{verbatim}",
    "\\usepackage{tabularx}",
    "\\usepackage{listings}",
    "\\usepackage{xcolor}",
    "\\usepackage[framemethod=default]{mdframed}",
    "\\usepackage[absolute,overlay]{textpos}",
    "\\setlength{\\TPHorizModule}{1mm}",
    "\\setlength{\\TPVertModule}{1mm}",
    "\\textblockorigin{0mm}{0mm}",
    "\\usepackage[normalem]{ulem}",
    "\\usepackage{hyperref}",
    "\\usepackage{enumitem}",
    "\\usepackage{float}",
    "\\setlist{topsep=0.5em, itemsep=2pt, parsep=0pt, partopsep=0pt}",
    "",
    isIEEE
      ? "\\renewcommand{\\arraystretch}{1.2}"
      : "\\renewcommand{\\arraystretch}{1.6}",
    isIEEE ? "\\setlength{\\tabcolsep}{6pt}" : "\\setlength{\\tabcolsep}{14pt}",
    "\\usepackage{etoolbox}",
    "\\AtBeginEnvironment{lstlisting}{\\setstretch{1.0}}",
    "\\AtBeginEnvironment{bmatrix}{\\renewcommand{\\arraystretch}{1.1}}",
    "\\AtBeginEnvironment{pmatrix}{\\renewcommand{\\arraystretch}{1.1}}",
    "\\AtBeginEnvironment{vmatrix}{\\renewcommand{\\arraystretch}{1.1}}",
    "\\AtBeginEnvironment{Vmatrix}{\\renewcommand{\\arraystretch}{1.1}}",
    "\\AtBeginEnvironment{matrix}{\\renewcommand{\\arraystretch}{1.1}}",
    "\\AtBeginEnvironment{cases}{\\renewcommand{\\arraystretch}{1.1}}",
    "\\AtBeginEnvironment{aligned}{\\renewcommand{\\arraystretch}{1.1}}",
    "\\lstset{",
    "  basicstyle=\\ttfamily\\small,",
    "  columns=fixed,",
    "  keepspaces=true,",
    "  showstringspaces=false,",
    "  breaklines=true,",
    "  breakatwhitespace=false,",
    "  frame=single,",
    "  framerule=0.6pt,",
    "  rulecolor=\\color{gray!40},",
    "  backgroundcolor=\\color{gray!6},",
    "  tabsize=2,",
    "  xleftmargin=4pt,",
    "  xrightmargin=4pt,",
    "  escapeinside={(*@}{@*)}",
    "}",
    "",
    "\\newmdenv[",
    "  leftline=true,",
    "  rightline=false,",
    "  topline=false,",
    "  bottomline=false,",
    "  linecolor=gray,",
    "  linewidth=2pt,",
    "  innerleftmargin=10pt,",
    "  innerrightmargin=0pt,",
    "  innertopmargin=0pt,",
    "  innerbottommargin=0pt,",
    "  leftmargin=0pt,",
    "  rightmargin=0pt,",
    "  skipabove=10pt,",
    "  skipbelow=10pt",
    "]{myblockquote}",
    "",
  ];

  if (isReport) {
    // Rule g: Double line spacing
    lines.push("\\doublespacing");
    // Paragraph Spacing & Widow/Orphan Control
    lines.push("\\setlength{\\parindent}{0pt}");
    lines.push("\\setlength{\\parskip}{6pt}");
    lines.push("\\clubpenalty=10000");
    lines.push("\\widowpenalty=10000");
    lines.push("\\hyphenpenalty=1000");
    lines.push("");
    // Prominent, distinct visual hierarchy for Headings following typographical guidelines:
    // e. Chapter Name: TNR-14 Capital Bold
    // d. Section Heading: TNR-12 Capital Bold
    // c. Subsection Heading: TNR-12 Bold Normal
    lines.push("\\usepackage{titlesec}");
    lines.push("\\titleformat{\\chapter}[display]");
    lines.push(
      "  {\\normalfont\\fontsize{14pt}{18pt}\\selectfont\\bfseries\\centering}",
    );
    lines.push("  {\\MakeUppercase{\\chaptertitlename\\ \\thechapter}}");
    lines.push("  {4mm}");
    lines.push("  {\\MakeUppercase}");
    lines.push("\\titlespacing*{\\chapter}{0pt}{-10pt}{10mm}");
    lines.push("");
    lines.push("\\titleformat{\\section}");
    lines.push("  {\\normalfont\\fontsize{12pt}{16pt}\\selectfont\\bfseries}");
    lines.push("  {\\thesection}");
    lines.push("  {1em}");
    lines.push("  {\\MakeUppercase}");
    lines.push("\\titlespacing*{\\section}{0pt}{8mm}{3mm}");
    lines.push("");
    lines.push("\\titleformat{\\subsection}");
    lines.push("  {\\normalfont\\fontsize{12pt}{16pt}\\selectfont\\bfseries}");
    lines.push("  {\\thesubsection}");
    lines.push("  {1em}");
    lines.push("  {}");
    lines.push("\\titlespacing*{\\subsection}{0pt}{6mm}{2mm}");
    lines.push("");
    lines.push("\\titleformat{\\subsubsection}");
    lines.push("  {\\normalfont\\fontsize{12pt}{15pt}\\selectfont\\bfseries}");
    lines.push("  {\\thesubsubsection}");
    lines.push("  {1em}");
    lines.push("  {}");
    lines.push("\\titlespacing*{\\subsubsection}{0pt}{5mm}{2mm}");
    lines.push("");
    lines.push("\\setlength{\\abovedisplayskip}{6pt}");
    lines.push("\\setlength{\\belowdisplayskip}{6pt}");
    lines.push("");
    lines.push(
      "\\setlist[itemize]{leftmargin=1.5em, itemsep=2pt, topsep=4pt, parsep=0pt, partopsep=0pt}",
    );
    lines.push(
      "\\setlist[enumerate]{leftmargin=1.5em, itemsep=2pt, topsep=4pt, parsep=0pt, partopsep=0pt}",
    );
    lines.push("");
    lines.push("\\setcounter{secnumdepth}{3}");
    lines.push("\\setcounter{tocdepth}{3}");
    lines.push("");
    lines.push("% Table of Contents formatting with dot leaders (..........)");
    lines.push("\\usepackage{tocloft}");
    lines.push("\\renewcommand{\\cftchapleader}{\\cftdotfill{\\cftdotsep}}");
    lines.push("\\renewcommand{\\cftsecleader}{\\cftdotfill{\\cftdotsep}}");
    lines.push("\\renewcommand{\\cftsubsecleader}{\\cftdotfill{\\cftdotsep}}");
  } else if (!isIEEE) {
    lines.push("\\doublespacing");
    lines.push("\\setcounter{secnumdepth}{3}");
    lines.push("\\setcounter{tocdepth}{3}");
  }

  // ─── Headers & Footers (fancyhdr) ───
  const config = getHeaderFooterConfig(metadata);

  lines.push("");
  lines.push("\\usepackage{fancyhdr}");

  if (isReport) {
    // Redefine plain page style so chapter first pages have center footer page number & NO header (Section 2.1.5)
    lines.push("\\fancypagestyle{plain}{%");
    lines.push("  \\fancyhf{}");
    lines.push("  \\fancyfoot[C]{\\thepage}");
    lines.push("  \\renewcommand{\\headrulewidth}{0pt}");
    lines.push("  \\renewcommand{\\footrulewidth}{0pt}");
    lines.push("}");
  }

  if (config.enableHeader || config.enableFooter) {
    if (isReport) {
      lines.push("\\pagestyle{plain}");
    } else {
      lines.push("\\pagestyle{fancy}");
    }

    lines.push("\\fancyhf{}");

    // Apply to standard 'fancy' layout
    lines.push(`\\fancyhead[L]{${config.hl}}`);
    lines.push(`\\fancyhead[C]{${config.hc}}`);
    lines.push(`\\fancyhead[R]{${config.hr}}`);
    lines.push(`\\fancyfoot[L]{${config.fl}}`);
    lines.push(`\\fancyfoot[C]{${config.fc}}`);
    lines.push(`\\fancyfoot[R]{${config.fr}}`);
    lines.push(`\\renewcommand{\\headrulewidth}{${config.hrule}}`);
    lines.push(`\\renewcommand{\\footrulewidth}{${config.frule}}`);

    if (!isReport) {
      // For non-reports (like IEEE papers), redefine 'plain' immediately so page 1 gets them
      lines.push("");
      lines.push("\\fancypagestyle{plain}{%");
      lines.push("  \\fancyhf{}");
      lines.push(`  \\fancyhead[L]{${config.hl}}`);
      lines.push(`  \\fancyhead[C]{${config.hc}}`);
      lines.push(`  \\fancyhead[R]{${config.hr}}`);
      lines.push(`  \\fancyfoot[L]{${config.fl}}`);
      lines.push(`  \\fancyfoot[C]{${config.fc}}`);
      lines.push(`  \\fancyfoot[R]{${config.fr}}`);
      lines.push(`  \\renewcommand{\\headrulewidth}{${config.hrule}}`);
      lines.push(`  \\renewcommand{\\footrulewidth}{${config.frule}}`);
      lines.push("}");
    }
  } else {
    lines.push("\\pagestyle{plain}");
  }

  lines.push("");
  lines.push(`\\title{\\textbf{${title}}}`);
  if (author) {
    if (isIEEE) {
      lines.push(`\\author{\\parbox{\\textwidth}{\\centering ${author}}}`);
    } else {
      lines.push(`\\author{${author}}`);
    }
  }
  lines.push(`\\date{${date}}`);

  return lines.join("\n");
}

// ─── Body ─────────────────────────────────────────────────────────────────────

function buildBody(templateId, metadata, frontMatter, chapters) {
  const parts = [];
  const isIEEE = templateId === "ieee-paper";
  const isReport = ["diploma-project-report", "thesis", "assignment"].includes(
    templateId,
  );

  // ── Title / front page ──
  if (isReport) {
    parts.push(buildTitlePage(metadata));
    parts.push("\\pagenumbering{roman}");
    parts.push("\\setcounter{page}{1}");
  } else {
    parts.push("\\maketitle");
    if (isIEEE && metadata.abstract) {
      parts.push(
        `\\begin{abstract}\n${escapeLatex(metadata.abstract)}\n\\end{abstract}`,
      );
    }
    if (isIEEE && metadata.keywords) {
      parts.push(
        `\\noindent\\textbf{Keywords:} ${escapeLatex(metadata.keywords)}`,
      );
    }
  }

// ─── Certificate: absolute (WYSIWYG) renderer ────────────────────────────────
//
// The editor canvas is a 650x920 px element with A4 proportions, and it records
// the painted pixel rect of every block into certData.layout. Rather than
// re-flowing that content and hoping it lands in the same place, we replay each
// rect as a `textpos` block at the exact same coordinate. Nothing flows, so
// nothing can drift, overlap, or be pushed off the page.

const A4_W_MM = 210;
const A4_H_MM = 297;
const PT_PER_MM = 1 / 0.3527777778;

// Font sizes used by the canvas, in px. Keep in sync with
// CertificateCanvasEditor.jsx — these are what make the PDF text match visually.
const CANVAS_FONT_PX = {
  college: 15,
  institution: 12,
  title: 22,
  body: 14,
  tableTitle: 12,
  tableCell: 11,
  sigTitle: 12,
  sigName: 11,
  datePlace: 12,
};

function certScale(layout) {
  const pw = layout?.paperW || 650;
  const ph = layout?.paperH || 920;
  return { sx: A4_W_MM / pw, sy: A4_H_MM / ph };
}

// Round to 2dp — sub-0.01mm precision is meaningless and bloats the source
// (which would also churn the content-hash PDF cache).
function mm(v) {
  return (Math.round(v * 100) / 100).toFixed(2);
}

// px on canvas → pt in the PDF, via the physical mm size of a canvas pixel.
function pxToPt(px, sx) {
  return (Math.round(px * sx * PT_PER_MM * 10) / 10).toFixed(1);
}

// Emit a sized font selection: \fontsize{size}{leading}\selectfont
function fontCmd(px, sx, lineHeightRatio = 1.25) {
  const size = pxToPt(px, sx);
  const lead = pxToPt(px * lineHeightRatio, sx);
  return `\\fontsize{${size}pt}{${lead}pt}\\selectfont`;
}

/**
 * Wrap content in an absolutely-positioned textpos block.
 * Coordinates are the block's top-left, in mm from the page's top-left corner.
 *
 * The document body sets \parskip=6pt and \doublespacing, and LaTeX's `center`
 * environment adds its own glue above and below. Inside an absolutely-placed
 * block all of that is pure error — it pushes content below the coordinate we
 * measured. So every block resets vertical spacing to zero and uses
 * \centering rather than the center environment.
 */
function textblock(xMm, yMm, wMm, content) {
  return [
    `\\begin{textblock}{${mm(wMm)}}(${mm(xMm)},${mm(yMm)})`,
    "\\setlength{\\parskip}{0pt}\\setlength{\\parindent}{0pt}\\setstretch{1}%",
    content,
    "\\end{textblock}",
  ].join("\n");
}

function buildCertificateBorder(borderStyle) {
  if (!borderStyle || borderStyle === "none") return null;

  // Match the canvas: the frame hugs the paper edge. Inset by a few mm so the
  // rule is not clipped by printer non-printable margins.
  const inset = 8;
  const w = A4_W_MM - inset * 2;
  const h = A4_H_MM - inset * 2;

  const rule = (lw, ww, hh) =>
    `\\setlength{\\fboxrule}{${lw}}\\setlength{\\fboxsep}{0pt}\\framebox[${mm(ww)}mm]{\\rule{0pt}{${mm(hh)}mm}}`;

  if (borderStyle === "single") {
    return textblock(inset, inset, w, `\\noindent${rule("1.5pt", w, h)}`);
  }

  // "double" — an outer heavy rule with a lighter inner rule, mirroring the
  // CSS `6px double` frame.
  const gap = 2.2;
  return [
    textblock(inset, inset, w, `\\noindent${rule("1.2pt", w, h)}`),
    textblock(
      inset + gap,
      inset + gap,
      w - gap * 2,
      `\\noindent${rule("0.6pt", w - gap * 2, h - gap * 2)}`,
    ),
  ].join("\n\n");
}

function buildCertificateCanvasLatex(certData, metadata) {
  // ── Mode 1: Uploaded Signed Hardcopy Certificate (PDF or Image) ──
  if ((certData.mode === "upload" || certData.isUploadedPdf) && certData.uploadedPdf) {
    const rawData = certData.uploadedPdf;
    const isPdf = rawData.startsWith("data:application/pdf") || rawData.startsWith("JVBERi");

    if (isPdf) {
      imageCounter++;
      const prefix = currentPrefix ? `${currentPrefix}_` : "";
      const pdfFilename = `${prefix}cert_page_${imageCounter}.pdf`;
      const base64Data = rawData.includes(",") ? rawData.split(",")[1] : rawData;
      extractedImages.push({ filename: pdfFilename, base64: base64Data });

      const out = [
        "\\addcontentsline{toc}{chapter}{Certificate}",
        `\\includepdf[pages=1, pagecommand={\\thispagestyle{empty}}]{${pdfFilename}}`
      ];
      return out.join("\n\n");
    } else if (rawData.startsWith("data:image")) {
      imageCounter++;
      let extension = "png";
      if (rawData.includes("image/jpeg") || rawData.includes("image/jpg")) extension = "jpg";
      const prefix = currentPrefix ? `${currentPrefix}_` : "";
      const imgFilename = `${prefix}cert_page_${imageCounter}.${extension}`;
      const base64Data = rawData.includes(",") ? rawData.split(",")[1] : rawData;
      extractedImages.push({ filename: imgFilename, base64: base64Data });

      const out = [
        "\\addcontentsline{toc}{chapter}{Certificate}",
        `\\includepdf[pages=1, pagecommand={\\thispagestyle{empty}}]{${imgFilename}}`
      ];
      return out.join("\n\n");
    }
  }

  // ── Mode 2: Puppeteer HTML-to-Vector PDF Engine ──
  if (certData.vectorPdfFilename) {
    const out = [
      "\\addcontentsline{toc}{chapter}{Certificate}",
      `\\includepdf[pages=1, pagecommand={\\thispagestyle{empty}}]{${certData.vectorPdfFilename}}`
    ];
    return out.join("\n\n");
  }

  // ── Mode 3: Clean Native Vector TeX Flow Renderer (Fallback) ──
  return buildCertificateCanvasLatexFlow(certData, metadata);
}

// Flow-based certificate renderer with non-overlapping elements
function buildCertificateCanvasLatexFlow(certData, metadata) {
  const lines = [];

  lines.push("\\clearpage");
  lines.push("\\newgeometry{top=2.2cm, bottom=2cm, left=2.2cm, right=2.2cm}"); // Remove document left=3.5cm margin for Certificate page only
  lines.push("\\thispagestyle{empty}"); // Suppress running header/footer for Certificate page
  lines.push("\\addcontentsline{toc}{chapter}{Certificate}");

  // Optional Frame / Border
  const useBorder = certData.borderStyle && certData.borderStyle !== "none";
  if (useBorder) {
    lines.push("\\begin{mdframed}[linewidth=1.5pt, innerleftmargin=20pt, innerrightmargin=20pt, innertopmargin=15pt, innerbottommargin=15pt]");
  }

  const offsets = certData.offsets || {};

  // 1. Logo
  if (certData.logo?.url) {
    const alignEnv = certData.logo.alignment === "left" ? "flushleft" : certData.logo.alignment === "right" ? "flushright" : "center";
    const logoCm = ((certData.logo.width || 120) / 40).toFixed(1); // convert px to cm
    const logoXmm = Math.round((certData.logo.x || 0) / 4);
    const logoYmm = Math.max(0, Math.round((certData.logo.y || 0) / 4));

    let logoFilename = certData.logo.url;
    if (logoFilename.startsWith("data:image")) {
      imageCounter++;
      let extension = logoFilename.split(";")[0].split("/")[1]?.split("+")[0] || "png";
      if (extension === "webp" || extension === "svg" || extension === "bmp") {
        extension = "png";
      }
      const prefix = currentPrefix ? `${currentPrefix}_` : "";
      logoFilename = `${prefix}cert_logo_${imageCounter}.${extension}`;
      const base64Data = certData.logo.url.split(",")[1];
      extractedImages.push({ filename: logoFilename, base64: base64Data });
    }

    if (logoYmm > 0) {
      lines.push(`\\vspace*{${logoYmm}mm}`);
    }

    let logoContent = `\\begin{${alignEnv}}\n\\includegraphics[width=${logoCm}cm,height=3.5cm,keepaspectratio]{${logoFilename}}\n\\end{${alignEnv}}`;
    if (logoXmm !== 0) {
      logoContent = `\\noindent\\hspace*{${logoXmm}mm}\\parbox{\\textwidth}{\n${logoContent}\n}`;
    }
    lines.push(logoContent);
    lines.push("\\vspace{2mm}");
  }

  // 2. Header (College & Department)
  const college = certData.college || (certData.institution ? certData.college : "");
  const dept = certData.institution || "";

  if (college || dept) {
    const headerXmm = Math.round((offsets.header?.x || 0) / 4);
    const headerYmm = Math.max(0, Math.round((offsets.header?.y || 0) / 4));
    
    if (headerYmm > 0) {
      lines.push(`\\vspace*{${headerYmm}mm}`);
    }

    let headerLines = [];
    headerLines.push("\\begin{center}");
    if (college) {
      headerLines.push(`{\\fontsize{14pt}{18pt}\\selectfont\\bfseries ${escapeLatex(college.toUpperCase())}}\\\\[3pt]`);
    }
    if (dept) {
      headerLines.push(`{\\fontsize{11pt}{15pt}\\selectfont\\bfseries ${escapeLatex(dept.toUpperCase())}}\\\\[8pt]`);
    }
    headerLines.push("\\end{center}");

    let headerContent = headerLines.join("\n");
    if (headerXmm !== 0) {
      headerContent = `\\noindent\\hspace*{${headerXmm}mm}\\parbox{\\textwidth}{\n${headerContent}\n}`;
    }
    lines.push(headerContent);
  }

  // 3. Title
  if (certData.title) {
    const titleXmm = Math.round((offsets.title?.x || 0) / 4);
    const titleYmm = Math.max(0, Math.round((offsets.title?.y || 0) / 4));

    if (titleYmm > 0) {
      lines.push(`\\vspace*{${titleYmm}mm}`);
    }

    let titleContent = `\\begin{center}\n{\\fontsize{18pt}{22pt}\\selectfont\\bfseries \\uline{${escapeLatex(certData.title.toUpperCase())}}}\\\\[12pt]\n\\end{center}`;
    if (titleXmm !== 0) {
      titleContent = `\\noindent\\hspace*{${titleXmm}mm}\\parbox{\\textwidth}{\n${titleContent}\n}`;
    }
    lines.push(titleContent);
  }

  // 4. Body Paragraph
  if (certData.body) {
    const bodyXmm = Math.round((offsets.body?.x || 0) / 4);
    const bodyYmm = Math.max(0, Math.round((offsets.body?.y || 0) / 4));

    if (bodyYmm > 0) {
      lines.push(`\\vspace*{${bodyYmm}mm}`);
    }

    let bodyText = certData.body;
    bodyText = bodyText.replace(/\[PROJECT TITLE\]/gi, metadata.title || "Untitled Project");
    bodyText = bodyText.replace(/\[CANDIDATE NAME\]/gi, metadata.authors || "Candidate Name");
    
    let bodyContent = `{\\onehalfspacing\n${escapeLatex(bodyText)}\n}`;
    if (bodyXmm !== 0) {
      bodyContent = `\\noindent\\hspace*{${bodyXmm}mm}\\parbox{\\textwidth}{\n${bodyContent}\n}`;
    }
    lines.push(bodyContent);
    lines.push("\\vspace{6mm}");
  }

  // 5. Custom Data Tables
  if (certData.customTables && certData.customTables.length > 0) {
    for (const tbl of certData.customTables) {
      if (!tbl.headers || tbl.headers.length === 0) continue;
      const vSpaceXmm = Math.round((tbl.x || 0) / 4);
      const vSpaceYmm = Math.max(0, Math.round((tbl.y || 0) / 4));

      if (vSpaceYmm > 0) {
        lines.push(`\\vspace*{${vSpaceYmm}mm}`);
      }
      
      let tblLines = [];
      tblLines.push("\\begin{center}");
      if (tbl.title) {
        tblLines.push(`{\\small\\textbf{${escapeLatex(tbl.title)}}}\\\\[4pt]`);
      }
      const colCount = tbl.headers.length;
      const alignSpec = `|${new Array(colCount).fill("c").join("|")}|`;
      tblLines.push(`\\begin{tabular}{${alignSpec}}`);
      tblLines.push("\\hline");

      const headerCells = tbl.headers.map((h) => `\\textbf{${escapeLatex(h)}}`).join(" & ");
      tblLines.push(`${headerCells} \\\\ \\hline`);

      for (const row of tbl.rows || []) {
        const rowCells = row.map((c) => escapeLatex(c || "")).join(" & ");
        tblLines.push(`${rowCells} \\\\ \\hline`);
      }

      tblLines.push("\\end{tabular}");
      tblLines.push("\\end{center}");
      
      let tblContent = tblLines.join("\n");
      if (vSpaceXmm !== 0) {
        tblContent = `\\noindent\\hspace*{${vSpaceXmm}mm}\\parbox{\\textwidth}{\n${tblContent}\n}`;
      }
      lines.push(tblContent);
      lines.push("\\vspace{4mm}");
    }
  }

  // 6. Signatures Grid
  const sigs = certData.signatures || [];
  if (sigs.length > 0) {
    const sigXmm = Math.round((offsets.signatures?.x || 0) / 4);
    const sigYmm = Math.max(0, Math.round((offsets.signatures?.y || 0) / 4));
    
    // Always push signatures & Date/Place footer to bottom of page initially
    lines.push("\\vfill"); 
    if (sigYmm > 0) {
      lines.push(`\\vspace*{${sigYmm}mm}`);
    }

    const colCount = Math.min(sigs.length, 3);
    const colSpec = colCount === 3 ? ">{\\centering\\arraybackslash}p{0.31\\textwidth} >{\\centering\\arraybackslash}p{0.31\\textwidth} >{\\centering\\arraybackslash}p{0.31\\textwidth}" : colCount === 2 ? ">{\\centering\\arraybackslash}p{0.46\\textwidth} >{\\centering\\arraybackslash}p{0.46\\textwidth}" : ">{\\centering\\arraybackslash}p{0.9\\textwidth}";

    let sigLines = [];
    sigLines.push("\\noindent");
    sigLines.push(`\\begin{tabular}{@{} ${colSpec} @{}}`);

    const lineCells = sigs.map(() => "\\rule{0.85\\linewidth}{0.6pt}").join(" & ");
    sigLines.push(`${lineCells} \\\\[4pt]`);

    const titleCells = sigs.map((s) => `\\textbf{${escapeLatex(s.title)}}`).join(" & ");
    sigLines.push(`${titleCells} \\\\[2pt]`);

    const nameCells = sigs.map((s) => s.name ? `{\\small (${escapeLatex(s.name)})}` : "").join(" & ");
    sigLines.push(`${nameCells}`);

    sigLines.push("\\end{tabular}");
    
    let sigContent = sigLines.join("\n");
    if (sigXmm !== 0) {
      sigContent = `\\noindent\\hspace*{${sigXmm}mm}\\parbox{\\textwidth}{\n${sigContent}\n}`;
    }
    lines.push(sigContent);
    lines.push("\\vspace{4mm}");
  }

  // 7. Date & Place Footer
  if (certData.datePlace) {
    const datePlaceXmm = Math.round((offsets.datePlace?.x || 0) / 4);
    const datePlaceYmm = Math.max(0, Math.round((offsets.datePlace?.y || 0) / 4));
    
    if (datePlaceYmm > 0) {
      lines.push(`\\vspace*{${datePlaceYmm}mm}`);
    }

    let dpContent = `\\noindent\n{\\singlespacing\\small\n${escapeLatex(certData.datePlace).replace(/\n/g, "\\\\ ")}\n}`;
    if (datePlaceXmm !== 0) {
      dpContent = `\\noindent\\hspace*{${datePlaceXmm}mm}\\parbox{\\textwidth}{\n${dpContent}\n}`;
    }
    lines.push(dpContent);
  }

  if (useBorder) {
    lines.push("\\end{mdframed}");
  }

  lines.push("\\clearpage");
  lines.push("\\restoregeometry"); // Restore standard 3.5cm document left margin for Chapter 1 and rest of document

  return lines.join("\n\n");
}

  // ── Front matter sections (certificate, acknowledgement, etc.) ──
  for (const section of frontMatter) {
    if (section.id === "title_page" || section.id === "toc") continue;

    const isCert =
      section.id === "certificate" ||
      section.type === "certificate" ||
      (section.content &&
        (section.content.isCertificateCanvas ||
          section.content.objects ||
          section.content.scene ||
          section.content.vectorPdfFilename));

    if (isCert) {
      if (section.content && section.content.vectorPdfFilename) {
        parts.push(
          `\\clearpage\n\\thispagestyle{empty}\n\\includepdf[pages=-,fitpaper=true]{${section.content.vectorPdfFilename}}\n\\clearpage`,
        );
      } else if (section.content && section.content.isCertificateCanvas) {
        parts.push(buildCertificateCanvasLatex(section.content, metadata));
      }
      continue;
    }

    const content = convertTipTapToLatex(section.content, templateId);
    if (content.trim()) {
      const label = escapeLatex(section.label);
      const upperLabel = escapeLatex(section.label.toUpperCase());
      parts.push(
        `\\chapter*{${upperLabel}}\n\\addcontentsline{toc}{chapter}{${label}}\n\n${content}`,
      );
    }
  }

function hasNodeType(projectData, nodeType) {
  const checkDoc = (doc) => {
    if (!doc || typeof doc !== "object") return false;
    if (Array.isArray(doc)) return doc.some(checkDoc);
    if (doc.type === nodeType) return true;
    if (doc.content && Array.isArray(doc.content)) {
      return doc.content.some(checkDoc);
    }
    return false;
  };

  const frontMatterHas = (projectData.frontMatter || []).some((fm) => checkDoc(fm.content));
  const chaptersHas = (projectData.chapters || []).some((ch) => checkDoc(ch.content));
  return frontMatterHas || chaptersHas;
}

  // ── Table of Contents, Figures, and Tables ──
  const hasImages = hasNodeType({ frontMatter, chapters }, "image");
  const hasTables = hasNodeType({ frontMatter, chapters }, "table");

  if (isReport) {
    if (frontMatter.some((s) => s.id === "toc")) {
      parts.push("\\newpage");
      parts.push("{\\singlespacing\n\\tableofcontents\n}");
    }

    if (metadata.enableListOfFigures !== false && hasImages) {
      parts.push("\\newpage");
      parts.push("{\\singlespacing\n\\addcontentsline{toc}{chapter}{\\listfigurename}\n\\listoffigures\n}");
    }

    if (metadata.enableListOfTables !== false && hasTables) {
      parts.push("\\newpage");
      parts.push("{\\singlespacing\n\\addcontentsline{toc}{chapter}{\\listtablename}\n\\listoftables\n}");
    }
  } else {
    if (metadata.enableListOfFigures === true && hasImages) {
      parts.push("\\newpage");
      parts.push("{\\singlespacing\n\\listoffigures\n}");
    }

    if (metadata.enableListOfTables === true && hasTables) {
      parts.push("\\newpage");
      parts.push("{\\singlespacing\n\\listoftables\n}");
    }
  }

  // ── Switch to arabic page numbering before chapters ──
  if (isReport) {
    parts.push("\\newpage");
    parts.push("\\pagenumbering{arabic}");
    parts.push("\\setcounter{page}{1}");

    // Start Chapter 1 and onwards getting the fancy headers/footers!
    const config = getHeaderFooterConfig(metadata);
    if (config.enableHeader || config.enableFooter) {
      parts.push("");
      parts.push("\\pagestyle{fancy}");
      parts.push("\\fancypagestyle{plain}{%");
      parts.push("  \\fancyhf{}");
      parts.push(`  \\fancyhead[L]{${config.hl}}`);
      parts.push(`  \\fancyhead[C]{${config.hc}}`);
      parts.push(`  \\fancyhead[R]{${config.hr}}`);
      parts.push(`  \\fancyfoot[L]{${config.fl}}`);
      parts.push(`  \\fancyfoot[C]{${config.fc}}`);
      parts.push(`  \\fancyfoot[R]{${config.fr}}`);
      parts.push(`  \\renewcommand{\\headrulewidth}{${config.hrule}}`);
      parts.push(`  \\renewcommand{\\footrulewidth}{${config.frule}}`);
      parts.push("}");
    }
  }

  // ── Chapters / Sections ──
  for (const ch of chapters) {
    const title = escapeLatex(ch.title || "");
    const content = convertTipTapToLatexWithLevelShift(ch.content, templateId, ch.title || "");
    if (isIEEE) {
      parts.push(`\\section{${title}}\n\n${content}`);
    } else {
      if (metadata.enableChapterNumbers === false) {
        parts.push(
          `\\chapter*{${title}}\n\\addcontentsline{toc}{chapter}{${title}}\n\n${content}`,
        );
      } else {
        parts.push(`\\chapter{${title}}\n\n${content}`);
      }
    }
  }

  return parts.join("\n\n");
}

function buildTitlePage(meta) {
  const title = escapeLatex(meta.title || "Project Report");
  const authors = escapeLatex(meta.authors || "");
  const guide = escapeLatex(meta.guide || "");
  const dept = escapeLatex(meta.department || "");
  const inst = escapeLatex(meta.institution || "");
  const year = escapeLatex(meta.year || "");

  const guideBlock = guide
    ? `\\vspace{1cm}\n{\\large Under the Guidance of\\par}\n\\vspace{0.3cm}\n{\\large \\textbf{${guide}}\\par}`
    : "";

  return [
    "\\begin{titlepage}",
    "\\centering",
    "\\vspace*{1cm}",
    inst ? `{\\Large \\textbf{${inst}}\\par}` : "",
    inst ? "\\vspace{0.4cm}" : "",
    dept ? `{\\large ${dept}\\par}` : "",
    dept ? "\\vspace{1cm}" : "",
    "\\rule{\\linewidth}{0.4pt}",
    "\\vspace{0.5cm}",
    `{\\LARGE \\textbf{\\uppercase{${title}}}\\par}`,
    "\\vspace{0.5cm}",
    "\\rule{\\linewidth}{0.4pt}",
    "\\vfill",
    authors
      ? `{\\large Submitted by\\par}\n\\vspace{0.3cm}\n{\\large \\textbf{${authors}}\\par}`
      : "",
    guideBlock,
    "\\vfill",
    year ? `{\\large ${year}\\par}` : "",
    "\\end{titlepage}",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

// ─── TipTap JSON → LaTeX ──────────────────────────────────────────────────────

function joinBlocksWithSmartSpacing(blocks) {
  let result = "";
  for (let i = 0; i < blocks.length; i++) {
    const block = (blocks[i] || "").trim();
    if (!block) continue;
    if (!result) {
      result = block;
      continue;
    }
    const prevEndsMath = result.trimEnd().endsWith("\\]");
    const currStartsMath = block.startsWith("\\[");
    const sep = prevEndsMath || currStartsMath ? "\n" : "\n\n";
    result += sep + block;
  }
  return result;
}

function convertTipTapToLatex(tiptapJson, templateId) {
  if (!tiptapJson || !tiptapJson.content) return "";
  const blocks = tiptapJson.content
    .map((node) => convertNode(node, templateId))
    .filter(Boolean);
  return joinBlocksWithSmartSpacing(blocks);
}

function isChapterHeaderNode(node, chapterTitle = "") {
  if (!node || node.type !== "heading") return false;
  const rawText = (node.content || [])
    .map((n) => n.text || "")
    .join("")
    .trim();
  if (!rawText) return false;
  const upper = rawText.toUpperCase();
  if (/^CHAPTER\s+\d+[:\s\-]*/i.test(upper)) return true;
  if (/^CHAPTER[:\s\-]*/i.test(upper)) return true;
  if (
    chapterTitle &&
    stripAllPrefixes(rawText).toUpperCase() ===
      stripAllPrefixes(chapterTitle).toUpperCase()
  ) {
    return true;
  }
  return false;
}

/**
 * Like convertTipTapToLatex but auto-promotes headings so the smallest
 * heading level in the chapter always maps to \section (1.1) or \subsection (IEEE).
 * This prevents "1.0.1" when a user presses H2 as their first/only heading.
 */
function convertTipTapToLatexWithLevelShift(tiptapJson, templateId, chapterTitle = "") {
  if (!tiptapJson || !tiptapJson.content) return "";

  // Filter out any leading heading node that repeats the Chapter Title/Number
  const filteredNodes = tiptapJson.content.filter((node, index) => {
    if (index === 0 && isChapterHeaderNode(node, chapterTitle)) {
      return false;
    }
    return true;
  });

  // Find minimum heading level used in this chapter
  let minLevel = 999;
  for (const node of filteredNodes) {
    if (node.type === "heading" && node.attrs && node.attrs.level) {
      if (node.attrs.level < minLevel) minLevel = node.attrs.level;
    }
  }

  // Shift amount: if minLevel=2, shift=-1 (H2→section, H3→subsection)
  // For IEEE, chapter title is already \section, so content headings should target \subsection (level 2)
  const isIEEE = templateId === "ieee-paper";
  const targetMinLevel = isIEEE ? 2 : 1;
  const shift = minLevel <= 3 ? targetMinLevel - minLevel : 0;

  const blocks = filteredNodes
    .map((node) => convertNodeWithShift(node, shift, templateId))
    .filter(Boolean);

  return joinBlocksWithSmartSpacing(blocks);
}

function isMathText(text) {
  const tr = (text || "").trim();
  if (!tr) return false;
  if (/^[\[\]$$]/.test(tr)) return true;
  if (/^\\[a-zA-Z]+/.test(tr)) return true;
  if (/^\$/.test(tr)) return true;
  if (tr.includes("\\frac") || tr.includes("\\sqrt") || tr.includes("\\sum"))
    return true;
  return false;
}

function convertNodeWithShift(node, shift, templateId) {
  if (!node) return "";
  if (node.type === "heading") {
    const text = convertInline(node.content, templateId);
    if (isMathText(text)) {
      return `\\[ ${sanitizeLatex(text)} \\]`;
    }
    const cleanText = stripAllPrefixes(text);
    const rawLevel = node.attrs && node.attrs.level ? node.attrs.level : 1;
    const isIEEE = templateId === "ieee-paper";
    const maxLevel = isIEEE ? 4 : 3;
    const shiftedLevel = Math.max(1, Math.min(maxLevel, rawLevel + shift));
    const cmds = {
      1: "section",
      2: "subsection",
      3: "subsubsection",
      4: "paragraph",
    };
    return `\\${cmds[shiftedLevel] || "paragraph"}{${cleanText}}`;
  }
  // For all other node types, use the normal converter
  return convertNode(node, templateId);
}

function convertNode(node, templateId) {
  if (!node) return "";
  switch (node.type) {
    case "paragraph":
      return convertInline(node.content, templateId);

    case "heading": {
      const text = convertInline(node.content, templateId);
      if (isMathText(text)) {
        return `\\[ ${sanitizeLatex(text)} \\]`;
      }
      const cleanText = stripAllPrefixes(text);
      const level = node.attrs && node.attrs.level ? node.attrs.level : 1;
      const isIEEE = templateId === "ieee-paper";
      const actualLevel = isIEEE ? level + 1 : level;
      const cmds = {
        1: "section",
        2: "subsection",
        3: "subsubsection",
        4: "paragraph",
      };
      return `\\${cmds[actualLevel] || "paragraph"}{${cleanText}}`;
    }

    case "bulletList":
      return buildList(node, "itemize", templateId);

    case "orderedList":
      return buildList(node, "enumerate", templateId);

    case "listItem": {
      const inner = (node.content || [])
        .map((n) => convertNode(n, templateId))
        .join(" ")
        .trim();
      return `  \\item ${inner}`;
    }

    case "codeBlock": {
      const rawCode = (node.content || []).map((n) => n.text || "").join("");
      let cleanCode = rawCode.replace(/^\s*\n+/, "").replace(/\n+\s*$/, "");
      cleanCode = cleanCode
        .replace(/[│┃┆┇┊┠┨┯┷┿╂╎╏║]/g, "|")
        .replace(/[─━┄┅┈┉═]/g, "-")
        .replace(
          /[┌┐└┘├┤┬┴┼┍┎┏╔┑┒┓╗┕┖┗╚┙┚┛╝┝┞┟┠┡┢┣╠┥┦┧┨┩┪┫╣┭┮┯┰┱┲┳╦┵┶┷┸┹┺┻╩┽┾┿╀╁╂╃╄╅╆╇╈╉╊╋╬╭╮╯╰]/g,
          "+",
        )
        .replace(/[▼▽▾⬇⇩⇓↓🡓]/g, "(*@$\\downarrow$@*)")
        .replace(/[▲△▴⬆⇧⇑↑🡑]/g, "(*@$\\uparrow$@*)")
        .replace(/[◄◁◀⇦⇐←🡐]/g, "(*@$\\leftarrow$@*)")
        .replace(/[►▷▶⇨⇒→➔➘➙➚➛➜➝➞➟➡🡒]/g, "(*@$\\rightarrow$@*)")
        .replace(/↔/g, "(*@$\\leftrightarrow$@*)")
        .replace(/↕/g, "|");
      return `\\begin{lstlisting}\n${cleanCode}\n\\end{lstlisting}`;
    }

    case "blockquote": {
      const inner = convertTipTapToLatex({ content: node.content }, templateId);
      return `\\begin{myblockquote}\n${inner}\n\\end{myblockquote}`;
    }

    case "table":
      return convertTable(node, templateId);

    case "horizontalRule":
      return "\\noindent\\rule{\\linewidth}{0.4pt}";

    case "hardBreak":
      return "~\\\\\n";

    case "math": {
      const latex = node.attrs && node.attrs.latex ? node.attrs.latex : "";
      const isDisplay = node.attrs && node.attrs.display === true;
      const safeLatex = sanitizeLatex(latex);
      if (isDisplay) {
        return `\\[ ${safeLatex} \\]`;
      }
      return `$${safeLatex}$`;
    }

    case "image": {
      const src = node.attrs && node.attrs.src ? node.attrs.src : "";
      const caption =
        node.attrs && (node.attrs.title || node.attrs.alt)
          ? escapeLatex(node.attrs.title || node.attrs.alt)
          : "Figure";
      if (src === "katexmath") {
        // Unconverted image carrier from mobile editor — render as math
        const latex = node.attrs && node.attrs.alt ? node.attrs.alt : "";
        const safeLatex = sanitizeLatex(latex);
        const isDisplay = node.attrs && node.attrs.title === "display";
        return isDisplay ? `\\[ ${safeLatex} \\]` : `$${safeLatex}$`;
      }
      if (src === "tiptaptable") {
        // Unconverted table carrier — try to parse and render
        try {
          const tableNode = JSON.parse(node.attrs.alt || "{}");
          return renderNode(tableNode);
        } catch (e) {
          return "";
        }
      }
      if (src.startsWith("data:image")) {
        imageCounter++;
        const extension = src.split(";")[0].split("/")[1] || "png";
        const prefix = currentPrefix ? `${currentPrefix}_` : "";
        const filename = `${prefix}img_${imageCounter}.${extension}`;
        const base64Data = src.split(",")[1];
        extractedImages.push({ filename, base64: base64Data });

        return `\\begin{figure}[H]\n  \\centering\n  \\includegraphics[width=0.6\\textwidth,height=0.4\\textheight,keepaspectratio]{${filename}}\n  \\caption{${caption}}\n\\end{figure}`;
      } else if (src) {
        imageCounter++;
        let extension = "png";
        let fullUrl = src;

        if (src.startsWith("/")) {
          const baseUrl = process.env.BACKEND_URL || "http://localhost:3001";
          fullUrl = `${baseUrl}${src}`;
        }

        try {
          const urlExt = new URL(fullUrl).pathname.split(".").pop().toLowerCase();
          if (["png", "jpg", "jpeg", "gif", "webp"].includes(urlExt))
            extension = urlExt;
        } catch (e) {}

        const prefix = currentPrefix ? `${currentPrefix}_` : "";
        const filename = `${prefix}img_${imageCounter}.${extension}`;
        extractedImages.push({ filename, url: fullUrl });

        return `\\begin{figure}[H]\n  \\centering\n  \\includegraphics[width=0.6\\textwidth,height=0.4\\textheight,keepaspectratio]{${filename}}\n  \\caption{${caption}}\n\\end{figure}`;
      }
      return "";
    }

    case "text":
      return convertTextWithMarks(node);

    default:
      return "";
  }
}

function buildList(node, env, templateId) {
  const items = (node.content || [])
    .map((n) => convertNode(n, templateId))
    .filter(Boolean)
    .join("\n");
  return `\\begin{${env}}\n${items}\n\\end{${env}}`;
}

function convertTable(tableNode, templateId) {
  const rows = tableNode.content || [];
  if (!rows.length) return "";
  const caption =
    tableNode.attrs && tableNode.attrs.caption
      ? escapeLatex(tableNode.attrs.caption)
      : "Table";
  const colCount = rows[0] && rows[0].content ? rows[0].content.length : 1;
  const colSpec = Array(colCount).fill("X").join(" | ");

  const isIEEE = templateId === "ieee-paper";
  const tableWidth = isIEEE ? "\\columnwidth" : "\\textwidth";

  let tex = `\\begin{table}[H]\n\\centering\n`;
  tex += `\\begin{tabularx}{${tableWidth}}{| ${colSpec} |}\n\\hline\n`;

  for (const row of rows) {
    const cells = (row.content || []).map((cell) => {
      const cellText = (cell.content || [])
        .map((n) => convertNode(n, templateId))
        .join(" ")
        .trim();
      if (cell.type === "tableHeader") {
        return `\\textbf{${cellText}}`;
      }
      return cellText;
    });
    tex += cells.join(" & ") + " \\\\\n\\hline\n";
  }

  tex += `\\end{tabularx}\n\\vspace{6pt}\n\\caption{${caption}}\n\\end{table}`;
  return tex;
}

function convertInline(nodes, templateId) {
  if (!nodes || !nodes.length) return "";
  let result = "";
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const converted = convertNode(node, templateId);
    if (!converted) continue;

    if (result) {
      const prevIsDisplay = nodes[i - 1]?.type === "math" && nodes[i - 1]?.attrs?.display === true;
      const currIsDisplay = node.type === "math" && node.attrs?.display === true;
      if (prevIsDisplay || currIsDisplay) {
        result += "\n\n";
      }
    }
    result += converted;
  }
  return result;
}

function convertTextWithMarks(node) {
  let text = escapeLatex(node.text || "");
  const marks = node.marks || [];
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        text = `\\textbf{${text}}`;
        break;
      case "italic":
        text = `\\textit{${text}}`;
        break;
      case "underline":
        text = `\\uline{${text}}`;
        break;
      case "code":
        text = `\\texttt{${text}}`;
        break;
      case "strike":
        text = `\\sout{${text}}`;
        break;
    }
  }
  return text;
}

function getHeaderFooterConfig(metadata) {
  const enableHeader = !!metadata.enableHeader;
  const enableFooter = !!metadata.enableFooter;

  let hl = "";
  let hc = "";
  let hr = "";
  let hrule = "0pt";
  if (enableHeader) {
    hl = escapeLatex(metadata.headerLeft || "");
    hc = escapeLatex(metadata.headerCenter || "");
    hr = escapeLatex(metadata.headerRight || "");
    hrule = metadata.headerRule !== false ? "0.4pt" : "0pt";
  }

  let fl = "";
  let fc = "";
  let fr = "";
  let frule = "0pt";
  if (enableFooter) {
    fl = escapeLatex(metadata.footerLeft || "");
    fc = escapeLatex(metadata.footerCenter || "");
    fr = escapeLatex(metadata.footerRight || "");

    const hasPagePlaceholder =
      /\[page\]/i.test(metadata.footerLeft || "") ||
      /\[page\]/i.test(metadata.footerCenter || "") ||
      /\[page\]/i.test(metadata.footerRight || "");

    if (hasPagePlaceholder) {
      fl = fl.replace(/\[page\]/gi, "\\thepage");
      fc = fc.replace(/\[page\]/gi, "\\thepage");
      fr = fr.replace(/\[page\]/gi, "\\thepage");
    } else {
      if (!fc) {
        fc = "\\thepage";
      } else {
        fc = `${fc}\\\\ \\thepage`;
      }
    }
    frule = !!metadata.footerRule ? "0.4pt" : "0pt";
  } else {
    fc = "\\thepage";
  }

  return {
    enableHeader,
    enableFooter,
    hl,
    hc,
    hr,
    hrule,
    fl,
    fc,
    fr,
    frule,
  };
}

module.exports = { generateProjectLatex, convertTipTapToLatex };
