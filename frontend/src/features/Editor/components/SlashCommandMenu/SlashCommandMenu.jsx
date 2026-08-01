import { useState, useEffect, useRef } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Sigma,
  Table2,
  List,
  ListOrdered,
  Code2,
  Quote,
} from 'lucide-react';
import { setHeading } from '@/features/Editor/utils/editorFormatActions';

const SLASH_ITEMS = [
  {
    id: 'h1',
    title: 'Section Heading',
    desc: 'Main section title (H1)',
    icon: Heading1,
    action: (editor) => setHeading(editor, 1),
  },
  {
    id: 'h2',
    title: 'Subsection Heading',
    desc: 'Secondary subsection title (H2)',
    icon: Heading2,
    action: (editor) => setHeading(editor, 2),
  },
  {
    id: 'h3',
    title: 'Sub-subsection Heading',
    desc: 'Deep subsection title (H3)',
    icon: Heading3,
    action: (editor) => setHeading(editor, 3),
  },
  {
    id: 'math',
    title: 'Math Equation',
    desc: 'Insert LaTeX math formula',
    icon: Sigma,
    action: (editor) => editor.chain().focus().insertContent({ type: 'math', attrs: { latex: 'x', display: false } }).run(),
  },
  {
    id: 'table',
    title: 'Table 3×3',
    desc: 'Insert formatted data table',
    icon: Table2,
    action: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'bullet',
    title: 'Bullet List',
    desc: 'Create an un-ordered bulleted list',
    icon: List,
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'numbered',
    title: 'Numbered List',
    desc: 'Create a numbered list',
    icon: ListOrdered,
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'code',
    title: 'Code Block',
    desc: 'Formatted code block',
    icon: Code2,
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'quote',
    title: 'Blockquote',
    desc: 'Insert callout blockquote',
    icon: Quote,
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
];

export default function SlashCommandMenu({ editor }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { selection } = editor.state;
      const { $from, empty } = selection;

      if (!empty) {
        setIsOpen(false);
        return;
      }

      // Get line text before cursor
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
      const match = textBefore.match(/\/([a-zA-Z0-9]*)$/);

      if (match) {
        const searchTerm = match[1];
        setQuery(searchTerm);

        // Get exact cursor coordinates via ProseMirror view API
        try {
          const posCoords = editor.view.coordsAtPos($from.pos);
          if (posCoords) {
            setCoords({
              top: posCoords.bottom + 6,
              left: Math.min(posCoords.left, window.innerWidth - 280),
            });
            setIsOpen(true);
            return;
          }
        } catch (e) {
          console.warn("coordsAtPos error:", e);
        }
      }

      setIsOpen(false);
    };

    editor.on('selectionUpdate', handleUpdate);
    editor.on('update', handleUpdate);

    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  const filteredItems = SLASH_ITEMS.filter(
    item => item.title.toLowerCase().includes(query.toLowerCase()) || item.desc.toLowerCase().includes(query.toLowerCase())
  );

  const executeItem = (item) => {
    if (!editor || !item) return;

    // Delete the typed '/' and search query
    const { selection } = editor.state;
    const { $from } = selection;
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
    const match = textBefore.match(/\/([a-zA-Z0-9]*)$/);

    if (match) {
      const startPos = $from.pos - match[0].length;
      editor.chain().focus().deleteRange({ from: startPos, to: $from.pos }).run();
    }

    item.action(editor);
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, selectedIndex, filteredItems]);

  if (!isOpen || filteredItems.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="slash-menu-popup"
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
    >
      <div className="slash-menu-header">Basic Blocks</div>
      <div className="slash-menu-list">
        {filteredItems.map((item, idx) => {
          const Icon = item.icon;
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={item.id}
              className={`slash-menu-item ${isSelected ? 'slash-menu-item--selected' : ''}`}
              onClick={() => executeItem(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div className="slash-menu-icon-wrap">
                <Icon size={16} />
              </div>
              <div className="slash-menu-text">
                <div className="slash-menu-title">{item.title}</div>
                <div className="slash-menu-desc">{item.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
