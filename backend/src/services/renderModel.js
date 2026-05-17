/**
 * Render Model — Intermediate Abstraction Layer
 *
 * Converts Block[] → RenderNode[]
 *
 * RenderNode is renderer-agnostic. Later, htmlRenderer.js and
 * markdownRenderer.js can consume the same RenderNode[] without
 * touching latexGenerator.js.
 *
 * @typedef {{
 *   kind: 'heading'|'paragraph'|'list'|'spacer',
 *   attrs: object,
 *   children: string[]|RenderNode[],
 * }} RenderNode
 */

/**
 * Convert Block[] to RenderNode[].
 * @param {Block[]} blocks
 * @returns {RenderNode[]}
 */
function blocksToRenderNodes(blocks) {
  if (!Array.isArray(blocks)) return [];

  const nodes = [];

  for (const block of blocks) {
    const node = blockToRenderNode(block);
    if (node) nodes.push(node);
  }

  return nodes;
}

function blockToRenderNode(block) {
  switch (block.type) {
    case 'heading':
      return {
        kind: 'heading',
        attrs: { level: block.level || 1 },
        children: [block.content || ''],
      };

    case 'paragraph':
      return {
        kind: 'paragraph',
        attrs: {},
        children: [block.content || ''],
      };

    case 'bullet_list':
      return {
        kind: 'list',
        attrs: { ordered: false },
        children: (block.items || []).map(item => ({
          kind: 'list_item',
          attrs: {},
          children: [item],
        })),
      };

    case 'numbered_list':
      return {
        kind: 'list',
        attrs: { ordered: true },
        children: (block.items || []).map(item => ({
          kind: 'list_item',
          attrs: {},
          children: [item],
        })),
      };

    default:
      return null;
  }
}

module.exports = { blocksToRenderNodes };
