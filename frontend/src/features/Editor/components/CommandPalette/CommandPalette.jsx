import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Zap,
  Sigma,
  Table2,
  List,
  ListOrdered,
  Code2,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Eraser,
  FileDown,
  Play,
  HelpCircle,
  FolderTree,
  LayoutDashboard,
} from 'lucide-react';
import useAcaStore from '@/contexts/projectStore/projectStore';
import { setHeading, clearHeading } from '@/features/Editor/utils/editorFormatActions';

export default function CommandPalette({ isOpen, onClose, editor, onGoToDashboard, onStartTour, onCompile, onDownload }) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const currentProject = useAcaStore(s => s.getCurrentProject());
  const setActiveChapter = useAcaStore(s => s.setActiveChapter);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Command items definition
  const commands = useMemo(() => {
    const list = [
      // Actions
      {
        id: 'compile',
        category: 'Actions',
        icon: Play,
        label: 'Compile PDF',
        shortcut: 'Ctrl+Enter',
        action: () => {
          onCompile?.();
          onClose();
        },
      },
      {
        id: 'download',
        category: 'Actions',
        icon: FileDown,
        label: 'Download PDF',
        action: () => {
          onDownload?.();
          onClose();
        },
      },

      // Insert Elements
      {
        id: 'insert-math',
        category: 'Insert',
        icon: Sigma,
        label: 'Insert Math Equation',
        shortcut: 'Ctrl+Shift+M',
        action: () => {
          editor?.chain().focus().insertContent({ type: 'math', attrs: { latex: 'x', display: false } }).run();
          onClose();
        },
      },
      {
        id: 'insert-table',
        category: 'Insert',
        icon: Table2,
        label: 'Insert 3×3 Data Table',
        action: () => {
          editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          onClose();
        },
      },
      {
        id: 'bullet-list',
        category: 'Insert',
        icon: List,
        label: 'Bulleted List',
        action: () => {
          editor?.chain().focus().toggleBulletList().run();
          onClose();
        },
      },
      {
        id: 'ordered-list',
        category: 'Insert',
        icon: ListOrdered,
        label: 'Numbered List',
        action: () => {
          editor?.chain().focus().toggleOrderedList().run();
          onClose();
        },
      },
      {
        id: 'code-block',
        category: 'Insert',
        icon: Code2,
        label: 'Code Block',
        action: () => {
          editor?.chain().focus().toggleCodeBlock().run();
          onClose();
        },
      },
      {
        id: 'blockquote',
        category: 'Insert',
        icon: Quote,
        label: 'Blockquote Callout',
        action: () => {
          editor?.chain().focus().toggleBlockquote().run();
          onClose();
        },
      },

      // Formatting
      {
        id: 'heading-1',
        category: 'Format',
        icon: Heading1,
        label: 'Section Heading (H1)',
        action: () => {
          setHeading(editor, 1);
          onClose();
        },
      },
      {
        id: 'heading-2',
        category: 'Format',
        icon: Heading2,
        label: 'Subsection Heading (H2)',
        action: () => {
          setHeading(editor, 2);
          onClose();
        },
      },
      {
        id: 'heading-3',
        category: 'Format',
        icon: Heading3,
        label: 'Sub-subsection Heading (H3)',
        action: () => {
          setHeading(editor, 3);
          onClose();
        },
      },
      {
        id: 'heading-clear',
        category: 'Format',
        icon: Pilcrow,
        label: 'Normal Paragraph Text',
        action: () => {
          clearHeading(editor);
          onClose();
        },
      },
      {
        id: 'clear-marks',
        category: 'Format',
        icon: Eraser,
        label: 'Clear All Formatting',
        action: () => {
          editor?.chain().focus().unsetAllMarks().clearNodes().run();
          onClose();
        },
      },

      // Navigation
      {
        id: 'nav-dashboard',
        category: 'Navigation',
        icon: LayoutDashboard,
        label: 'Back to Dashboard',
        action: () => {
          onGoToDashboard?.();
          onClose();
        },
      },
      {
        id: 'nav-tour',
        category: 'Navigation',
        icon: HelpCircle,
        label: 'Start Interactive Tour',
        action: () => {
          onStartTour?.();
          onClose();
        },
      },
    ];

    // Add Chapters to Navigation
    if (currentProject?.chapters) {
      currentProject.chapters.forEach((ch, idx) => {
        list.push({
          id: `chapter-${ch.id}`,
          category: 'Chapters',
          icon: FolderTree,
          label: `Chapter ${idx + 1}: ${ch.title}`,
          action: () => {
            setActiveChapter(ch.id);
            const el = document.getElementById(`section-${ch.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            onClose();
          },
        });
      });
    }

    return list;
  }, [editor, currentProject, setActiveChapter, onClose, onCompile, onDownload, onGoToDashboard, onStartTour]);

  // Filter commands by search term
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    const query = search.toLowerCase().trim();
    return commands.filter(
      c => c.label.toLowerCase().includes(query) || c.category.toLowerCase().includes(query)
    );
  }, [search, commands]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  // Keep selected item in scroll view
  useEffect(() => {
    if (!listRef.current) return;
    const activeItem = listRef.current.querySelector('.cmd-palette-item--selected');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="cmd-palette-backdrop" onClick={onClose}>
      <div className="cmd-palette-modal" onClick={e => e.stopPropagation()}>
        {/* Search Bar */}
        <div className="cmd-palette-search">
          <Search size={18} className="cmd-palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Type a command or search sections... (Press Esc to close)"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <kbd className="cmd-palette-kbd">Esc</kbd>
        </div>

        {/* Command List */}
        <div className="cmd-palette-list" ref={listRef}>
          {filteredCommands.length === 0 ? (
            <div className="cmd-palette-empty">No commands found for "{search}"</div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon || Zap;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  className={`cmd-palette-item ${isSelected ? 'cmd-palette-item--selected' : ''}`}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="cmd-palette-item-left">
                    <Icon size={16} className="cmd-palette-item-icon" />
                    <span className="cmd-palette-item-label">{cmd.label}</span>
                  </div>
                  <div className="cmd-palette-item-right">
                    <span className="cmd-palette-item-cat">{cmd.category}</span>
                    {cmd.shortcut && <kbd className="cmd-palette-shortcut">{cmd.shortcut}</kbd>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="cmd-palette-footer">
          <span>
            Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>↵</kbd> to select
          </span>
          <span>AcaDoc SaaS Command Palette</span>
        </div>
      </div>
    </div>
  );
}
