/**
 * Normalization Pipeline
 * Runs on raw text before the confidence-scored parser.
 *
 * Steps:
 *  1. Unicode NFC normalization
 *  2. Fix pathological whitespace within lines
 *  3. Strip trailing whitespace per line
 *  4. Collapse runs of >2 blank lines to exactly 2
 *  5. Trim leading/trailing blank lines from the whole text
 */

/**
 * @param {string} rawText
 * @returns {string} normalized text
 */
export function normalize(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // 1. Unicode NFC
  text = text.normalize('NFC');

  // 2. Fix pathological internal whitespace within each line
  //    "AI    is     powerful" → "AI is powerful"
  //    But preserve leading indentation (important for code/lists)
  text = text
    .split('\n')
    .map(line => {
      const leadMatch = line.match(/^(\s*)/);
      const leading = leadMatch ? leadMatch[1] : '';
      const rest = line.slice(leading.length);
      const fixed = rest.replace(/[ \t]{2,}/g, ' ');
      return leading + fixed;
    })
    .join('\n');

  // 3. Strip trailing whitespace per line
  text = text
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');

  // 4. Collapse runs of >2 consecutive blank lines → exactly 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // 5. Trim leading/trailing blank lines
  text = text.trim();

  return text;
}

/**
 * Split normalized text into logical line-groups (paragraphs).
 * Groups are separated by blank lines.
 * @param {string} normalizedText
 * @returns {string[][]} array of line-groups, each group is an array of lines
 */
export function splitIntoGroups(normalizedText) {
  const lines = normalizedText.split('\n');
  const groups = [];
  let current = [];

  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);

  return groups;
}

/**
 * Classify a single line's role.
 * Returns one of: BLANK, LIST_ITEM_BULLET, LIST_ITEM_ORDERED, SHORT_STANDALONE, PARAGRAPH_BODY
 */
export function classifyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return 'BLANK';
  if (/^[-*•]\s+/.test(trimmed)) return 'LIST_ITEM_BULLET';
  if (/^\d+[.)]\s+/.test(trimmed)) return 'LIST_ITEM_ORDERED';
  return 'PARAGRAPH_BODY';
}
