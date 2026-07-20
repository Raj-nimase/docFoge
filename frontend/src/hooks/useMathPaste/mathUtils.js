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
  if (!latex || typeof latex !== "string") return "";

  let cleaned = latex
    // Restore JS string control characters \u0009 (tab -> \t) and \u000C (formfeed -> \f)
    .replace(/\u0009ext/g, "\\text")
    .replace(/\u000Crac/g, "\\frac")
    .replace(/\u000C/g, "\\f")
    .replace(/\u0009/g, "\\t")
    // eslint-disable-next-line no-control-regex -- intentional control/invisible-char strip
    .replace(/[\uFFFD\u0000-\u0008\u000B\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/(^|[^\\])%/g, "$1\\%");

  // Fix OCR / Markdown artifact hashes:
  // 1. Replace '##' with '-' (minus sign)
  cleaned = cleaned.replace(/##/g, "-");

  // 2. Remove any remaining single unescaped '#' (that isn't \#)
  cleaned = cleaned.replace(/(^|[^\\])#/g, "$1");

  // Strip all unescaped $ signs to prevent KaTeX syntax rendering errors
  cleaned = cleaned.replace(/\\\$|(\$)/g, (match, group1) => group1 ? '' : match);
  
  return cleaned;
}

// Last-resort strip: drop every non-ASCII glyph (e.g. the middle dot in "N·m").
export function stripUnknownChars(latex) {
  return (latex || "").replace(/[^\x20-\x7E]/g, "");
}

/**
 * Normalizes multi-line raw LaTeX pastes (e.g. copied from web math renders or PDFs)
 * into a single unified LaTeX formula string before parsing.
 */
export function normalizeLatexPaste(text) {
  if (!text || typeof text !== "string") return text;

  // Single line: if it has squashed visual text before \command or $, strip the squashed visual text prefix
  if (!text.includes("\n")) {
    const trimmed = text.trim();
    const match = trimmed.match(/^.+?(\\[a-zA-Z]{2,}.*|\$.*|\\[(\[].*)$/);
    if (match && !/^\\[a-zA-Z]/.test(trimmed) && !/^\$/.test(trimmed) && !/^\\\(/.test(trimmed) && !/^\\\[/.test(trimmed)) {
      return match[1].trim();
    }
    return text;
  }

  const rawLines = text.split("\n");
  const isLatexPart = (l) => {
    const tr = (l || "").trim();
    if (!tr) return false;
    if (/^\s*[*+\-•◦▪]\s/.test(tr) || /^\s*\d+[.)]\s/.test(tr)) return false; // Markdown list items must NOT be grouped as latex formula blocks
    if (/^[\[\]$$]/.test(tr)) return false;
    if (/^\s*\\(text|frac|dfrac|tfrac|mathrm|mathbf|mathit|sum|prod|int|alpha|beta|theta|sigma|mu|lambda|phi|psi|omega|infty|pm|times|div|leq|geq|neq|partial|nabla|left|right|begin|end|underbrace|overbrace)\b/.test(tr)) return true;
    if (/^[\\{}]/.test(tr)) return true;
    if (/^[=+\-*/×÷]\s*/.test(tr) || /^=\s*$/.test(tr)) return true;
    if (tr.includes("\\") && /\\[a-zA-Z]{2,}/.test(tr) && !tr.includes("http")) return true;
    return false;
  };

  const outLines = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (isLatexPart(trimmed)) {
      const latexBlock = [];
      while (i < rawLines.length && isLatexPart(rawLines[i])) {
        let l = rawLines[i].trim();
        const bsIdx = l.indexOf("\\");
        if (bsIdx > 0 && !/^\\[a-zA-Z]/.test(l) && !/^\{/.test(l)) {
          const postBs = l.slice(bsIdx);
          if (/^\\[a-zA-Z]{2,}/.test(postBs)) {
            l = postBs;
          }
        }
        latexBlock.push(l);
        i++;
      }
      outLines.push(latexBlock.join(" "));
    } else {
      outLines.push(line);
      i++;
    }
  }

  return outLines.join("\n");
}
