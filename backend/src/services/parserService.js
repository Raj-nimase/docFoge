/**
 * Backend Normalizer + Parser Service
 * Mirrors the frontend engine for server-side parsing.
 */

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalize(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.normalize('NFC');

  text = text.split('\n').map(line => {
    const leadMatch = line.match(/^(\s*)/);
    const leading = leadMatch ? leadMatch[1] : '';
    const rest = line.slice(leading.length);
    return leading + rest.replace(/[ \t]{2,}/g, ' ');
  }).join('\n');

  text = text.split('\n').map(l => l.trimEnd()).join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function splitIntoGroups(text) {
  const lines = text.split('\n');
  const groups = [];
  let current = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length) { groups.push(current); current = []; }
    } else {
      current.push(line);
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

function classifyLine(line) {
  const t = line.trim();
  if (!t) return 'BLANK';
  if (/^[-*•]\s+/.test(t)) return 'LIST_ITEM_BULLET';
  if (/^\d+[.)]\s+/.test(t)) return 'LIST_ITEM_ORDERED';
  return 'PARAGRAPH_BODY';
}

// ─── Parser ───────────────────────────────────────────────────────────────────

let _idCounter = 0;
function genId() { return `b_${Date.now()}_${++_idCounter}`; }

function parseSingleLine(line) {
  const trimmed = line.trim();
  const wordCount = trimmed.split(/\s+/).length;
  const charCount = trimmed.length;
  const endsWithPunct = /[.!?;,]$/.test(trimmed);
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

  let score = 0;
  if (wordCount <= 8)  score += 0.25;
  if (wordCount <= 5)  score += 0.15;
  if (charCount <= 60) score += 0.10;
  if (!endsWithPunct)  score += 0.20;
  if (isAllCaps)       score += 0.20;
  if (/^(introduction|overview|summary|conclusion|background|methodology|results|references|abstract|appendix)/i.test(trimmed)) score += 0.30;
  if (charCount > 100) score -= 0.40;
  if (endsWithPunct)   score -= 0.20;
  score = Math.max(0, Math.min(1, score));

  if (score >= 0.60) {
    return { id: genId(), type: 'heading', level: score >= 0.85 ? 1 : 2, content: trimmed, confidence: score, alternativeTypes: score < 0.85 ? ['paragraph'] : [] };
  }
  return { id: genId(), type: 'paragraph', content: trimmed, confidence: 1 - score };
}

function parseGroup(group) {
  if (!group.length) return [];
  const allBullets  = group.every(l => classifyLine(l) === 'LIST_ITEM_BULLET');
  const allOrdered  = group.every(l => classifyLine(l) === 'LIST_ITEM_ORDERED');

  if (allBullets)  return [{ id: genId(), type: 'bullet_list',   items: group.map(l => l.trim().replace(/^[-*•]\s+/, '')),   confidence: 0.95 }];
  if (allOrdered)  return [{ id: genId(), type: 'numbered_list', items: group.map(l => l.trim().replace(/^\d+[.)]\s+/, '')), confidence: 0.95 }];

  // Split mixed groups (e.g. heading line + bullets with no blank line)
  const hasBullets = group.some(l => classifyLine(l) === 'LIST_ITEM_BULLET');
  const hasOrdered = group.some(l => classifyLine(l) === 'LIST_ITEM_ORDERED');
  if (hasBullets || hasOrdered) {
    const blocks = [];
    let currentType = null, currentLines = [];
    const flush = () => {
      if (!currentLines.length) return;
      if (currentType === 'bullet')  blocks.push({ id: genId(), type: 'bullet_list',   items: currentLines.map(l => l.trim().replace(/^[-*•]\s+/, '')),   confidence: 0.92 });
      else if (currentType === 'ordered') blocks.push({ id: genId(), type: 'numbered_list', items: currentLines.map(l => l.trim().replace(/^\d+[.)]\s+/, '')), confidence: 0.92 });
      else if (currentLines.length === 1) blocks.push(parseSingleLine(currentLines[0]));
      else blocks.push({ id: genId(), type: 'paragraph', content: currentLines.join(' '), confidence: 0.88 });
      currentLines = []; currentType = null;
    };
    for (const line of group) {
      const role = classifyLine(line);
      const t = role === 'LIST_ITEM_BULLET' ? 'bullet' : role === 'LIST_ITEM_ORDERED' ? 'ordered' : 'text';
      if (currentType !== t) { flush(); currentType = t; }
      currentLines.push(line);
    }
    flush();
    return blocks;
  }

  if (group.length === 1) return [parseSingleLine(group[0])];

  // Check if first line is a heading with body after it
  const firstBlock = parseSingleLine(group[0]);
  if (firstBlock.type === 'heading' && firstBlock.confidence >= 0.60 && group.length >= 2) {
    return [firstBlock, { id: genId(), type: 'paragraph', content: group.slice(1).join(' '), confidence: 0.90 }];
  }

  return [{ id: genId(), type: 'paragraph', content: group.join(' '), confidence: 0.90 }];
}

/**
 * Parse raw text into blocks with confidence scores.
 * @param {string} rawText
 * @returns {{ blocks: Block[], hasLowConfidence: boolean }}
 */
function parseRawText(rawText) {
  const normalized = normalize(rawText);
  const groups = splitIntoGroups(normalized);
  const blocks = groups.flatMap(parseGroup).filter(Boolean);
  const hasLowConfidence = blocks.some(b => b.confidence < 0.85);
  return { blocks, hasLowConfidence };
}

module.exports = { parseRawText, normalize };
