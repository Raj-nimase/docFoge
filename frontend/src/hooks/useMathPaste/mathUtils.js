// Unicode → LaTeX symbol map
const UNICODE_MAP = {
  π: "\\pi ",
  α: "\\alpha ",
  β: "\\beta ",
  γ: "\\gamma ",
  δ: "\\delta ",
  ε: "\\epsilon ",
  ζ: "\\zeta ",
  η: "\\eta ",
  θ: "\\theta ",
  ι: "\\iota ",
  κ: "\\kappa ",
  λ: "\\lambda ",
  μ: "\\mu ",
  ν: "\\nu ",
  ξ: "\\xi ",
  ρ: "\\rho ",
  σ: "\\sigma ",
  τ: "\\tau ",
  υ: "\\upsilon ",
  φ: "\\phi ",
  χ: "\\chi ",
  ψ: "\\psi ",
  ω: "\\omega ",
  Γ: "\\Gamma ",
  Δ: "\\Delta ",
  Θ: "\\Theta ",
  Λ: "\\Lambda ",
  Ξ: "\\Xi ",
  Π: "\\Pi ",
  Σ: "\\Sigma ",
  Φ: "\\Phi ",
  Ψ: "\\Psi ",
  Ω: "\\Omega ",
  "√": "\\sqrt ",
  "∞": "\\infty ",
  "±": "\\pm ",
  "∓": "\\mp ",
  "×": "\\times ",
  "÷": "\\div ",
  "≤": "\\leq ",
  "≥": "\\geq ",
  "≠": "\\neq ",
  "≈": "\\approx ",
  "≡": "\\equiv ",
  "²": "^2",
  "³": "^3",
  "∂": "\\partial ",
  "∇": "\\nabla ",
  "∫": "\\int ",
  "∑": "\\sum ",
  "∏": "\\prod ",
  "∈": "\\in ",
  "∉": "\\notin ",
  "⊂": "\\subset ",
  "⊆": "\\subseteq ",
  "∪": "\\cup ",
  "∩": "\\cap ",
  "∅": "\\emptyset ",
  "∀": "\\forall ",
  "∃": "\\exists ",
  "∝": "\\propto ",
  "°": "^{\\circ}",
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

function mmWordy(s) {
  if (!s) return 0;
  // Strip LaTeX macro commands (\command) so names like \mathbb, \left, \right, \frac, \partial, etc. are not counted as prose words
  const clean = s.replace(/\\[a-zA-Z]+/g, "");
  const m = clean.match(/[A-Za-z]{3,}/g);
  return m ? m.length : 0;
}

/**
 * Checks if a SINGLE LINE looks like a standalone math formula.
 * MUST be conservative — headings, bullets, and prose should NOT match.
 */
export function isSingleFormula(line) {
  const trimmed = line.trim();

  // Skip empty lines
  if (!trimmed) return false;

  // Skip lines that look like markdown headings, bullets, emphasis, or prose
  if (/^#{1,6}\s/.test(trimmed)) return false; // ## Heading
  if (/^[-*•◦▪]\s/.test(trimmed)) return false; // - bullet
  if (/^\*[a-zA-Z]/.test(trimmed)) return false; // *italic text*
  if (/^---+$/.test(trimmed)) return false; // --- divider
  if (mmWordy(trimmed) > 3) return false; // prose sentences

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
const MM_SUP = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁺": "+",
  "⁻": "-",
  "⁼": "=",
  "⁽": "(",
  "⁾": ")",
  ⁿ: "n",
  ⁱ: "i",
};
const MM_SUB = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
  "₊": "+",
  "₋": "-",
  "₌": "=",
  "₍": "(",
  "₎": ")",
  ₙ: "n",
  ₓ: "x",
  ₐ: "a",
  ₑ: "e",
  ᵢ: "i",
  ⱼ: "j",
};
const MM_SYM = {
  "−": "-",
  "–": "-",
  "—": "-",
  "×": "\\times ",
  "÷": "\\div ",
  "·": "\\cdot ",
  "⋅": "\\cdot ",
  "∗": "*",
  "±": "\\pm ",
  "∓": "\\mp ",
  "≤": "\\le ",
  "≥": "\\ge ",
  "≠": "\\ne ",
  "≈": "\\approx ",
  "≡": "\\equiv ",
  "∞": "\\infty ",
  "∑": "\\sum ",
  "∏": "\\prod ",
  "∫": "\\int ",
  "∂": "\\partial ",
  "∇": "\\nabla ",
  "√": "\\sqrt ",
  "→": "\\to ",
  "←": "\\gets ",
  "⇒": "\\Rightarrow ",
  "⇔": "\\Leftrightarrow ",
  "∈": "\\in ",
  "∉": "\\notin ",
  "⊂": "\\subset ",
  "⊆": "\\subseteq ",
  "∪": "\\cup ",
  "∩": "\\cap ",
  "∅": "\\emptyset ",
  "∀": "\\forall ",
  "∃": "\\exists ",
  "∝": "\\propto ",
  "°": "^{\\circ}",
  α: "\\alpha ",
  β: "\\beta ",
  γ: "\\gamma ",
  δ: "\\delta ",
  ε: "\\epsilon ",
  ζ: "\\zeta ",
  η: "\\eta ",
  θ: "\\theta ",
  ι: "\\iota ",
  κ: "\\kappa ",
  λ: "\\lambda ",
  μ: "\\mu ",
  ν: "\\nu ",
  ξ: "\\xi ",
  π: "\\pi ",
  ρ: "\\rho ",
  σ: "\\sigma ",
  τ: "\\tau ",
  υ: "\\upsilon ",
  φ: "\\phi ",
  χ: "\\chi ",
  ψ: "\\psi ",
  ω: "\\omega ",
  Γ: "\\Gamma ",
  Δ: "\\Delta ",
  Θ: "\\Theta ",
  Λ: "\\Lambda ",
  Ξ: "\\Xi ",
  Π: "\\Pi ",
  Σ: "\\Sigma ",
  Φ: "\\Phi ",
  Ψ: "\\Psi ",
  Ω: "\\Omega ",
};

// Convert unicode super/subscripts and symbols to LaTeX (θ→\theta, ×→\times, …).
export function convUnicodeMath(s) {
  if (!s) return s;
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+/g, (m) => {
    let r = "";
    for (const c of m) r += MM_SUP[c] || c;
    return "^{" + r + "}";
  });
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₙₓₐₑᵢⱼ]+/g, (m) => {
    let r = "";
    for (const c of m) r += MM_SUB[c] || c;
    return "_{" + r + "}";
  });
  s = s.replace(
    /[−–—×÷·⋅∗±∓≤≥≠≈≡∞∑∏∫∂∇√→←⇒⇔∈∉⊂⊆∪∩∅∀∃∝°αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΦΨΩ]/g,
    (c) => MM_SYM[c] || c,
  );
  return s;
}

// Strip characters KaTeX can't render (U+FFFD, control, zero-width, bidi marks)
// and escape a bare '%' so a stray glyph never turns a formula into a red error.
export function sanitizeLatex(latex) {
  if (!latex || typeof latex !== "string") return "";

  let cleaned = latex
    // Restore JS string control characters (\u0008 -> \b, \u000B -> \v, \u000C -> \f, \u0009 -> \t, \u000D -> \r)
    .replace(/\u0008([a-zA-Z])/g, "\\b$1")
    .replace(/\u000B([a-zA-Z])/g, "\\v$1")
    .replace(/\u000C([a-zA-Z])/g, "\\f$1")
    .replace(/\u0009([a-zA-Z])/g, "\\t$1")
    .replace(/\u000D(?!\n)([a-zA-Z])/g, "\\r$1")
    .replace(/\u0009ext/g, "\\text")
    .replace(/\u000Crac/g, "\\frac")
    .replace(/\u000C/g, "\\f")
    .replace(/\u0009/g, "\\t")
    // eslint-disable-next-line no-control-regex -- intentional control/invisible-char strip
    .replace(
      /[\uFFFD\u0000-\u0007\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g,
      "",
    )
    .replace(/(^|[^\\])%/g, "$1\\%");

  // Convert unicode math symbols & Greek letters (η -> \eta, θ -> \theta, etc.)
  cleaned = convUnicodeMath(cleaned);

  // Fix OCR / Markdown artifact hashes & multi-equals:
  // 1. Replace '##' with '-' (minus sign)
  cleaned = cleaned.replace(/##/g, "-");
  // 2. Replace multiple equal signs '===' with '='
  cleaned = cleaned.replace(/={2,}/g, "=");

  // Remove any unescaped '#' (that isn't \#)
  cleaned = cleaned.replace(/(^|[^\\])#/g, "$1");

  return cleaned;
}

// Last-resort strip: drop every non-ASCII glyph (e.g. the middle dot in "N·m").
export function stripUnknownChars(latex) {
  return (latex || "").replace(/[^\x20-\x7E]/g, "");
}

/**
 * Helper to determine if a LaTeX line is unclosed or incomplete,
 * indicating that the next line is a continuation of the same formula.
 */
export function isUnclosedLatex(line, inEnv = false) {
  const tr = (line || "").trim();
  if (!tr) return { unclosed: false, inEnv: false };

  // Check LaTeX environments \begin{...} vs \end{...}
  const begins = (tr.match(/\\begin\{[^}]+\}/g) || []).length;
  const ends = (tr.match(/\\end\{[^}]+\}/g) || []).length;
  const newInEnv = inEnv ? (begins >= ends) : (begins > ends);

  if (newInEnv) return { unclosed: true, inEnv: true };

  // Check unclosed braces/brackets (ignoring escaped ones)
  let openBraces = 0, openParens = 0, openBrackets = 0;
  for (let i = 0; i < tr.length; i++) {
    if (tr[i] === "\\") { i++; continue; }
    if (tr[i] === "{") openBraces++;
    else if (tr[i] === "}") openBraces--;
    else if (tr[i] === "(") openParens++;
    else if (tr[i] === ")") openParens--;
    else if (tr[i] === "[") openBrackets++;
    else if (tr[i] === "]") openBrackets--;
  }

  if (openBraces > 0 || openParens > 0 || openBrackets > 0) {
    return { unclosed: true, inEnv: false };
  }

  // Check ending operator continuation (\, +, -, =, *, /, ,)
  if (/(\\[a-zA-Z]+|[+\-*=/,])$/.test(tr)) {
    if (!/\\(right|quad|qquad|hfill|cr|\\)$/.test(tr)) {
      return { unclosed: true, inEnv: false };
    }
  }

  return { unclosed: false, inEnv: false };
}

/**
 * Normalizes multi-line raw LaTeX pastes (e.g. copied from web math renders or PDFs)
 * into unified LaTeX formula strings before parsing. Preserves separate formula lines.
 */
export function normalizeLatexPaste(text) {
  if (!text || typeof text !== "string") return text;

  // Single line: if it has squashed visual text before \command or $, strip the squashed visual text prefix
  if (!text.includes("\n")) {
    const trimmed = text.trim();
    const match = trimmed.match(/^.+?(\\[a-zA-Z]{2,}.*|\$.*|\\[(\[].*)$/);
    if (
      match &&
      !/^\\[a-zA-Z]/.test(trimmed) &&
      !/^\$/.test(trimmed) &&
      !/^\\\(/.test(trimmed) &&
      !/^\\\[/.test(trimmed)
    ) {
      return match[1].trim();
    }
    return text;
  }

  const rawLines = text.split("\n");
  const isLatexPart = (l) => {
    const tr = (l || "").trim();
    if (!tr) return false;
    if (/^\s*[*+\-•◦▪]\s/.test(tr) || /^\s*\d+[.)]\s/.test(tr)) return false; // Markdown list items must NOT be grouped as latex formula blocks
    if (/^\*[a-zA-Z]/.test(tr)) return false; // Markdown emphasis (*Text...) must NOT be latex lines
    if (/^[\[\]$$]/.test(tr)) return false;
    // Setext heading underlines (===, ---) must NOT be treated as LaTeX operator lines
    if (/^[=]{3,}$/.test(tr) || /^[-]{3,}$/.test(tr)) return false;
    if (mmWordy(tr) > 3) return false; // Prose sentences with >3 words are text, NOT standalone display math
    if (
      /^\s*\\(text|frac|dfrac|tfrac|mathrm|mathbf|mathit|sum|prod|int|alpha|beta|theta|sigma|mu|lambda|phi|psi|omega|infty|pm|times|div|leq|geq|neq|partial|nabla|left|right|begin|end|underbrace|overbrace)\b/.test(
        tr,
      )
    )
      return true;
    if (/^[\\{}]/.test(tr)) return true;
    if (/^[=+\-/×÷]\s*(\\|\{|\w)/.test(tr) || /^=\s*$/.test(tr)) return true;
    if (tr.includes("\\") && /\\[a-zA-Z]{2,}/.test(tr) && !tr.includes("http"))
      return true;
    return false;
  };

  const outLines = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (isLatexPart(trimmed)) {
      const latexBlock = [trimmed];
      let currentInEnv = false;
      let state = isUnclosedLatex(trimmed, currentInEnv);
      currentInEnv = state.inEnv;
      i++;

      while (i < rawLines.length && isLatexPart(rawLines[i])) {
        const nextTrimmed = rawLines[i].trim();
        const isContinuation =
          state.unclosed ||
          /^[})\],]/.test(nextTrimmed) ||
          /^\s*\\(right|end)\b/.test(nextTrimmed);

        if (isContinuation) {
          latexBlock.push(nextTrimmed);
          state = isUnclosedLatex(nextTrimmed, currentInEnv);
          currentInEnv = state.inEnv;
          i++;
        } else {
          break;
        }
      }
      outLines.push(latexBlock.join(" "));
    } else {
      outLines.push(line);
      i++;
    }
  }

  return outLines.join("\n");
}
