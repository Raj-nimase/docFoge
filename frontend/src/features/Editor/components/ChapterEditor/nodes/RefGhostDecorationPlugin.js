import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const refGhostPluginKey = new PluginKey('refGhostPluginKey');

export const RefGhostExtension = Extension.create({
  name: 'refGhostExtension',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: refGhostPluginKey,
        props: {
          decorations(state) {
            const { selection, doc } = state;
            if (!selection || !selection.empty) {
              return DecorationSet.empty;
            }

            const { $from } = selection;
            const parentText = $from.parent.textContent || '';
            const offset = $from.parentOffset;
            const textBefore = parentText.slice(Math.max(0, offset - 15), offset);

            // Match @ or @f or @t or @fig or @tab (matches regardless of preceding character like '.', '(', space, etc.)
            const match = textBefore.match(/@([a-zA-Z]{0,2})$/);
            if (match) {
              const typed = (match[1] || '').toLowerCase();
              // If user typed 'fig' or 'tab' or 'table', hide ghost hint because bubble menu takes over
              if (typed === 'fig' || typed === 'tab' || typed === 'table') {
                return DecorationSet.empty;
              }

              const widget = Decoration.widget(
                $from.pos,
                () => {
                  const ghostNode = document.createElement('span');
                  ghostNode.className = 'ref-ghost-hint';
                  ghostNode.textContent = 'fig / table';
                  return ghostNode;
                },
                { side: 1, key: 'refGhostHint' }
              );
              return DecorationSet.create(doc, [widget]);
            }

            return DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export default RefGhostExtension;
