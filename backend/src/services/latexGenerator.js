/**
 * AcaDoc LaTeX Generator — Project-Aware
 * Simplified preamble for Tectonic compatibility.
 */

const { escapeLatex, auditLatexSource, sanitizeLatex } = require("./latexSanitizer");

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
  const isReport = ["diploma-project-report", "thesis", "assignment"].includes(templateId);
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
      geometryPackage = `\\usepackage[a4paper,top=${topMargin},bottom=22mm,inner=30mm,outer=20mm,headheight=14pt,headsep=12mm,footskip=13mm]{geometry}`;
    } else {
      geometryPackage = `\\usepackage[a4paper,top=${topMargin},bottom=22mm,left=30mm,right=20mm,headheight=14pt,headsep=12mm,footskip=13mm]{geometry}`;
    }
  } else if (isIEEE) {
    geometryPackage = "\\usepackage[a4paper,top=2.5cm,bottom=2.5cm,left=1.5cm,right=1.5cm]{geometry}";
  } else {
    geometryPackage = "\\usepackage[a4paper,top=2.5cm,bottom=2.5cm,left=3.5cm,right=1.25cm]{geometry}";
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
    "\\usepackage{caption}",
    "\\captionsetup[table]{position=above, skip=10pt}",
    "\\captionsetup[figure]{position=below, skip=10pt}",
    "\\usepackage{booktabs}",
    "\\usepackage{array}",
    "\\usepackage{longtable}",
    "\\usepackage{verbatim}",
    "\\usepackage{tabularx}",
    "\\usepackage{listings}",
    "\\usepackage{xcolor}",
    "\\usepackage[framemethod=default]{mdframed}",
    "\\usepackage[normalem]{ulem}",
    "\\usepackage{hyperref}",
    "\\usepackage{enumitem}",
    "\\usepackage{float}",
    "\\setlist{topsep=0.5em, itemsep=2pt, parsep=0pt, partopsep=0pt}",
    "",
    isIEEE ? "\\renewcommand{\\arraystretch}{1.2}" : "\\renewcommand{\\arraystretch}{1.6}",
    isIEEE ? "\\setlength{\\tabcolsep}{6pt}" : "\\setlength{\\tabcolsep}{14pt}",
    "",
    "\\lstset{",
    "  basicstyle=\\small\\ttfamily,",
    "  breaklines=true,",
    "  columns=fullflexible,",
    "  breakatwhitespace=false,",
    "  frame=single,",
    "  rulecolor=\\color{gray!30},",
    "  backgroundcolor=\\color{gray!5}",
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
    // Section 2.1.3: 1.5 line spacing
    lines.push("\\onehalfspacing");
    // Section 2.1.7: Clean Paragraph Spacing (0pt indent + 6pt parskip) & Widow/Orphan Control
    lines.push("\\setlength{\\parindent}{0pt}");
    lines.push("\\setlength{\\parskip}{6pt}");
    lines.push("\\clubpenalty=10000");
    lines.push("\\widowpenalty=10000");
    lines.push("\\hyphenpenalty=1000");
    lines.push("");
    // Section 2.2.1 & 2.2.2: Compact, Balanced Chapter and Section Headings
    lines.push("\\usepackage{titlesec}");
    lines.push("\\titleformat{\\chapter}[display]");
    lines.push("  {\\normalfont\\fontsize{18pt}{22pt}\\selectfont\\bfseries\\centering}");
    lines.push("  {\\chaptertitlename\\ \\thechapter}");
    lines.push("  {4mm}");
    lines.push("  {\\fontsize{18pt}{22pt}\\selectfont\\bfseries}");
    lines.push("\\titlespacing*{\\chapter}{0pt}{-10pt}{10mm}");
    lines.push("");
    lines.push("\\titleformat{\\section}");
    lines.push("  {\\normalfont\\fontsize{16pt}{20pt}\\selectfont\\bfseries}");
    lines.push("  {\\thesection}");
    lines.push("  {1em}");
    lines.push("  {}");
    lines.push("\\titlespacing*{\\section}{0pt}{8mm}{3mm}");
    lines.push("");
    lines.push("\\titleformat{\\subsection}");
    lines.push("  {\\normalfont\\fontsize{14pt}{18pt}\\selectfont\\bfseries}");
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
    lines.push("\\setlist[itemize]{leftmargin=1.5em, itemsep=2pt, topsep=4pt, parsep=0pt, partopsep=0pt}");
    lines.push("\\setlist[enumerate]{leftmargin=1.5em, itemsep=2pt, topsep=4pt, parsep=0pt, partopsep=0pt}");
    lines.push("");
    lines.push("\\setcounter{secnumdepth}{3}");
    lines.push("\\setcounter{tocdepth}{3}");
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

  // ── Front matter sections (certificate, acknowledgement, etc.) ──
  for (const section of frontMatter) {
    if (section.id === "title_page" || section.id === "toc") continue;
    const content = convertTipTapToLatex(section.content, templateId);
    if (content.trim()) {
      const label = escapeLatex(section.label);
      parts.push(
        `\\chapter*{${label}}\n\\addcontentsline{toc}{chapter}{${label}}\n\n${content}`,
      );
    }
  }

  // ── Table of Contents, Figures, and Tables ──
  if (isReport && frontMatter.some((s) => s.id === "toc")) {
    parts.push("\\newpage");
    parts.push("{\\singlespacing\n\\tableofcontents\n}");
    
    if (metadata.enableListOfFigures !== false) {
      parts.push("\\newpage");
      parts.push("{\\singlespacing\n\\listoffigures\n}");
    }
    
    if (metadata.enableListOfTables !== false) {
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
    const content = convertTipTapToLatexWithLevelShift(ch.content, templateId);
    if (isIEEE) {
      parts.push(`\\section{${title}}\n\n${content}`);
    } else {
      if (metadata.enableChapterNumbers === false) {
        parts.push(`\\chapter*{${title}}\n\\addcontentsline{toc}{chapter}{${title}}\n\n${content}`);
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
    "\\newpage",
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
    const sep = (prevEndsMath || currStartsMath) ? "\n" : "\n\n";
    result += sep + block;
  }
  return result;
}

function convertTipTapToLatex(tiptapJson, templateId) {
  if (!tiptapJson || !tiptapJson.content) return "";
  const blocks = tiptapJson.content.map(node => convertNode(node, templateId)).filter(Boolean);
  return joinBlocksWithSmartSpacing(blocks);
}

/**
 * Like convertTipTapToLatex but auto-promotes headings so the smallest
 * heading level in the chapter always maps to \section (1.1) or \subsection (IEEE).
 * This prevents "1.0.1" when a user presses H2 as their first/only heading.
 */
function convertTipTapToLatexWithLevelShift(tiptapJson, templateId) {
  if (!tiptapJson || !tiptapJson.content) return "";

  // Find minimum heading level used in this chapter
  let minLevel = 999;
  for (const node of tiptapJson.content) {
    if (node.type === "heading" && node.attrs && node.attrs.level) {
      if (node.attrs.level < minLevel) minLevel = node.attrs.level;
    }
  }
  
  // Shift amount: if minLevel=2, shift=-1 (H2→section, H3→subsection)
  // For IEEE, chapter title is already \section, so content headings should target \subsection (level 2)
  const isIEEE = templateId === "ieee-paper";
  const targetMinLevel = isIEEE ? 2 : 1;
  const shift = minLevel <= 3 ? targetMinLevel - minLevel : 0;

  const blocks = tiptapJson.content
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
  if (tr.includes("\\frac") || tr.includes("\\sqrt") || tr.includes("\\sum")) return true;
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
    const cmds = { 1: "section", 2: "subsection", 3: "subsubsection", 4: "paragraph" };
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
      const cmds = { 1: "section", 2: "subsection", 3: "subsubsection", 4: "paragraph" };
      return `\\${cmds[actualLevel] || "paragraph"}{${cleanText}}`;
    }

    case "bulletList":
      return buildList(node, "itemize", templateId);

    case "orderedList":
      return buildList(node, "enumerate", templateId);

    case "listItem": {
      const inner = (node.content || []).map(n => convertNode(n, templateId)).join(" ").trim();
      return `  \\item ${inner}`;
    }

    case "codeBlock": {
      const code = (node.content || []).map((n) => n.text || "").join("");
      return `\\begin{lstlisting}\n${code}\n\\end{lstlisting}`;
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
      const caption = node.attrs && node.attrs.title ? escapeLatex(node.attrs.title) : "Figure";
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
      } else if (src.startsWith("http")) {
        imageCounter++;
        let extension = "png";
        try {
          const urlExt = new URL(src).pathname.split('.').pop().toLowerCase();
          if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(urlExt)) extension = urlExt;
        } catch(e) {}
        
        const prefix = currentPrefix ? `${currentPrefix}_` : "";
        const filename = `${prefix}img_${imageCounter}.${extension}`;
        extractedImages.push({ filename, url: src });
        
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
    .map(n => convertNode(n, templateId))
    .filter(Boolean)
    .join("\n");
  return `\\begin{${env}}\n${items}\n\\end{${env}}`;
}

function convertTable(tableNode, templateId) {
  const rows = tableNode.content || [];
  if (!rows.length) return "";
  const caption = tableNode.attrs && tableNode.attrs.caption ? escapeLatex(tableNode.attrs.caption) : "Table";
  const colCount = rows[0] && rows[0].content ? rows[0].content.length : 1;
  const colSpec = Array(colCount).fill("X").join(" | ");

  const isIEEE = templateId === "ieee-paper";
  const tableWidth = isIEEE ? "\\columnwidth" : "\\textwidth";

  let tex = `\\begin{table}[H]\n\\centering\n`;
  tex += `\\caption{${caption}}\n\\vspace{4pt}\n`;
  tex += `\\begin{tabularx}{${tableWidth}}{| ${colSpec} |}\n\\hline\n`;

  for (const row of rows) {
    const cells = (row.content || []).map((cell) => {
      const cellText = (cell.content || []).map(n => convertNode(n, templateId)).join(" ").trim();
      if (cell.type === "tableHeader") {
        return `\\textbf{${cellText}}`;
      }
      return cellText;
    });
    tex += cells.join(" & ") + " \\\\\n\\hline\n";
  }

  tex += `\\end{tabularx}\n\\end{table}`;
  return tex;
}

function convertInline(nodes, templateId) {
  if (!nodes || !nodes.length) return "";
  return nodes.map(node => convertNode(node, templateId)).join("");
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
    hrule = (metadata.headerRule !== false) ? "0.4pt" : "0pt";
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
    frule = (!!metadata.footerRule) ? "0.4pt" : "0pt";
  } else {
    fc = "\\thepage";
  }

  return {
    enableHeader,
    enableFooter,
    hl, hc, hr, hrule,
    fl, fc, fr, frule
  };
}

module.exports = { generateProjectLatex, convertTipTapToLatex };
