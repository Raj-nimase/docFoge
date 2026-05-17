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

  // 1. Strip emoji characters (all major emoji/symbol ranges)
  let cleaned = text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // Emoticons, symbols, etc.
    .replace(/[\u{2600}-\u{27BF}]/gu, '')      // Misc symbols, dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')      // Variation selectors
    .replace(/[\u{E0020}-\u{E007F}]/gu, '');   // Tags

  // 2. Strip mathematical operator symbols that crash in text mode
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

module.exports = { escapeLatex, auditLatexSource };
