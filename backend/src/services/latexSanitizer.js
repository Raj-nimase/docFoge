/**
 * LaTeX Sanitizer
 *
 * Escapes special LaTeX characters in user content.
 * Blocks dangerous LaTeX commands.
 */

// Characters that must be escaped in LaTeX
const ESCAPE_MAP = {
  '&':  '\\&',
  '%':  '\\%',
  '$':  '\\$',
  '#':  '\\#',
  '_':  '\\_',
  '{':  '\\{',
  '}':  '\\}',
  '~':  '\\textasciitilde{}',
  '^':  '\\textasciicircum{}',
  '\\': '\\textbackslash{}',
};

const ESCAPE_REGEX = /[&%$#_{}~^\\]/g;

// Dangerous LaTeX commands that could execute shell code or read files
const DANGEROUS_PATTERNS = [
  /\\write18\b/i,
  /\\immediate\\write18\b/i,
  /\\input\s*\{/i,
  /\\include\s*\{/i,
  /\\InputIfFileExists\s*\{/i,
  /\\openin\b/i,
  /\\openout\b/i,
  /--shell-escape/i,
  /\\directlua\s*\{/i,
  /\\luaexec\s*\{/i,
];

/**
 * Escape special LaTeX characters in a user-provided string.
 * @param {string} text
 * @returns {string}
 */
const UNICODE_LATEX_MAP = {
  'α': '$\\alpha$',
  'β': '$\\beta$',
  'γ': '$\\gamma$',
  'δ': '$\\delta$',
  'ε': '$\\varepsilon$',
  'ζ': '$\\zeta$',
  'η': '$\\eta$',
  'θ': '$\\theta$',
  'ι': '$\\iota$',
  'κ': '$\\kappa$',
  'λ': '$\\lambda$',
  'μ': '$\\mu$',
  'ν': '$\\nu$',
  'ξ': '$\\xi$',
  'π': '$\\pi$',
  'ρ': '$\\rho$',
  'σ': '$\\sigma$',
  'τ': '$\\tau$',
  'υ': '$\\upsilon$',
  'φ': '$\\phi$',
  'χ': '$\\chi$',
  'ψ': '$\\psi$',
  'ω': '$\\omega$',
  'Γ': '$\\Gamma$',
  'Δ': '$\\Delta$',
  'Θ': '$\\Theta$',
  'Λ': '$\\Lambda$',
  'Ξ': '$\\Xi$',
  'Π': '$\\Pi$',
  'Σ': '$\\Sigma$',
  'Φ': '$\\Phi$',
  'Ψ': '$\\Psi$',
  'Ω': '$\\Omega$',
  '∞': '$\\infty$',
  '∇': '$\\nabla$',
  '∂': '$\\partial$',
  '∑': '$\\sum$',
  '∫': '$\\int$',
  '∏': '$\\prod$',
  '√': '$\\sqrt{}$',
  '⊗': '$\\otimes$',
  '⊕': '$\\oplus$',
  '≤': '$\\le$',
  '≥': '$\\ge$',
  '≈': '$\\approx$',
  '≠': '$\\ne$',
  '≡': '$\\equiv$',
  '±': '$\\pm$',
  '∓': '$\\mp$',
  '×': '$\\times$',
  '÷': '$\\div$',
  '·': '$\\cdot$',
  '⋅': '$\\cdot$',
  '∈': '$\\in$',
  '∉': '$\\notin$',
  '⊂': '$\\subset$',
  '⊆': '$\\subseteq$',
  '∪': '$\\cup$',
  '∩': '$\\cap$',
  '∅': '$\\emptyset$',
  '∀': '$\\forall$',
  '∃': '$\\exists$',
  '∝': '$\\propto$',
  '°': '$^{\\circ}$',
  '✔': '$\\checkmark$',
  '✓': '$\\checkmark$',
  '☑': '$\\checkmark$',
  '✅': '$\\checkmark$',
  '❌': '$\\times$',
  '✗': '$\\times$',
  '✕': '$\\times$',
  '✖': '$\\times$',
  '✘': '$\\times$',
  '❎': '$\\times$',
  '⚠️': '$\\mathbf{!}$',
  '⚠': '$\\mathbf{!}$',
  '•': '$\\bullet$',
  '◦': '$\\circ$',
  '▪': '$\\blacksquare$',
  '▫': '$\\square$',
  '★': '$\\star$',
  '☆': '$\\star$',
  '→': '$\\rightarrow$',
  '←': '$\\leftarrow$',
  '↓': '$\\downarrow$',
  '↑': '$\\uparrow$',
  '↔': '$\\leftrightarrow$',
  '⇒': '$\\Rightarrow$',
  '⇐': '$\\Leftarrow$',
  '⇔': '$\\Leftrightarrow$',
  '▼': '$\\downarrow$',
  '▲': '$\\uparrow$',
  '◄': '$\\leftarrow$',
  '►': '$\\rightarrow$',
};

const UNICODE_MATH_REGEX = new RegExp(
  Object.keys(UNICODE_LATEX_MAP).map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|'),
  'g'
);

/**
 * Escape special LaTeX characters in a user-provided string.
 * @param {string} text
 * @returns {string}
 */
function escapeLatex(text) {
  if (!text || typeof text !== 'string') return '';

  // 1. Strip emoji characters, invalid surrogates, U+FFFD, and control characters
  let cleaned = text
    .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uD800-\uDFFF]/g, '') // Control & surrogate chars
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // Emoticons, symbols, etc.
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')      // Variation selectors
    .replace(/[\u{E0020}-\u{E007F}]/gu, '');   // Tags

  // 2. Normalize smart quotes and dashes
  cleaned = cleaned
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-');

  // 3. Normalize unicode whitespace to regular spaces
  cleaned = cleaned.replace(/[\u00A0\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F]/g, ' ');

  // 4. Strip other problematic unicode (zero-width chars, BOM, etc.)
  cleaned = cleaned.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

  // 5. Standard LaTeX character escaping
  cleaned = cleaned.replace(ESCAPE_REGEX, char => ESCAPE_MAP[char] || char);

  // 6. Convert Unicode math symbols to LaTeX math mode AFTER character escaping
  cleaned = cleaned.replace(UNICODE_MATH_REGEX, m => UNICODE_LATEX_MAP[m] || m);

  return cleaned;
}

/**
 * Check that a string does NOT contain dangerous LaTeX commands.
 * @param {string} latexSource
 * @returns {{ safe: boolean, reason?: string }}
 */
function auditLatexSource(latexSource) {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(latexSource)) {
      return { safe: false, reason: `Blocked pattern: ${pattern.source}` };
    }
  }
  return { safe: true };
}

/**
 * Sanitize LaTeX formula input: strip invalid characters and unescaped $ signs,
 * and translate common Unicode symbols to LaTeX commands.
 * @param {string} latex
 * @returns {string}
 */
function sanitizeLatex(latex) {
  if (!latex || typeof latex !== 'string') return '';

  let clean = latex.trim();
  
  // Strip math delimiters: $$, $, \[, \], \(, \)
  while (true) {
    const start = clean;
    if (clean.startsWith("$$") && clean.endsWith("$$")) {
      clean = clean.slice(2, -2).trim();
    } else if (clean.startsWith("$") && clean.endsWith("$")) {
      clean = clean.slice(1, -1).trim();
    } else if (clean.startsWith("\\[") && clean.endsWith("\\]")) {
      clean = clean.slice(2, -2).trim();
    } else if (clean.startsWith("\\(") && clean.endsWith("\\)")) {
      clean = clean.slice(2, -2).trim();
    }
    if (clean === start) break;
  }

  // 1. Strip emojis and other control/invisible/BOM characters
  let cleaned = clean
    .replace(/\u0008([a-zA-Z])/g, "\\b$1")
    .replace(/\u000B([a-zA-Z])/g, "\\v$1")
    .replace(/\u000C([a-zA-Z])/g, "\\f$1")
    .replace(/\u0009([a-zA-Z])/g, "\\t$1")
    .replace(/\u000D(?!\n)([a-zA-Z])/g, "\\r$1")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\uFFFD\u0000-\u0007\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/(^|[^\\])%/g, '$1\\%');

  // Fix OCR/Markdown artifact hashes:
  // 1. Replace '##' with '-' (minus sign)
  cleaned = cleaned.replace(/##/g, '-');
  // 2. Remove single unescaped '#'
  cleaned = cleaned.replace(/(^|[^\\])#/g, '$1');

  // 2. Normalize unicode whitespace to regular spaces
  cleaned = cleaned.replace(/[\u00A0\u2002-\u200A\u202F\u205F]/g, ' ');

  // 3. Map common unicode mathematical and greek symbols to their LaTeX commands
  cleaned = cleaned
    .replace(/α/g, "\\alpha ")
    .replace(/β/g, "\\beta ")
    .replace(/γ/g, "\\gamma ")
    .replace(/δ/g, "\\delta ")
    .replace(/ε/g, "\\epsilon ")
    .replace(/ζ/g, "\\zeta ")
    .replace(/η/g, "\\eta ")
    .replace(/θ/g, "\\theta ")
    .replace(/ι/g, "\\iota ")
    .replace(/κ/g, "\\kappa ")
    .replace(/λ/g, "\\lambda ")
    .replace(/μ/g, "\\mu ")
    .replace(/ν/g, "\\nu ")
    .replace(/ξ/g, "\\xi ")
    .replace(/π/g, "\\pi ")
    .replace(/ρ/g, "\\rho ")
    .replace(/σ/g, "\\sigma ")
    .replace(/τ/g, "\\tau ")
    .replace(/υ/g, "\\upsilon ")
    .replace(/φ/g, "\\phi ")
    .replace(/χ/g, "\\chi ")
    .replace(/ψ/g, "\\psi ")
    .replace(/ω/g, "\\omega ")
    .replace(/Γ/g, "\\Gamma ")
    .replace(/Δ/g, "\\Delta ")
    .replace(/Θ/g, "\\Theta ")
    .replace(/Λ/g, "\\Lambda ")
    .replace(/Ξ/g, "\\Xi ")
    .replace(/Π/g, "\\Pi ")
    .replace(/Σ/g, "\\Sigma ")
    .replace(/Φ/g, "\\Phi ")
    .replace(/Ψ/g, "\\Psi ")
    .replace(/Ω/g, "\\Omega ")
    .replace(/∞/g, "\\infty ")
    .replace(/±/g, "\\pm ")
    .replace(/∓/g, "\\mp ")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/≤/g, "\\leq ")
    .replace(/≥/g, "\\geq ")
    .replace(/≠/g, "\\neq ")
    .replace(/≈/g, "\\approx ")
    .replace(/≡/g, "\\equiv ")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/↓/g, "\\downarrow ")
    .replace(/↑/g, "\\uparrow ")
    .replace(/→/g, "\\rightarrow ")
    .replace(/←/g, "\\leftarrow ")
    .replace(/⇒/g, "\\Rightarrow ")
    .replace(/⇐/g, "\\Leftarrow ")
    .replace(/⇔/g, "\\Leftrightarrow ")
    .replace(/∂/g, "\\partial ")
    .replace(/∇/g, "\\nabla ")
    .replace(/√/g, "\\sqrt ")
    .replace(/∫/g, "\\int ")
    .replace(/∑/g, "\\sum ")
    .replace(/∏/g, "\\prod ")
    .replace(/∈/g, "\\in ")
    .replace(/∉/g, "\\notin ")
    .replace(/⊂/g, "\\subset ")
    .replace(/⊆/g, "\\subseteq ")
    .replace(/∪/g, "\\cup ")
    .replace(/∩/g, "\\cap ")
    .replace(/∅/g, "\\emptyset ")
    .replace(/∀/g, "\\forall ")
    .replace(/∃/g, "\\exists ")
    .replace(/∝/g, "\\propto ")
    .replace(/°/g, "^{\\circ}");

  // 4. Strip outer LaTeX display delimiters (\[, \], \(, \)) while preserving \left[ and \right]
  cleaned = cleaned.replace(/(?<!\\left)\\\[|(?<!\\right)\\\]|\\\(|\\\)/g, '');

  // 5. Strip all unescaped $ signs to prevent nested math mode compilation errors
  cleaned = cleaned.replace(/\\\$|(\$)/g, (match, group1) => group1 ? '' : match);

  // 6. Fix squashed single-backslash row breaks in matrix / cases / array environments
  if (/\\begin\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|cases|aligned|array)\}/i.test(cleaned)) {
    cleaned = cleaned.replace(/(\\begin\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|cases|aligned|array)\}[\s\S]*?\\end\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|cases|aligned|array)\})/gi, (env) => {
      return env.replace(/(?<!\\)\\(?!\\)\s*(\r?\n|\s+)(?!begin|end|\{|\[)/gi, " \\\\ ");
    });
  }

  return cleaned;
}

module.exports = { escapeLatex, auditLatexSource, sanitizeLatex };
