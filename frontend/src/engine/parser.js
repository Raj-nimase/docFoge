/**
 * Confidence-Scored Block Parser
 *
 * Converts normalized line-groups into Block JSON with confidence scores.
 *
 * Confidence thresholds:
 *   >= 0.85  → auto-apply, no user prompt
 *   0.60–0.84 → show ConfidenceBanner (user can accept/reject)
 *   < 0.60   → treat as paragraph, user must manually convert
 */

import { normalize, splitIntoGroups, classifyLine } from './normalizer.js';

let _idCounter = 0;
function genId() {
  return `b_${Date.now()}_${++_idCounter}`;
}

/**
 * Main entry point.
 * @param {string} rawText
 * @returns {{ blocks: Block[], hasLowConfidence: boolean }}
 */
export function parseRawText(rawText) {
  const normalized = normalize(rawText);
  const groups = splitIntoGroups(normalized);
  const blocks = groups.flatMap(parseGroup).filter(Boolean);
  const hasLowConfidence = blocks.some(b => b.confidence < 0.85);
  return { blocks, hasLowConfidence };
}

/**
 * Parse a single line-group into one or more blocks.
 * @param {string[]} group
 * @returns {Block[]}
 */
function parseGroup(group) {
  if (!group.length) return [];

  // — All lines are bullet list items —
  const allBullets = group.every(l => classifyLine(l) === 'LIST_ITEM_BULLET');
  if (allBullets) {
    return [{
      id: genId(),
      type: 'bullet_list',
      items: group.map(l => l.trim().replace(/^[-*•]\s+/, '')),
      confidence: 0.95,
    }];
  }

  // — All lines are ordered list items —
  const allOrdered = group.every(l => classifyLine(l) === 'LIST_ITEM_ORDERED');
  if (allOrdered) {
    return [{
      id: genId(),
      type: 'numbered_list',
      items: group.map(l => l.trim().replace(/^\d+[.)]\s+/, '')),
      confidence: 0.95,
    }];
  }

  // — Mixed (e.g. "Applications\n- Chatbots\n- X") — always split by role —
  const hasBullets = group.some(l => classifyLine(l) === 'LIST_ITEM_BULLET');
  const hasOrdered = group.some(l => classifyLine(l) === 'LIST_ITEM_ORDERED');
  if (hasBullets || hasOrdered) {
    return splitMixedGroup(group);
  }

  // — Single line group —
  if (group.length === 1) {
    return [parseSingleLine(group[0])];
  }

  // — Check if first line looks like a heading and the rest are body —
  const firstRole = classifyLine(group[0]);
  if (firstRole === 'PARAGRAPH_BODY' && group.length >= 2) {
    const firstBlock = parseSingleLine(group[0]);
    if (firstBlock.type === 'heading' && firstBlock.confidence >= 0.60) {
      const rest = group.slice(1);
      return [firstBlock, { id: genId(), type: 'paragraph', content: rest.join(' '), confidence: 0.90 }];
    }
  }

  // — Multi-line group = paragraph —
  return [{
    id: genId(),
    type: 'paragraph',
    content: group.join(' '),
    confidence: 0.90,
  }];
}

/**
 * Parse a single isolated line into a heading or paragraph block.
 */
function parseSingleLine(line) {
  const trimmed = line.trim();
  const wordCount = trimmed.split(/\s+/).length;
  const charCount = trimmed.length;
  const endsWithPunctuation = /[.!?;,]$/.test(trimmed);
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const startsWithNumber = /^\d/.test(trimmed);

  // Score heading likelihood
  let headingScore = 0;

  if (wordCount <= 8) headingScore += 0.25;
  if (wordCount <= 5) headingScore += 0.15;
  if (charCount <= 60) headingScore += 0.10;
  if (!endsWithPunctuation) headingScore += 0.20;
  if (isAllCaps) headingScore += 0.20;
  if (/^(introduction|overview|summary|conclusion|background|methodology|results|references|abstract|appendix)/i.test(trimmed)) headingScore += 0.30;
  if (startsWithNumber && /^\d+[\.\)]\s/.test(trimmed)) headingScore -= 0.30; // numbered list
  if (charCount > 100) headingScore -= 0.40;
  if (endsWithPunctuation) headingScore -= 0.20;

  headingScore = Math.max(0, Math.min(1, headingScore));

  if (headingScore >= 0.60) {
    return {
      id: genId(),
      type: 'heading',
      level: headingScore >= 0.85 ? 1 : 2,
      content: trimmed,
      confidence: headingScore,
      alternativeTypes: headingScore < 0.85 ? ['paragraph'] : [],
    };
  }

  return {
    id: genId(),
    type: 'paragraph',
    content: trimmed,
    confidence: 1 - headingScore,
  };
}

/**
 * Split a mixed group (some bullet, some regular) into sub-blocks.
 */
function splitMixedGroup(group) {
  const blocks = [];
  let currentType = null;
  let currentLines = [];

  const flush = () => {
    if (!currentLines.length) return;
    if (currentType === 'bullet') {
      blocks.push({
        id: genId(),
        type: 'bullet_list',
        items: currentLines.map(l => l.trim().replace(/^[-*•]\s+/, '')),
        confidence: 0.92,
      });
    } else if (currentType === 'ordered') {
      blocks.push({
        id: genId(),
        type: 'numbered_list',
        items: currentLines.map(l => l.trim().replace(/^\d+[.)]\s+/, '')),
        confidence: 0.92,
      });
    } else {
      if (currentLines.length === 1) {
        blocks.push(parseSingleLine(currentLines[0]));
      } else {
        blocks.push({
          id: genId(),
          type: 'paragraph',
          content: currentLines.join(' '),
          confidence: 0.88,
        });
      }
    }
    currentLines = [];
    currentType = null;
  };

  for (const line of group) {
    const role = classifyLine(line);
    const thisType = role === 'LIST_ITEM_BULLET' ? 'bullet'
      : role === 'LIST_ITEM_ORDERED' ? 'ordered'
      : 'text';

    if (currentType !== thisType) {
      flush();
      currentType = thisType;
    }
    currentLines.push(line);
  }
  flush();
  return blocks;
}
