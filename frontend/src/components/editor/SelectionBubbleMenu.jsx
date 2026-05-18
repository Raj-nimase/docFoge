import { BubbleMenu } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Eraser,
} from 'lucide-react';
import {
  HEADING_LEVELS,
  getActiveHeadingLevel,
  toggleHeading,
  clearHeading,
} from './editorFormatActions';

const HEADING_ICONS = { 1: Heading1, 2: Heading2, 3: Heading3 };

function BubbleBtn({ onClick, active, title, children, variant }) {
  return (
    <button
      type="button"
      className={`bubble-menu-btn${active ? ' bubble-menu-btn--active' : ''}${variant ? ` bubble-menu-btn--${variant}` : ''}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

export default function SelectionBubbleMenu({ editor }) {
  if (!editor) return null;

  const activeLevel = getActiveHeadingLevel(editor);

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 120,
        placement: 'top',
        offset: [0, 8],
        maxWidth: 'none',
      }}
      shouldShow={({ editor: ed }) => {
        const { empty } = ed.state.selection;
        if (empty) return false;
        if (ed.isActive('image') || ed.isActive('math') || ed.isActive('table')) return false;
        return true;
      }}
      className="editor-bubble-menu"
    >
      <div className="bubble-menu-section">
        <span className="bubble-menu-label">Format</span>
        <div className="bubble-menu-row">
          <BubbleBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold (Ctrl+B)"
          >
            <Bold size={15} strokeWidth={2.25} />
          </BubbleBtn>
          <BubbleBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic (Ctrl+I)"
          >
            <Italic size={15} strokeWidth={2.25} />
          </BubbleBtn>
          <BubbleBtn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Underline (Ctrl+U)"
          >
            <Underline size={15} strokeWidth={2.25} />
          </BubbleBtn>
          <BubbleBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough size={15} strokeWidth={2.25} />
          </BubbleBtn>
        </div>
      </div>

      <span className="bubble-menu-divider" />

      <div className="bubble-menu-section">
        <span className="bubble-menu-label">Structure</span>
        <div className="bubble-menu-row bubble-menu-row--structure">
          {HEADING_LEVELS.map(({ level, label, short, hint }) => {
            const Icon = HEADING_ICONS[level];
            const active = activeLevel === level;
            const title = active
              ? `Unmark as ${label.toLowerCase()} — click to convert to normal text`
              : hint;
            return (
              <button
                key={level}
                type="button"
                className={`bubble-menu-structure-btn${active ? ' bubble-menu-structure-btn--active' : ''}`}
                onClick={() => toggleHeading(editor, level)}
                title={title}
              >
                <Icon size={14} strokeWidth={2} />
                <span className="bubble-menu-structure-label">{label}</span>
                <span className="bubble-menu-structure-num">{short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeLevel !== null && (
        <>
          <span className="bubble-menu-divider" />
          <BubbleBtn
            onClick={() => clearHeading(editor)}
            title="Remove section marking — convert to normal paragraph"
            variant="muted"
          >
            <Pilcrow size={15} strokeWidth={2} />
            <span className="bubble-menu-text-btn">Normal text</span>
          </BubbleBtn>
        </>
      )}

      <span className="bubble-menu-divider" />

      <BubbleBtn
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        title="Clear all formatting"
        variant="muted"
      >
        <Eraser size={14} strokeWidth={2} />
      </BubbleBtn>
    </BubbleMenu>
  );
}
