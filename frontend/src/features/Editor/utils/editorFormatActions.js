/** Shared TipTap formatting commands used by toolbar and bubble menu */

export const HEADING_LEVELS = [
  { level: 1, label: 'Section', short: '1.1', hint: 'Main section heading (LaTeX \\section)' },
  { level: 2, label: 'Subsection', short: '1.1.1', hint: 'Subsection heading (LaTeX \\subsection)' },
  { level: 3, label: 'Sub-subsection', short: '1.1.1.1', hint: 'Sub-subsection heading (LaTeX \\subsubsection)' },
];

/** Resolve heading level from the block containing the selection (works with partial selections) */
export function getActiveHeadingLevel(editor) {
  if (!editor) return null;
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'heading') {
      return node.attrs.level;
    }
  }
  return null;
}

export function setHeading(editor, level) {
  editor.chain().focus().setHeading({ level }).run();
}

export function clearHeading(editor) {
  editor.chain().focus().setParagraph().run();
}

/** Mark as heading, or unmark to normal paragraph if that level is already active */
export function toggleHeading(editor, level) {
  const current = getActiveHeadingLevel(editor);
  if (current === level) {
    editor.chain().focus().setParagraph().run();
  } else {
    editor.chain().focus().setHeading({ level }).run();
  }
}
