/**
 * Block schema validation helpers.
 * Ensures blocks from the frontend conform to the expected shape
 * before being passed into the rendering pipeline.
 */

const VALID_TYPES = ['heading', 'paragraph', 'bullet_list', 'numbered_list'];

/**
 * Validate and sanitize a single block.
 * Returns { valid: boolean, block?: Block, error?: string }
 */
function validateBlock(raw) {
  if (!raw || typeof raw !== 'object') return { valid: false, error: 'Block must be an object' };
  if (!raw.id || typeof raw.id !== 'string') return { valid: false, error: 'Block must have a string id' };
  if (!VALID_TYPES.includes(raw.type)) return { valid: false, error: `Unknown block type: ${raw.type}` };

  switch (raw.type) {
    case 'heading':
      if (![1, 2, 3].includes(raw.level)) return { valid: false, error: `Heading level must be 1-3, got ${raw.level}` };
      if (typeof raw.content !== 'string') return { valid: false, error: 'Heading must have string content' };
      return { valid: true, block: { id: raw.id, type: 'heading', level: raw.level, content: raw.content } };

    case 'paragraph':
      if (typeof raw.content !== 'string') return { valid: false, error: 'Paragraph must have string content' };
      return { valid: true, block: { id: raw.id, type: 'paragraph', content: raw.content } };

    case 'bullet_list':
    case 'numbered_list':
      if (!Array.isArray(raw.items)) return { valid: false, error: `${raw.type} must have an items array` };
      return { valid: true, block: { id: raw.id, type: raw.type, items: raw.items.map(String) } };

    default:
      return { valid: false, error: `Unhandled type: ${raw.type}` };
  }
}

/**
 * Validate an array of blocks.
 * Returns { valid: boolean, blocks?: Block[], errors?: string[] }
 */
function validateBlocks(rawBlocks) {
  if (!Array.isArray(rawBlocks)) {
    return { valid: false, errors: ['blocks must be an array'] };
  }

  const blocks = [];
  const errors = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    const result = validateBlock(rawBlocks[i]);
    if (!result.valid) {
      errors.push(`Block[${i}] (id=${rawBlocks[i]?.id}): ${result.error}`);
    } else {
      blocks.push(result.block);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, blocks };
}

module.exports = { validateBlock, validateBlocks, VALID_TYPES };
