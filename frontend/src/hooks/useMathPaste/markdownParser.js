import { convUnicodeMath, sanitizeLatex } from "./mathUtils.js";

// Escape prose so it is safe inside a LaTeX \text{…}; normalise a few unit
// glyphs to ASCII and drop remaining non-ASCII (the '·' in "N·m", etc.).
function mmTextEscape(s) {
  return (s || "")
    .replace(/[·⋅∙]/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/×/g, "x")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "/")
    .replace(/([%#&_$])/g, "\\$1")
    .replace(/\{/g, "\\{").replace(/\}/g, "\\}")
    .replace(/[\^~]/g, "");
}

function mmIsVar(s) {
  s = (s || "").trim();
  return /^[A-Za-z](_[A-Za-z0-9]+|\^[A-Za-z0-9]+|_\{[^}]+\}|\^\{[^}]+\})?$/.test(s) || /^\\[a-zA-Z]+(_[A-Za-z0-9]+)?$/.test(s);
}
function mmWordy(s) { const m = s.match(/[A-Za-z]{3,}/g); return m ? m.length : 0; }
function mmMathScore(L) {
  const hasStruct = /\^\{|_\{|\\[a-zA-Z]/.test(L);
  const hasOps = /[=+×÷±√]|[-](?=[0-9a-zA-Z(])/.test(L);
  return hasStruct || (hasOps && mmWordy(L) <= 3);
}

// "LHS = description" legend line (e.g. "(S) = Slip (%)", "T = Torque (N·m)",
// "\cos\phi = Power factor") → { lhs, rhs } or null. One layer of wrapping
// parens on the LHS is stripped.
function mmDefLine(s) {
  const cleanS = (s || "")
    .trim()
    .replace(/^([*\-+•◦▪]|(?:\d+|[a-zA-Z])[.)])\s+/, "");
  const eq = cleanS.indexOf("=");
  if (eq <= 0) return null;
  if (cleanS.charAt(eq + 1) === "=" || "<>!".indexOf(cleanS.charAt(eq - 1)) !== -1) return null; // ==, <=, >=, !=
  let lhs = cleanS.slice(0, eq).trim();
  const rhs = cleanS.slice(eq + 1).trim();
  if (!lhs || !rhs) return null;
  const pm = lhs.match(/^\(([^)]{1,24})\)$/);
  if (pm) lhs = pm[1].trim();

  // Strip any leading/trailing math delimiters from LHS (e.g. $N_s$ -> N_s)
  while (true) {
    const start = lhs;
    if (lhs.startsWith('$$') && lhs.endsWith('$$')) {
      lhs = lhs.slice(2, -2).trim();
    } else if (lhs.startsWith('$') && lhs.endsWith('$')) {
      lhs = lhs.slice(1, -1).trim();
    } else if (lhs.startsWith('\\(') && lhs.endsWith('\\)')) {
      lhs = lhs.slice(2, -2).trim();
    } else if (lhs.startsWith('\\[') && lhs.endsWith('\\]')) {
      lhs = lhs.slice(2, -2).trim();
    }
    if (lhs === start) break;
  }

  const lhsOk = mmIsVar(lhs) || (/\\[a-zA-Z]/.test(lhs) && mmWordy(lhs) <= 3) || (lhs.length <= 12 && mmWordy(lhs) === 0);
  if (!lhsOk) return null;
  if (mmWordy(rhs) < 1 || mmMathScore(rhs)) return null;
  return { lhs, rhs };
}

function mmLooksMathy(text) {
  return /[\\]/.test(text) || /[\^_]\s*[{0-9a-zA-Z]/.test(text) || /\$\$?[^$]+\$\$?/.test(text) || /[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/.test(text) || /[√∑∏∫∞±≤≥≠×÷∈∂]/.test(text);
}

function mmCleanText(s) { return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1"); }

function mmHasLatex(s) { return /[\\^_]/.test(s); }

function mmMatchBalanced(str, open, oc, cc) {
  let depth = 0;
  for (let j = open; j < str.length; j++) {
    const ch = str[j];
    if (ch === "\\") { j++; continue; }
    if (ch === oc) depth++;
    else if (ch === cc) { depth--; if (depth === 0) return j; }
  }
  return -1;
}

// Scan a line into text / inline-math tokens ($…$, \(…\), and (latex)/[latex]).
function mmScanInline(str) {
  const tokens = []; let buf = ""; let i = 0;
  const pushText = () => { if (buf) { tokens.push({ t: "text", v: buf }); buf = ""; } };
  while (i < str.length) {
    const c = str[i], n = str[i + 1];
    if (c === "\\" && n === "(") { const e = str.indexOf("\\)", i + 2); if (e !== -1) { pushText(); tokens.push({ t: "math", v: str.slice(i + 2, e).trim() }); i = e + 2; continue; } }
    if (c === "\\" && n === "[") { const e = str.indexOf("\\]", i + 2); if (e !== -1) { pushText(); tokens.push({ t: "math", v: str.slice(i + 2, e).trim() }); i = e + 2; continue; } }
    if (c === "$") { const dbl = n === "$"; const d = dbl ? "$$" : "$"; const e = str.indexOf(d, i + d.length); if (e !== -1) { pushText(); tokens.push({ t: "math", v: str.slice(i + d.length, e).trim() }); i = e + d.length; continue; } }
    if (c === "(" && str[i - 1] !== "\\") { const e = mmMatchBalanced(str, i, "(", ")"); if (e !== -1) { const inner = str.slice(i + 1, e); if (mmHasLatex(inner)) { pushText(); tokens.push({ t: "math", v: inner.trim() }); i = e + 1; continue; } } }
    if (c === "[" && str[i - 1] !== "\\") { const e = mmMatchBalanced(str, i, "[", "]"); if (e !== -1) { const inner = str.slice(i + 1, e); if (mmHasLatex(inner)) { pushText(); tokens.push({ t: "math", v: inner.trim() }); i = e + 1; continue; } } }
    buf += c; i++;
  }
  pushText();
  return tokens;
}

function mmFindClose(s, delim) {
  if (delim === "]") { for (let j = 0; j < s.length; j++) if (s[j] === "]" && s[j - 1] !== "\\") return j; return -1; }
  return s.indexOf(delim);
}

function escapeHtml(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function escapeAttr(s) { return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function mathSpan(latex, display) {
  return `<span data-latex="${escapeAttr(sanitizeLatex(latex))}"${display ? ' data-display="true"' : ""}></span>`;
}

// Convert markdown bold/italic/strikethrough/underline/code in text into tags
function mmInlineMd(escaped) {
  if (!escaped) return "";
  return escaped
    .replace(/(\*\*\*|___)(.*?)\1/g, "<strong><em>$2</em></strong>")
    .replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>")
    .replace(/(^|[^\w\\])(\*|_)(?=\S)(.*?)(?<=\S)\2/g, "$1<em>$3</em>")
    .replace(/~~(.*?)~~/g, "<s>$1</s>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>")
    .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, "<u>$1</u>");
}

// A line's inline content → HTML (formatted text interleaved with inline math).
function mmInlineToHtml(raw) {
  const tokens = mmScanInline(raw);
  let out = "";
  for (const tk of tokens) {
    if (tk.t === "math") { if (tk.v) out += mathSpan(tk.v, false); }
    else out += mmInlineMd(escapeHtml(tk.v));
  }
  return out;
}

// Does this plain text read like a markdown-with-math formula sheet worth
// parsing with parseMarkdownMathToHtml? (Has a display fence, or is multi-line
// LaTeX with a legend line.)
function stripHeadingPrefix(text) {
  let cleaned = mmCleanText(text);
  // Strip digit prefixes followed by dot/paren and space: e.g. "1. ", "4.1. ", "10.2) "
  cleaned = cleaned.replace(/^\s*\d+(?:\.\d+)*[.)]\s+/, "");
  // Strip letter/roman prefixes followed by dot/paren and space: e.g. "a) ", "A. ", "ix) ", "IV. "
  cleaned = cleaned.replace(/^\s*(?:[a-zA-Z]|[iI][vV]|[vV]?[iI]{1,3}|[iI][xX])\s*[.)]\s+/, "");
  return cleaned.trim();
}

export function looksLikeMarkdownMath(text) {
  if (!text) return false;
  const clean = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const hasFence = /^[ \t]*(\[|\\\[|\$\$)[ \t]*$/m.test(clean);
  const hasLatexCmd = /\\[a-zA-Z]{2,}/.test(clean);
  const hasInlineMath = /\$[^\n$]+\$/m.test(clean) || /\\\(.+\\\)/m.test(clean);
  const hasDisplayMath = /\\\[.+\\\]/s.test(clean) || /\$\$[\s\S]+\$\$/.test(clean);
  const hasMathSymbols = /[√∑∏∫∞±≤≥≠×÷∈∂]/.test(clean);

  return hasFence || hasLatexCmd || hasInlineMath || hasDisplayMath || hasMathSymbols;
}

// ── Markdown pipe-table helpers ──────────────────────────────────────────────
// A table row contains at least one pipe character; the separator row is only dashes/colons/pipes/
// spaces and contains at least one dash ("| --- | :--: |").
function isTableRow(l) { return l.includes('|') && l.trim().length > 1; }
function isTableSep(l) { return /^\s*\|?[\s:|\\-]*-[\s:|\\-]*\|?\s*$/.test(l) && l.includes("-"); }
// Split "| a | b |" into ["a", "b"] (drop the leading/trailing pipe).
function splitTableRow(l) {
  let s = l.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

// Main parser: pasted markdown-with-math → HTML (headings, lists, tables, math).
export function parseMarkdownMathToHtml(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let html = "";
  let headingSeen = false;

  // Stack tracks open lists: { type: 'ul' | 'ol', indent: number }
  const listStack = [];

  const flushList = () => {
    while (listStack.length > 0) {
      html += `</li></${listStack.pop().type}>`;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") { flushList(); i++; continue; }

    // Horizontal rule ("---", "***", "___") → skip entirely to keep document clean
    if (/^[-*_]{3,}$/.test(trimmed)) { flushList(); i++; continue; }

    // Markdown pipe table: a "| a | b |" header row followed by a
    // "| --- | --- |" separator, then "| … | … |" body rows → a real <table>.
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushList();
      const header = splitTableRow(line);
      const cols = header.length;
      i += 2; // consume header + separator
      const body = [];
      while (i < lines.length && isTableRow(lines[i]) && !isTableSep(lines[i])) {
        body.push(splitTableRow(lines[i]));
        i++;
      }
      const fit = (row) => { const r = row.slice(0, cols); while (r.length < cols) r.push(""); return r; };
      const cell = (c, tag) => `<${tag}><p>${mmInlineToHtml(c || "")}</p></${tag}>`;
      let t = "<table><tbody><tr>" + fit(header).map((c) => cell(c, "th")).join("") + "</tr>";
      for (const row of body) t += "<tr>" + fit(row).map((c) => cell(c, "td")).join("") + "</tr>";
      t += "</tbody></table>";
      html += t;
      continue;
    }

    // 1. Single-line display math fence: e.g. "[ P(x) = 1 ]" or "\[ P(x) = 1 \]" or "$$ P(x) = 1 $$"
    const singleLineMatch = trimmed.match(/^(?:\[|\\\[|\$\$)\s*(.+?)\s*(?:\]|\\\]|\$\$)$/);
    if (singleLineMatch && !/^\d+[.)]/.test(singleLineMatch[1])) {
      flushList();
      const spanHtml = mathSpan(singleLineMatch[1].replace(/={3,}/g, "=").trim(), true);
      html += `<p>${spanHtml}</p>`;
      i++;
      continue;
    }

    // 2. Multi-line display-math fence opened by a line that is strictly [ , \[ or $$
    let openDelim = null, closeDelim = null;
    if (trimmed === "[") { openDelim = "["; closeDelim = "]"; }
    else if (trimmed === "\\[") { openDelim = "\\["; closeDelim = "\\]"; }
    else if (trimmed === "$$") { openDelim = "$$"; closeDelim = "$$"; }
    if (openDelim) {
      const body = []; i++;
      while (i < lines.length) {
        let cl = lines[i];
        let trimmedCl = cl.trim();

        // Check if this line is the standalone fence closer (e.g. "]", "\]", "$$")
        const isCloser = (closeDelim === "]" && (trimmedCl === "]" || trimmedCl === "\\]")) ||
                         (closeDelim === "\\]" && (trimmedCl === "\\]" || trimmedCl === "]")) ||
                         (closeDelim === "$$" && trimmedCl === "$$");

        if (isCloser) {
          i++;
          break;
        }

        cl = cl.replace(/={3,}/g, "="); // Convert multiple equal signs to a single one inside math formulas
        body.push(cl);
        i++;
      }
      flushList();
      const spanHtml = mathSpan(body.join(" ").replace(/\s+/g, " ").trim(), true);
      const lastPIndex = html.lastIndexOf("<p>");
      const lastP = lastPIndex !== -1 ? html.slice(lastPIndex) : "";
      if (html.endsWith("</p>") && lastP.includes('data-display="true"')) {
        html = html.slice(0, -4) + spanHtml + "</p>";
      } else {
        html += `<p>${spanHtml}</p>`;
      }
      continue;
    }

    // Markdown heading
    const hm = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      flushList();
      const lvl = Math.min(hm[1].length, 3);
      const cleaned = stripHeadingPrefix(hm[2]);
      headingSeen = true;
      html += `<h${lvl}>${mmInlineToHtml(cleaned)}</h${lvl}>`;
      i++;
      continue;
    }

    // Section header detection (e.g. "3.2 Attention", "3.2.1 Scaled Dot-Product Attention", "1. Introduction", "Section 3.2:")
    const plainSec = trimmed.replace(/^[*_]{1,3}/, "").replace(/[*_]{1,3}$/, "").trim();
    const secHeadMatch = plainSec.match(/^(?:Section\s+)?(\d+(?:\.\d+)*)[.)]?\s+(.+)$/i);
    if (secHeadMatch) {
      flushList();
      const secNum = secHeadMatch[1];
      const secTitle = stripHeadingPrefix(secHeadMatch[2]);
      const dots = (secNum.match(/\./g) || []).length;
      const lvl = Math.min(3, Math.max(1, dots + 1));
      headingSeen = true;
      html += `<h${lvl}>${mmInlineToHtml(secTitle || secHeadMatch[2])}</h${lvl}>`;
      i++;
      continue;
    }

    // List item check (bullet, number, or letter/roman list)
    // This MUST come before plain-text heading detection, because list markers
    // (* - • 1.) are unambiguous — they should always win over a heuristic guess.
    const lm = line.match(/^(\s*)(?:([*\-+•◦▪])|(\d+)[.)]|([a-zA-Z])[.)])\s+(.*)$/);
    if (lm) {

      const indent = lm[1].replace(/\t/g, "    ").length;
      const type = lm[2] ? "ul" : "ol";
      const content = lm[5].trim();

      // Close deeper lists
      while (listStack.length > 0 && indent < listStack[listStack.length - 1].indent) {
        html += `</li></${listStack.pop().type}>`;
      }

      if (listStack.length === 0 || indent > listStack[listStack.length - 1].indent) {
        // Open new list
        listStack.push({ type, indent });
        html += `<${type}>`;
      } else if (indent === listStack[listStack.length - 1].indent) {
        if (listStack[listStack.length - 1].type !== type) {
          // Different type at same level: close old list, open new
          html += `</li></${listStack.pop().type}>`;
          listStack.push({ type, indent });
          html += `<${type}>`;
        } else {
          // Same list, close the previous item
          html += `</li>`;
        }
      }

      const itemDfn = mmDefLine(content);
      if (itemDfn) {
        const itemHtml = mathSpan(itemDfn.lhs + " = \\text{" + mmTextEscape(itemDfn.rhs) + "}", false);
        html += `<li><p>${itemHtml}</p>`;
      } else {
        html += `<li><p>${mmInlineToHtml(content)}</p>`;
      }
      i++;
      continue;
    }

    // Standalone definition / legend line
    const dfn = mmDefLine(trimmed);
    if (dfn) { flushList(); html += `<p>${mathSpan(dfn.lhs + " = \\text{" + mmTextEscape(dfn.rhs) + "}", false)}</p>`; i++; continue; }

    // Multi-line or single-line explicit LaTeX formula block detection
    const isLatexLine = (l) => {
      const tr = (l || "").trim();
      if (!tr) return false;
      if (/^\s*[*+\-•◦▪]\s/.test(tr) || /^\s*\d+[.)]\s/.test(tr)) return false; // Markdown list items must NOT be grouped as latex formula blocks
      if (/^[\[\]$$]/.test(tr)) return false; // display fence handled above
      if (/^\s*\\(text|frac|dfrac|tfrac|mathrm|mathbf|mathit|sum|prod|int|alpha|beta|theta|sigma|mu|lambda|phi|psi|omega|infty|pm|times|div|leq|geq|neq|partial|nabla|left|right|begin|end|underbrace|overbrace|mathbf)\b/.test(tr)) return true;
      if (/^[\\{}]/.test(tr)) return true;
      if (/^[=+\-*/×÷]\s*(\\|\{|\w)/.test(tr) || /^=\s*$/.test(tr)) return true;
      if (tr.includes('\\') && /\\[a-zA-Z]{2,}/.test(tr) && !tr.includes('http')) return true;
      return false;
    };

    if (isLatexLine(trimmed)) {
      const latexBlock = [];
      while (i < lines.length && isLatexLine(lines[i])) {
        let l = lines[i].trim();
        const bsIdx = l.indexOf('\\');
        if (bsIdx > 0 && !/^\\[a-zA-Z]/.test(l) && !/^\{/.test(l)) {
          const postBs = l.slice(bsIdx);
          if (/^\\[a-zA-Z]{2,}/.test(postBs)) {
            l = postBs;
          }
        }
        latexBlock.push(l);
        i++;
      }
      flushList();
      const combinedLatex = convUnicodeMath(latexBlock.join(" ").replace(/\s+/g, " ").trim());
      const spanHtml = mathSpan(combinedLatex, true);
      const lastPIndex = html.lastIndexOf("<p>");
      const lastP = lastPIndex !== -1 ? html.slice(lastPIndex) : "";
      if (html.endsWith("</p>") && lastP.includes('data-display="true"')) {
        html = html.slice(0, -4) + spanHtml + "</p>";
      } else {
        html += `<p>${spanHtml}</p>`;
      }
      continue;
    }

    // Explicit-LaTeX line fallback → display math
    flushList();
    const convLine = convUnicodeMath(trimmed);
    const isFullyWrapped = 
      (trimmed.startsWith('$$') && trimmed.endsWith('$$')) ||
      (trimmed.startsWith('$') && trimmed.endsWith('$')) ||
      (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) ||
      (trimmed.startsWith('\\[') && trimmed.endsWith('\\]'));
    const hasInlineDelim = trimmed.includes('$') || trimmed.includes('\\(') || trimmed.includes('\\[');
    const isMixedLine = hasInlineDelim && !isFullyWrapped;

    const hasExplicitLatex = /\\[a-zA-Z]+/.test(trimmed) && mmWordy(trimmed) <= 10 && !isMixedLine;
    if (hasExplicitLatex || (convLine !== trimmed && mmMathScore(convLine) && mmWordy(convLine) <= 4)) {
      const spanHtml = mathSpan(convLine.replace(/\s+/g, " ").trim(), true);
      const lastPIndex = html.lastIndexOf("<p>");
      const lastP = lastPIndex !== -1 ? html.slice(lastPIndex) : "";
      if (html.endsWith("</p>") && lastP.includes('data-display="true"')) {
        html = html.slice(0, -4) + spanHtml + "</p>";
      } else {
        html += `<p>${spanHtml}</p>`;
      }
      i++; continue;
    }

    // Plain paragraph (with lead-in bold label like "Decoder:", "Note:", "Figure 1:")
    const leadInMatch = trimmed.match(/^([A-Z][A-Za-z0-9\s\-/]{1,35}:)\s+(.*)$/);
    if (leadInMatch) {
      const label = escapeHtml(leadInMatch[1]);
      const rest = leadInMatch[2];
      html += `<p><strong>${label}</strong> ${mmInlineToHtml(rest)}</p>`;
    } else {
      html += `<p>${mmInlineToHtml(trimmed)}</p>`;
    }
    i++;
  }
  flushList();
  return html || "<p></p>";
}
