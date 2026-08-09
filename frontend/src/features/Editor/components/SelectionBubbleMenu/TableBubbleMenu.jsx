import React from 'react';
import { BubbleMenu } from '@tiptap/react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Merge,
  Split,
  Plus,
  Trash2,
  Table as TableIcon,
  Palette,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export default function TableBubbleMenu({ editor }) {
  if (!editor) return null;

  const getTableAttr = (name, fallback) => {
    return editor.getAttributes('table')[name] || fallback;
  };

  const updateTableAttr = (attrs) => {
    editor.chain().focus().updateAttributes('table', attrs).run();
  };

  const currentStyle = getTableAttr('tableStyle', 'modern');
  const currentAlign = getTableAttr('align', 'center');
  const currentInset = getTableAttr('inset', 'normal');

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 120,
        placement: 'top',
        offset: [0, 10],
        maxWidth: 'none',
      }}
      shouldShow={({ editor: ed }) => ed.isActive('table')}
      className="editor-bubble-menu table-bubble-menu"
    >
      <div className="bubble-menu-section">
        <span className="bubble-menu-label">Table Style</span>
        <select
          className="bubble-menu-select"
          value={currentStyle}
          onChange={(e) => updateTableAttr({ tableStyle: e.target.value })}
          title="Select Table Visual Preset"
        >
          <option value="modern">Modern Grid</option>
          <option value="booktabs">Academic Booktabs</option>
          <option value="zebra">Zebra Striped</option>
          <option value="borderless">Borderless</option>
        </select>
      </div>

      <div className="bubble-menu-divider" />

      <div className="bubble-menu-section">
        <span className="bubble-menu-label">Align</span>
        <div className="bubble-menu-row">
          <button
            type="button"
            className={`bubble-menu-btn ${currentAlign === 'left' ? 'bubble-menu-btn--active' : ''}`}
            onClick={() => updateTableAttr({ align: 'left' })}
            title="Align Table Left"
          >
            <AlignLeft size={14} />
          </button>
          <button
            type="button"
            className={`bubble-menu-btn ${currentAlign === 'center' ? 'bubble-menu-btn--active' : ''}`}
            onClick={() => updateTableAttr({ align: 'center' })}
            title="Align Table Center"
          >
            <AlignCenter size={14} />
          </button>
          <button
            type="button"
            className={`bubble-menu-btn ${currentAlign === 'right' ? 'bubble-menu-btn--active' : ''}`}
            onClick={() => updateTableAttr({ align: 'right' })}
            title="Align Table Right"
          >
            <AlignRight size={14} />
          </button>
        </div>
      </div>

      <div className="bubble-menu-divider" />

      <div className="bubble-menu-section">
        <span className="bubble-menu-label">Padding</span>
        <select
          className="bubble-menu-select"
          value={currentInset}
          onChange={(e) => updateTableAttr({ inset: e.target.value })}
          title="Cell Padding"
        >
          <option value="compact">Compact (4pt)</option>
          <option value="normal">Normal (8pt)</option>
          <option value="spacious">Spacious (12pt)</option>
        </select>
      </div>

      <div className="bubble-menu-divider" />

      <div className="bubble-menu-section">
        <span className="bubble-menu-label">Cells</span>
        <div className="bubble-menu-row">
          <button
            type="button"
            className="bubble-menu-btn"
            onClick={() => editor.chain().focus().mergeCells().run()}
            title="Merge Selected Cells"
          >
            <Merge size={14} />
          </button>
          <button
            type="button"
            className="bubble-menu-btn"
            onClick={() => editor.chain().focus().splitCell().run()}
            title="Split Cell"
          >
            <Split size={14} />
          </button>
        </div>
      </div>



      <div className="bubble-menu-divider" />

      <div className="bubble-menu-section">
        <div className="bubble-menu-row">
          <button
            type="button"
            className="bubble-menu-btn bubble-menu-btn--danger"
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete Table"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </BubbleMenu>
  );
}
