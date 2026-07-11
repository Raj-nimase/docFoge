import { API_BASE_URL } from "@/services/api";
const API_BASE = API_BASE_URL;

// Unicode → LaTeX symbol map
const UNICODE_MAP = {
  π: "\\pi ",
  α: "\\alpha ",
  β: "\\beta ",
  θ: "\\theta ",
  σ: "\\sigma ",
  μ: "\\mu ",
  "√": "\\sqrt ",
  "∞": "\\infty ",
  "±": "\\pm ",
  "×": "\\times ",
  "÷": "\\div ",
  "≤": "\\leq ",
  "≥": "\\geq ",
  "≠": "\\neq ",
  "²": "^2",
  "³": "^3",
  "∂": "\\partial ",
  "∇": "\\nabla ",
  λ: "\\lambda ",
  γ: "\\gamma ",
  δ: "\\delta ",
  ε: "\\epsilon ",
  φ: "\\phi ",
  ψ: "\\psi ",
  ω: "\\omega ",
};

/**
 * Extracts clean LaTeX from a single formula string.
 * Only called on content already known to be a formula.
 */
export function extractLatex(formulaText) {
  let cleaned = formulaText.trim();

  // Map unicode symbols to LaTeX commands
  for (const [unicode, latex] of Object.entries(UNICODE_MAP)) {
    cleaned = cleaned.replaceAll(unicode, latex);
  }

  return cleaned;
}

/**
 * Checks if a SINGLE LINE looks like a standalone math formula.
 * MUST be conservative — headings, bullets, and prose should NOT match.
 */
export function isSingleFormula(line) {
  const trimmed = line.trim();

  // Skip empty lines
  if (!trimmed) return false;

  // Skip lines that look like markdown headings, bullets, or prose
  if (/^#{1,6}\s/.test(trimmed)) return false; // ## Heading
  if (/^[-*]\s/.test(trimmed)) return false; // - bullet
  if (/^---+$/.test(trimmed)) return false; // --- divider
  if (trimmed.split(/\s+/).length > 15) return false; // prose sentences

  // It IS a formula if it's wrapped in $...$
  if (/^\$[\s\S]+?\$$/.test(trimmed)) return true;

  // It IS a formula if it's wrapped in \(...\) or \[...\]
  if (/^\\\[(\[][\s\S]+?\\\[)\]]$/.test(trimmed)) return true;

  // It IS a formula if it's a short expression with LaTeX commands
  // (e.g. "x = \dfrac{-b}{2a}") but NOT a sentence that happens to
  // contain a backslash
  if (/\\[a-zA-Z]+\{/.test(trimmed) && trimmed.length < 200) return true;

  // It IS a formula if it contains explicit math unicode and is short
  if (/[π√∫²³±×÷≤≥≠∞]/.test(trimmed) && trimmed.length < 100) return true;

  return false;
}

/**
 * PDF math garble often has random spaces between chars, mixed case, no LaTeX.
 */
export function isPdfGarble(text) {
  const hasNoLatex = !/\\[a-zA-Z]/.test(text);
  const hasSpacedChars = /[a-zA-Z] [a-zA-Z] [a-zA-Z]/.test(text);
  const hasMathSymbols = /[=\+\-\/\(\)]/.test(text);
  return hasNoLatex && hasSpacedChars && hasMathSymbols;
}

import { MathMLToLaTeX } from "mathml-to-latex";

/**
 * Transforms clipboard HTML to replace <math> nodes with TipTap math spans,
 * strip heading prefixes, and remove <hr> / divider paragraphs.
 *
 * PERF: Uses a single TreeWalker pass to classify every element in one
 * traversal, instead of 5 separate querySelectorAll calls that each walked
 * the entire DOM independently. Nodes are collected first, then mutated
 * after the walk completes (DOM mutation during a TreeWalker is unsafe).
 */
export function transformMathHtml(html) {
  if (!html) return html;

  // ── Cheap text-level gate ─────────────────────────────────────────────
  const hasMath = html.includes("<math") || html.includes("katex");
  const hasHeading = /<h[1-6][>\s]/i.test(html);
  const hasHr = html.includes("<hr");
  if (!hasMath && !hasHeading && !hasHr) return html;

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // ── Single TreeWalker: collect all interesting nodes ─────────────────
    const mathNodes = [];
    const headingNodes = [];
    const katexNodes = [];
    const toRemove = []; // <hr> and divider <p> elements

    const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);

    let node;
    while ((node = walker.nextNode())) {
      const tag = node.tagName;

      if (tag === "MATH") {
        mathNodes.push(node);
      } else if (/^H[1-6]$/.test(tag)) {
        headingNodes.push(node);
      } else if (tag === "HR") {
        toRemove.push(node);
      } else if (tag === "P" && /^[-*_]{3,}$/.test(node.textContent.trim())) {
        toRemove.push(node);
      } else if (node.classList?.contains("katex-html")) {
        katexNodes.push(node);
      }
    }

    // ── Process headings (prefix stripping, list-item demotion) ──────────
    for (const headingEl of headingNodes) {
      let text = headingEl.textContent.trim();
      if (!text) continue;

      // If the heading is actually a list item like "a) Narrow AI" or "i. Something",
      // convert it to a bold paragraph so it isn't treated as a sub-sub-heading.
      if (/^([a-zA-Z]|(?:i|ii|iii|iv|v|vi|vii|viii|ix|x))[.)]\s+/i.test(text)) {
        const p = doc.createElement("p");
        p.innerHTML = `<strong>${headingEl.innerHTML}</strong>`;
        headingEl.parentNode.replaceChild(p, headingEl);
        continue;
      }

      // 1. Strip section prefixes like "3.1 " or "2.4.1 "
      const prefixMatch = text.match(/^(\d+(?:\.\d+)+)[^\S\n]+(.*)/);
      if (prefixMatch) {
        text = prefixMatch[2].trim();
      }

      // 2. Split heading and paragraph if it's too long
      const { heading, paragraph } = splitHeadingAndParagraph(text);
      headingEl.textContent = heading;

      if (paragraph.trim()) {
        const p = doc.createElement("p");
        p.textContent = paragraph;

        // Insert the paragraph right after the heading element
        if (headingEl.nextSibling) {
          headingEl.parentNode.insertBefore(p, headingEl.nextSibling);
        } else {
          headingEl.parentNode.appendChild(p);
        }
      }
    }

    // ── Process MathML ──────────────────────────────────────────────────
    if (hasMath) {
      for (const mathNode of mathNodes) {
        try {
          let latex = "";
          // KaTeX and some other renderers embed the raw LaTeX inside an annotation tag
          const annotation = mathNode.querySelector(
            'annotation[encoding="application/x-tex"]',
          );
          if (annotation && annotation.textContent) {
            latex = annotation.textContent;
          } else {
            // Fallback for Word/Docs standard MathML
            latex = MathMLToLaTeX.convert(mathNode.outerHTML);
          }

          const cleanLatex = extractLatex(latex);
          const span = doc.createElement("span");
          span.setAttribute("data-latex", cleanLatex);
          mathNode.parentNode.replaceChild(span, mathNode);
        } catch (e) {
          console.error("MathML convert error:", e);
        }
      }

      // Remove KaTeX visual-only duplicates
      for (const node of katexNodes) node.remove();
    }

    // ── Remove <hr> and divider <p> ─────────────────────────────────────
    for (const node of toRemove) node.remove();

    const finalHtml = doc.body
      ? doc.body.innerHTML
      : doc.documentElement.outerHTML;

    // Send debug info to backend (fire and forget)
    fetch(`${API_BASE}/debug`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: `ORIGINAL:\n${html}\n\nTRANSFORMED:\n${finalHtml}`,
      }),
    }).catch(() => {});

    return finalHtml;
  } catch (err) {
    console.error("Failed to transform math HTML:", err);
  }

  return html;
}

export function normalizeListText(text) {
  let normalized = text;

  // 1. Add newlines and indent before inline bullets (e.g. " • ") to ensure they nest properly
  normalized = normalized.replace(
    /([^\n])[^\S\n]+([•◦▪*\-])[^\S\n]+/g,
    "$1\n    $2 ",
  );

  // 2. Add newlines before inline numbered items (e.g. " 2.Working")
  normalized = normalized.replace(
    /([^\n])[^\S\n]+(\d+\.)\s*([a-zA-Z])/g,
    "$1\n$2 $3",
  );

  // 3. Normalize the very start of the string if it's a number without space (e.g. "1.Specifications")
  normalized = normalized.replace(
    /^([^\S\n]*)(\d+\.)\s*([a-zA-Z])/gm,
    "$1$2 $3",
  );

  // 4. Add newlines before section headings (e.g. " 2.4 Modern")
  normalized = normalized.replace(
    /([^\n])[^\S\n]+(\d+(?:\.\d+)+)[^\S\n]+([A-Z])/g,
    "$1\n$2 $3",
  );

  return normalized;
}

function splitHeadingAndParagraph(text) {
  const stopWords = new Set([
    "a",
    "an",
    "the",
    "and",
    "but",
    "or",
    "for",
    "nor",
    "on",
    "at",
    "to",
    "from",
    "by",
    "with",
    "of",
    "in",
    "as",
  ]);
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return { heading: text, paragraph: "" };

  let splitIdx = words.length;
  for (let i = 0; i < words.length - 1; i++) {
    const word = words[i];
    const nextWord = words[i + 1];

    const isCap = /^[A-Z]/.test(word);
    const nextIsLower = /^[a-z]/.test(nextWord);
    const nextIsStop = stopWords.has(nextWord.toLowerCase());

    if (isCap && nextIsLower && !nextIsStop) {
      splitIdx = i;
      break;
    }
  }

  if (splitIdx === 0 || splitIdx > 8) {
    splitIdx = Math.min(4, words.length);
  }

  const heading = words.slice(0, splitIdx).join(" ");
  const paragraph = words.slice(splitIdx).join(" ");
  return { heading, paragraph };
}

export function textToHtmlList(text) {
  const normalizedText = normalizeListText(text);
  const lines = normalizedText.split("\n");
  let html = "";

  // Stack tracks open lists: { type: 'ul' | 'ol', indent: number }
  const stack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }

    const indentMatch = line.match(/^([^\S\n]*)/);
    const indent = indentMatch[1].replace(/\t/g, "    ").length;

    const bulletMatch = line.match(/^[^\S\n]*([•◦▪*\-])[^\S\n]+(.*)/);
    let numberMatch = line.match(/^[^\S\n]*(\d+)\.[^\S\n]+(.*)/);
    const sectionMatch = line.match(/^[^\S\n]*(\d+(?:\.\d+)+)[^\S\n]+(.*)/);

    if (!numberMatch) {
      const noSpaceMatch = line.match(/^[^\S\n]*(\d+)\.([a-zA-Z].*)/);
      if (noSpaceMatch) {
        numberMatch = [noSpaceMatch[0], noSpaceMatch[1], noSpaceMatch[2]];
      }
    }

    if (sectionMatch) {
      // Close all open lists when encountering a section heading
      while (stack.length > 0) {
        html += `</li></${stack.pop().type}>`;
      }

      const sectionNum = sectionMatch[1]; // e.g., "2.3" or "2.3.1"
      const sectionText = sectionMatch[2];
      const dots = (sectionNum.match(/\./g) || []).length;

      // h2 for 1 dot (X.Y), h3 for 2 dots (X.Y.Z)
      const level = Math.min(6, dots + 1);

      const { heading, paragraph } = splitHeadingAndParagraph(sectionText);
      console.log("[DEBUG] Split heading successfully:", {
        heading,
        paragraph,
        level,
      });
      html += `<h${level}>${heading}</h${level}>`;

      if (paragraph.trim()) {
        html += `<p>${paragraph.trim()}</p>`;
      }
      continue;
    }

    if (bulletMatch || numberMatch) {
      const type = bulletMatch ? "ul" : "ol";
      const content = bulletMatch ? bulletMatch[2] : numberMatch[2];

      // Close deeper lists
      while (stack.length > 0 && indent < stack[stack.length - 1].indent) {
        html += `</li></${stack.pop().type}>`;
      }

      if (stack.length === 0 || indent > stack[stack.length - 1].indent) {
        // Open new list
        stack.push({ type, indent });
        html += `<${type}>`;
      } else if (
        stack.length > 0 &&
        indent === stack[stack.length - 1].indent
      ) {
        if (stack[stack.length - 1].type !== type) {
          // Different type at same level: close old list, open new
          html += `</li></${stack.pop().type}>`;
          stack.push({ type, indent });
          html += `<${type}>`;
        } else {
          // Same list, close the previous item
          html += `</li>`;
        }
      }

      // Open new item, but don't close </li> yet to allow nesting
      html += `<li><p>${content}</p>`;
    } else {
      // Not a list item, close all open lists
      while (stack.length > 0) {
        html += `</li></${stack.pop().type}>`;
      }
      html += `<p>${line.trim()}</p>`;
    }
  }

  // Close any remaining lists
  while (stack.length > 0) {
    html += `</li></${stack.pop().type}>`;
  }

  return html;
}

export function looksLikeList(text) {
  const normalizedText = normalizeListText(text);
  const lines = normalizedText.split("\n");
  return lines.some((line) => {
    return (
      /^[^\S\n]*[•◦▪*\-][^\S\n]+/.test(line) ||
      /^[^\S\n]*\d+\.[^\S\n]+/.test(line) ||
      /^[^\S\n]*\d+\.[a-zA-Z]/.test(line) ||
      /^[^\S\n]*\d+(?:\.\d+)+[^\S\n]+/.test(line)
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown-with-math parser (ported from the mobile AcaDoc editor).
//
// Converts a pasted plain-text "formula sheet" — blank-line-separated headings,
// `[ … ]` / `\[ … \]` / `$$ … $$` display fences, "X = description" legend
// lines, bullet lists and inline `$…$` / `\(…\)` math — into HTML that TipTap
// parses into real heading / list / math nodes. Mirrors the mobile mmParse so
// both editors behave identically.
// ─────────────────────────────────────────────────────────────────────────────

// Unicode super/subscripts and math symbols → LaTeX.
const MM_SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-", "⁼": "=", "⁽": "(", "⁾": ")", "ⁿ": "n", "ⁱ": "i" };
const MM_SUB = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9", "₊": "+", "₋": "-", "₌": "=", "₍": "(", "₎": ")", "ₙ": "n", "ₓ": "x", "ₐ": "a", "ₑ": "e", "ᵢ": "i", "ⱼ": "j" };
const MM_SYM = { "−": "-", "–": "-", "—": "-", "×": "\\times ", "÷": "\\div ", "·": "\\cdot ", "⋅": "\\cdot ", "∗": "*", "±": "\\pm ", "∓": "\\mp ", "≤": "\\le ", "≥": "\\ge ", "≠": "\\ne ", "≈": "\\approx ", "≡": "\\equiv ", "∞": "\\infty ", "∑": "\\sum ", "∏": "\\prod ", "∫": "\\int ", "∂": "\\partial ", "∇": "\\nabla ", "√": "\\sqrt ", "→": "\\to ", "←": "\\gets ", "⇒": "\\Rightarrow ", "⇔": "\\Leftrightarrow ", "∈": "\\in ", "∉": "\\notin ", "⊂": "\\subset ", "⊆": "\\subseteq ", "∪": "\\cup ", "∩": "\\cap ", "∅": "\\emptyset ", "∀": "\\forall ", "∃": "\\exists ", "∝": "\\propto ", "°": "^{\\circ}", "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ", "ε": "\\epsilon ", "ζ": "\\zeta ", "η": "\\eta ", "θ": "\\theta ", "ι": "\\iota ", "κ": "\\kappa ", "λ": "\\lambda ", "μ": "\\mu ", "ν": "\\nu ", "ξ": "\\xi ", "π": "\\pi ", "ρ": "\\rho ", "σ": "\\sigma ", "τ": "\\tau ", "υ": "\\upsilon ", "φ": "\\phi ", "χ": "\\chi ", "ψ": "\\psi ", "ω": "\\omega ", "Γ": "\\Gamma ", "Δ": "\\Delta ", "Θ": "\\Theta ", "Λ": "\\Lambda ", "Ξ": "\\Xi ", "Π": "\\Pi ", "Σ": "\\Sigma ", "Φ": "\\Phi ", "Ψ": "\\Psi ", "Ω": "\\Omega " };

// Convert unicode super/subscripts and symbols to LaTeX (θ→\theta, ×→\times, …).
export function convUnicodeMath(s) {
  if (!s) return s;
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+/g, (m) => { let r = ""; for (const c of m) r += MM_SUP[c] || c; return "^{" + r + "}"; });
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₙₓₐₑᵢⱼ]+/g, (m) => { let r = ""; for (const c of m) r += MM_SUB[c] || c; return "_{" + r + "}"; });
  s = s.replace(/[−–—×÷·⋅∗±∓≤≥≠≈≡∞∑∏∫∂∇√→←⇒⇔∈∉⊂⊆∪∩∅∀∃∝°αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΦΨΩ]/g, (c) => MM_SYM[c] || c);
  return s;
}

// Strip characters KaTeX can't render (U+FFFD, control, zero-width, bidi marks)
// and escape a bare '%' so a stray glyph never turns a formula into a red error.
export function sanitizeLatex(latex) {
  let cleaned = (latex || "")
    // eslint-disable-next-line no-control-regex -- intentional control/invisible-char strip
    .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/(^|[^\\])%/g, "$1\\%");
    
  // Strip all unescaped $ signs to prevent KaTeX syntax rendering errors
  cleaned = cleaned.replace(/\\\$|(\$)/g, (match, group1) => group1 ? '' : match);
  
  return cleaned;
}

// Last-resort strip: drop every non-ASCII glyph (e.g. the middle dot in "N·m").
export function stripUnknownChars(latex) {
  return (latex || "").replace(/[^\x20-\x7E]/g, "");
}

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
  const eq = s.indexOf("=");
  if (eq <= 0) return null;
  if (s.charAt(eq + 1) === "=" || "<>!".indexOf(s.charAt(eq - 1)) !== -1) return null; // ==, <=, >=, !=
  let lhs = s.slice(0, eq).trim();
  const rhs = s.slice(eq + 1).trim();
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
// Convert markdown **bold** / `code` in already-HTML-escaped text into tags
// (so pasted "* **Stator:** …" keeps its bold instead of showing raw asterisks).
function mmInlineMd(escaped) {
  return escaped
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>");
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
export function looksLikeMarkdownMath(text) {
  if (!text) return false;
  const hasFence = /^[ \t]*(\[|\\\[|\$\$)[ \t]*$/m.test(text);
  const multiline = /\n/.test(text);
  const hasLatexCmd = /\\[a-zA-Z]/.test(text);
  const hasDef = /^[ \t]*[-*]?[ \t]*[^\n=]{1,24}=[^\n]{1,80}$/m.test(text);
  // A markdown pipe table (row + dashed separator) is also worth structured
  // parsing so it renders as a real <table> rather than raw "| … |" text.
  const hasTable = /^\s*\|.*\|\s*$/m.test(text) && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/m.test(text);
  return hasFence || hasTable || (multiline && hasLatexCmd && hasDef);
}

// ── Markdown pipe-table helpers ──────────────────────────────────────────────
// A table row is "| … | … |"; the separator row is only dashes/colons/pipes/
// spaces and contains at least one dash ("| --- | :--: |").
function isTableRow(l) { return /^\s*\|.*\|\s*$/.test(l); }
function isTableSep(l) { return /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes("-"); }
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
  let listItems = null;
  let headingSeen = false;

  const flushList = () => {
    if (listItems && listItems.length) {
      html += "<ul>" + listItems.map((li) => `<li><p>${li || ""}</p></li>`).join("") + "</ul>";
    }
    listItems = null;
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

    // Display-math fence opened by a line that is just [ , \[ or $$
    let openDelim = null, closeDelim = null;
    if (trimmed === "[") { openDelim = "["; closeDelim = "]"; }
    else if (trimmed === "\\[") { openDelim = "\\["; closeDelim = "\\]"; }
    else if (trimmed === "$$") { openDelim = "$$"; closeDelim = "$$"; }
    if (openDelim) {
      const body = []; i++;
      while (i < lines.length) {
        const cl = lines[i];
        const idx = mmFindClose(cl, closeDelim);
        if (idx !== -1) {
          const before = cl.slice(0, idx);
          if (before.trim()) body.push(before);
          const remainder = cl.slice(idx + closeDelim.length);
          if (remainder && remainder.trim()) { lines[i] = remainder; } else { i++; }
          break;
        }
        body.push(cl); i++;
      }
      flushList();
      html += `<p>${mathSpan(body.join(" ").replace(/\s+/g, " ").trim(), true)}</p>`;
      continue;
    }

    // Markdown heading
    const hm = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (hm) { flushList(); const lvl = Math.min(hm[1].length, 3); html += `<h${lvl}>${escapeHtml(mmCleanText(hm[2]))}</h${lvl}>`; i++; continue; }

    // Bullet — a "- X = description" item becomes its own math line
    const bm = line.match(/^\s*[*\-+]\s+(.*)$/);
    if (bm) {
      const bItem = bm[1].trim();
      const bdef = mmDefLine(bItem);
      if (bdef) { flushList(); html += `<p>${mathSpan(bdef.lhs + " = \\text{" + mmTextEscape(bdef.rhs) + "}", false)}</p>`; i++; continue; }
      if (!listItems) listItems = [];
      listItems.push(mmInlineToHtml(bItem));
      i++; continue;
    }

    // Plain-text heading detection (stands alone, short, no sentence ending)
    const prevBlank = i === 0 || lines[i - 1].trim() === "";
    const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === "";
    const numHead = trimmed.match(/^\d+[.)]\s+(.+)$/);
    const headText = (numHead ? numHead[1] : trimmed).trim();
    const headWords = headText.split(/\s+/).length;
    if (prevBlank && nextBlank && headText.length <= 64 && headWords <= 8 &&
      /[A-Za-z]/.test(headText) && !/[.:,;]$/.test(headText) &&
      !mmLooksMathy(headText) && !mmMathScore(headText) && !mmDefLine(trimmed)) {
      flushList();
      const lvl = numHead ? 3 : headingSeen ? 2 : 1;
      headingSeen = true;
      html += `<h${lvl}>${escapeHtml(mmCleanText(headText))}</h${lvl}>`;
      i++; continue;
    }

    // Standalone definition / legend line
    const dfn = mmDefLine(trimmed);
    if (dfn) { flushList(); html += `<p>${mathSpan(dfn.lhs + " = \\text{" + mmTextEscape(dfn.rhs) + "}", false)}</p>`; i++; continue; }

    // Explicit-LaTeX line → display math
    flushList();
    const convLine = convUnicodeMath(trimmed);
    const hasExplicitLatex = /\\[a-zA-Z]+/.test(trimmed) && mmWordy(trimmed) <= 10;
    if (hasExplicitLatex || (convLine !== trimmed && mmMathScore(convLine) && mmWordy(convLine) <= 4)) {
      html += `<p>${mathSpan(convLine.replace(/\s+/g, " ").trim(), true)}</p>`;
      i++; continue;
    }

    // Plain paragraph (with any inline math)
    html += `<p>${mmInlineToHtml(trimmed)}</p>`;
    i++;
  }
  flushList();
  return html || "<p></p>";
}

export function handleRichPaste(view, event, editor) {
  const plainText = event.clipboardData?.getData("text/plain") || "";
  const htmlText = event.clipboardData?.getData("text/html") || "";

  // ── Fast exit: nothing to intercept ───────────────────────────────────
  // If the plain text contains no math indicators (backslash, dollar sign,
  // <math tag) AND no list indicators (bullets or "1. "-style prefixes),
  // skip all detection and let TipTap's default paste handle it.
  // This is the single highest-leverage optimisation for the common case
  // of pasting plain paragraphs with zero LaTeX or list structure.
  const looksLikeMath = /[\\$]|<math/.test(plainText);
  const looksLikeListContent = /^[\s]*[•◦▪*\-]\s|^\s*\d+\.\s/m.test(plainText);
  if (!looksLikeMath && !looksLikeListContent) {
    return false;
  }

  // Priority 1: structured markdown-with-math (formula sheets — e.g. a report
  // with "[ … ]" display fences, "X = Torque (N·m)" legend lines and markdown
  // headings/bullets). Parse the plain text into headings / lists / math spans.
  //
  // We only defer to the default HTML path when the clipboard carries GENUINE
  // math markup (MathML / KaTeX) — that is higher fidelity than re-parsing text.
  // When the HTML is merely rendered markdown (headings / lists but no <math>),
  // OUR parser is better: it also converts the "[ … ]" LaTeX fences that the
  // HTML path leaves as raw text (which is exactly why the formulas "weren't
  // converting to KaTeX" on a full-document markdown paste).
  const htmlHasRealMath = /<math[\s>]|class=["']?[^"']*katex/i.test(htmlText);
  if (!htmlHasRealMath && looksLikeMarkdownMath(plainText)) {
    event.preventDefault();
    editor.commands.insertContent(parseMarkdownMathToHtml(plainText));
    return true;
  }

  // Priority 3: Garbled LaTeX or short unicode formulas from web/Claude
  // Only intercept if the ENTIRE paste looks like a single formula.
  // Mixed text should be handled by default TipTap paste rules.
  if (isSingleFormula(plainText)) {
    event.preventDefault();
    let formula = plainText.trim();
    const dollarMatch = formula.match(/^\$([\s\S]+?)\$$/);
    if (dollarMatch) {
      formula = dollarMatch[1].trim();
    }
    const cleanLatex = extractLatex(formula);

    const { state, dispatch } = view;
    const mathNode = state.schema.nodes.math?.create({ latex: cleanLatex });
    if (mathNode) {
      dispatch(state.tr.replaceSelectionWith(mathNode));
      return true;
    }
  }

  // Priority 4: Plain text with bullet points or numbered lists (PDF copy/paste)
  // Many PDF viewers (like Chrome) inject flat <p> or <span> tags without actual list structure into text/html.
  // If the HTML lacks actual semantic list tags, but the plain text looks like a list,
  // we intercept and use our smart list parser!
  const hasSemanticHtmlList = /<(ul|ol|li)[>\s]/i.test(htmlText);
  const isSquashedList = !plainText.includes("\n") && looksLikeList(plainText);

  if (
    isSquashedList ||
    ((!htmlText || !hasSemanticHtmlList) &&
      plainText &&
      looksLikeList(plainText))
  ) {
    event.preventDefault();
    const html = textToHtmlList(plainText);
    editor.commands.insertContent(html);
    return true;
  }

  return false;
}
