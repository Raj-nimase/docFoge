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

function cleanChapterPrefixFromSelection(editor) {
  if (!editor) return;
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node && (node.type.name === 'heading' || node.type.name === 'paragraph')) {
      const text = node.textContent;
      const match = text.match(/^CHAPTER\s+\d+[:\s\-]*/i);
      if (match) {
        const startPos = $from.start(depth);
        editor.chain().focus().deleteRange({ from: startPos, to: startPos + match[0].length }).run();
      }
      break;
    }
  }
}

export function setHeading(editor, level) {
  if (!editor) return;
  if (level > 1) {
    cleanChapterPrefixFromSelection(editor);
  }
  editor.chain().focus().setHeading({ level }).run();
}

export function clearHeading(editor) {
  if (!editor) return;
  cleanChapterPrefixFromSelection(editor);
  editor.chain().focus().setParagraph().run();
}

/** Mark as heading, or unmark to normal paragraph if that level is already active */
export function toggleHeading(editor, level) {
  if (!editor) return;
  const current = getActiveHeadingLevel(editor);
  if (current === level) {
    cleanChapterPrefixFromSelection(editor);
    editor.chain().focus().setParagraph().run();
  } else {
    if (level > 1) {
      cleanChapterPrefixFromSelection(editor);
    }
    editor.chain().focus().setHeading({ level }).run();
  }
}
