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
function escapeLatex(text) {
  if (!text || typeof text !== 'string') return '';

  // 1. Strip emoji characters and unprintable control characters
  let cleaned = text
    .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Control chars
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // Emoticons, symbols, etc.
    .replace(/[\u{2600}-\u{27BF}]/gu, '')      // Misc symbols, dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')      // Variation selectors
    .replace(/[\u{E0020}-\u{E007F}]/gu, '');   // Tags

  // 2. Map common unicode arrows and symbols before stripping
  cleaned = cleaned
    .replace(/→/g, '$\\rightarrow$')
    .replace(/←/g, '$\\leftarrow$')
    .replace(/↓/g, '$\\downarrow$')
    .replace(/↑/g, '$\\uparrow$')
    .replace(/↔/g, '$\\leftrightarrow$')
    .replace(/⇒/g, '$\\Rightarrow$')
    .replace(/⇐/g, '$\\Leftarrow$')
    .replace(/⇔/g, '$\\Leftrightarrow$')
    .replace(/▼/g, '$\\downarrow$')
    .replace(/▲/g, '$\\uparrow$')
    .replace(/◄/g, '$\\leftarrow$')
    .replace(/►/g, '$\\rightarrow$');

  // 3. Strip mathematical operator symbols that crash in text mode
  //    ∫ (U+222B), ∑ (U+2211), ∏ (U+220F), √ (U+221A), ∞ (U+221E),
  //    ± (U+00B1), × (U+00D7), ÷ (U+00F7), etc.
  cleaned = cleaned
    .replace(/[\u2200-\u22FF]/g, '')   // Mathematical Operators block
    .replace(/[\u2190-\u21FF]/g, '')   // Arrows block
    .replace(/[\u2100-\u214F]/g, '');  // Letterlike Symbols block

  // 3. Normalize unicode whitespace to regular spaces
  cleaned = cleaned.replace(/[\u00A0\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F]/g, ' ');

  // 4. Strip other problematic unicode (zero-width chars, BOM, etc.)
  cleaned = cleaned.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

  // 5. Standard LaTeX character escaping
  return cleaned.replace(ESCAPE_REGEX, char => ESCAPE_MAP[char] || char);
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
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
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
    .replace(/³/g, "^3")
    .replace(/↓/g, "\\downarrow")
    .replace(/↑/g, "\\uparrow")
    .replace(/→/g, "\\rightarrow")
    .replace(/←/g, "\\leftarrow");

  // 4. Strip outer LaTeX display delimiters (\[, \], \(, \)) while preserving \left[ and \right]
  cleaned = cleaned.replace(/(?<!\\left)\\\[|(?<!\\right)\\\]|\\\(|\\\)/g, '');

  // 5. Strip all unescaped $ signs to prevent nested math mode compilation errors
  return cleaned.replace(/\\\$|(\$)/g, (match, group1) => group1 ? '' : match);
}

module.exports = { escapeLatex, auditLatexSource, sanitizeLatex };
