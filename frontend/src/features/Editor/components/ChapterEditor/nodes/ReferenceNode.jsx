import { Node, mergeAttributes } from '@tiptap/core';

export const ReferenceNode = Node.create({
  name: 'reference',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      targetId: { default: '' },
      targetType: { default: 'figure' },
      label: { default: '' },
      refCode: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="reference"]',
        getAttrs: (element) => ({
          targetId: element.getAttribute('data-target-id') || '',
          targetType: element.getAttribute('data-target-type') || 'figure',
          label: element.getAttribute('data-label') || '',
          refCode: element.getAttribute('data-ref-code') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const labelVal = HTMLAttributes.label || 'Reference';
    const targetTypeVal = HTMLAttributes.targetType || 'figure';

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'reference',
        'data-target-id': HTMLAttributes.targetId || '',
        'data-target-type': targetTypeVal,
        'data-label': labelVal,
        'data-ref-code': HTMLAttributes.refCode || '',
        class: 'ref-inline-tag',
      }),
    ];
  },
});

export default ReferenceNode;
