/**
 * AcaDoc LaTeX Generator — Project-Aware
 * Simplified preamble for Tectonic compatibility.
 */

const { escapeLatex, auditLatexSource } = require("./latexSanitizer");

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

  const docclass = isIEEE
    ? "\\documentclass[twocolumn,10pt]{article}"
    : "\\documentclass[12pt,a4paper]{report}";

  // Minimal, Tectonic-safe package set
  const lines = [
    docclass,
    "\\usepackage{amsmath, amssymb, amsfonts}",
    "\\usepackage[a4paper,top=2.5cm,bottom=2.5cm,left=3.5cm,right=1.25cm]{geometry}",
    "\\usepackage{setspace}",
    "\\usepackage{graphicx}",
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
    "\\setlist{noitemsep, topsep=0.5em, parsep=0pt, partopsep=0pt}",
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

  if (!isIEEE) {
    lines.push("\\doublespacing");
    // Number sections 3 levels deep: 1 / 1.1 / 1.1.1
    lines.push("\\setcounter{secnumdepth}{3}");
    lines.push("\\setcounter{tocdepth}{3}");
  }

  // ─── Headers & Footers (fancyhdr) ───
  const config = getHeaderFooterConfig(metadata);
  const isReport = ["diploma-project-report", "thesis", "assignment"].includes(templateId);

  if (config.enableHeader || config.enableFooter) {
    lines.push("");
    lines.push("\\usepackage{fancyhdr}");
    
    // For standard reports, we keep the default style as plain for the front matter.
    // We will activate fancy headers/footers right before Chapter 1 in buildBody.
    if (isReport) {
      lines.push("\\pagestyle{plain}");
    } else {
      // For articles / IEEE papers, we want fancy headers/footers immediately from page 1!
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
    
    parts.push("\\newpage");
    parts.push("{\\singlespacing\n\\listoffigures\n}");
    
    parts.push("\\newpage");
    parts.push("{\\singlespacing\n\\listoftables\n}");
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
      parts.push(`\\chapter{${title}}\n\n${content}`);
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

function convertTipTapToLatex(tiptapJson, templateId) {
  if (!tiptapJson || !tiptapJson.content) return "";
  return tiptapJson.content.map(node => convertNode(node, templateId)).filter(Boolean).join("\n\n");
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

  return tiptapJson.content
    .map((node) => convertNodeWithShift(node, shift, templateId))
    .filter(Boolean)
    .join("\n\n");
}

function convertNodeWithShift(node, shift, templateId) {
  if (!node) return "";
  if (node.type === "heading") {
    const rawLevel = node.attrs && node.attrs.level ? node.attrs.level : 1;
    const isIEEE = templateId === "ieee-paper";
    const maxLevel = isIEEE ? 4 : 3;
    const shiftedLevel = Math.max(1, Math.min(maxLevel, rawLevel + shift));
    const text = stripAllPrefixes(convertInline(node.content, templateId));
    const cmds = { 1: "section", 2: "subsection", 3: "subsubsection", 4: "paragraph" };
    return `\\${cmds[shiftedLevel] || "paragraph"}{${text}}`;
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
      const level = node.attrs && node.attrs.level ? node.attrs.level : 1;
      const text = stripAllPrefixes(convertInline(node.content, templateId));
      const isIEEE = templateId === "ieee-paper";
      const actualLevel = isIEEE ? level + 1 : level;
      const cmds = { 1: "section", 2: "subsection", 3: "subsubsection", 4: "paragraph" };
      return `\\${cmds[actualLevel] || "paragraph"}{${text}}`;
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
      // Sanitize: strip emojis, unicode whitespace, then map symbols
      const cleanLatex = (latex || "")
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
        .replace(/[\u00A0\u2002-\u200A\u202F\u205F]/g, " ")
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
        .replace(/θ/g, "\\theta")
        .replace(/π/g, "\\pi")
        .replace(/α/g, "\\alpha")
        .replace(/β/g, "\\beta")
        .replace(/γ/g, "\\gamma")
        .replace(/δ/g, "\\delta")
        .replace(/σ/g, "\\sigma")
        .replace(/μ/g, "\\mu")
        .replace(/λ/g, "\\lambda")
        .replace(/φ/g, "\\phi")
        .replace(/ψ/g, "\\psi")
        .replace(/ω/g, "\\omega")
        .replace(/∞/g, "\\infty")
        .replace(/±/g, "\\pm")
        .replace(/×/g, "\\times")
        .replace(/÷/g, "\\div")
        .replace(/≤/g, "\\leq")
        .replace(/≥/g, "\\geq")
        .replace(/≠/g, "\\neq")
        .replace(/²/g, "^2")
        .replace(/³/g, "^3");
      if (isDisplay) {
        return `\\[ ${cleanLatex} \\]`;
      }
      return `$${cleanLatex}$`;
    }

    case "image": {
      const src = node.attrs && node.attrs.src ? node.attrs.src : "";
      const caption = node.attrs && node.attrs.title ? escapeLatex(node.attrs.title) : "Figure";
      if (src.startsWith("data:image")) {
        imageCounter++;
        const extension = src.split(";")[0].split("/")[1] || "png";
        const prefix = currentPrefix ? `${currentPrefix}_` : "";
        const filename = `${prefix}img_${imageCounter}.${extension}`;
        const base64Data = src.split(",")[1];
        extractedImages.push({ filename, base64: base64Data });
        
        return `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{${filename}}\n  \\caption{${caption}}\n\\end{figure}`;
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
        
        return `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{${filename}}\n  \\caption{${caption}}\n\\end{figure}`;
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

  let tex = `\\begin{table}[htbp]\n\\centering\n`;
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

  tex += `\\end{tabularx}\n\\caption{${caption}}\n\\end{table}`;
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
