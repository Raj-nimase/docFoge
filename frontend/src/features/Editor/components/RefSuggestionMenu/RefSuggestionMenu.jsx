import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Table2, Image as ImageIcon } from 'lucide-react';
import useAcaStore from '@/contexts/projectStore/projectStore';

export const RefSuggestionMenu = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('none'); // 'none' | 'hint' | 'menu'
  const [menuType, setMenuType] = useState('all'); // 'table' | 'fig' | 'all'
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [range, setRange] = useState(null);
  const menuRef = useRef(null);

  // Collect all figures and tables across project chapters with exact Chapter.Index numbering (e.g. Figure 2.1)
  const collectProjectTargets = useCallback(() => {
    const list = [];
    if (!editor) return list;

    const docJson = editor.getJSON();
    if (!docJson || !Array.isArray(docJson.content)) return list;

    let globalTblIdx = 1;
    let globalFigIdx = 1;
    let currentChNum = 1;
    let chTblCount = 1;
    let chFigCount = 1;
    let currentChTitle = 'Chapter 1';
    let hasEncounteredChapter = false;

    const traverse = (nodeList) => {
      if (!Array.isArray(nodeList)) return;

      nodeList.forEach((node) => {
        // Detect Chapter Heading boundaries inside document tree
        if (node.type === 'heading' && (node.attrs?.isChapter || node.attrs?.level === 1) && !node.attrs?.isFrontMatter) {
          const headingText = (node.content || [])
            .map((c) => c.text || '')
            .join('')
            .trim();

          const chNumMatch = headingText.match(/(?:Chapter\s*|Ch\.?\s*)(\d+)/i);
          if (chNumMatch) {
            currentChNum = parseInt(chNumMatch[1], 10);
          } else if (hasEncounteredChapter) {
            currentChNum++;
          }

          hasEncounteredChapter = true;
          chTblCount = 1;
          chFigCount = 1;
          currentChTitle = headingText || `Chapter ${currentChNum}`;
        } else if (node.type === 'table') {
          const caption = (node.attrs?.caption || node.attrs?.title || '').trim();
          const numLabel = `Table ${currentChNum}.${chTblCount}`;
          const titleText = caption || numLabel;
          list.push({
            id: `tbl-${globalTblIdx}`,
            type: 'table',
            refCode: `tbl-${globalTblIdx}`,
            numLabel,
            title: titleText,
            displayLabel: `${numLabel}${caption ? `: ${caption}` : ''}`,
            chTitle: currentChTitle,
          });
          globalTblIdx++;
          chTblCount++;
        } else if (node.type === 'image' || node.type === 'imageGroup') {
          const caption = (node.attrs?.title || node.attrs?.alt || '').trim();
          const numLabel = `Figure ${currentChNum}.${chFigCount}`;
          const titleText = caption || numLabel;
          list.push({
            id: `fig-${globalFigIdx}`,
            type: 'figure',
            refCode: `fig-${globalFigIdx}`,
            numLabel,
            title: titleText,
            displayLabel: `${numLabel}${caption ? `: ${caption}` : ''}`,
            chTitle: currentChTitle,
          });
          globalFigIdx++;
          chFigCount++;
        }

        if (node.content) {
          traverse(node.content);
        }
      });
    };

    traverse(docJson.content);

    // Deduplicate
    const seen = new Set();
    const uniqueList = [];
    list.forEach((item) => {
      if (!seen.has(item.refCode)) {
        seen.add(item.refCode);
        uniqueList.push(item);
      }
    });

    return uniqueList;
  }, [editor]);

  // Monitor cursor updates
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { selection } = editor.state;
      if (!selection || !selection.empty) {
        setIsOpen(false);
        setMode('none');
        return;
      }

      const { $from } = selection;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

      // Match @ followed by letters/numbers/dashes
      const match = textBefore.match(/@([a-zA-Z0-9_-]*)$/);
      if (!match) {
        setIsOpen(false);
        setMode('none');
        return;
      }

      const searchStr = match[1].toLowerCase();
      const matchedText = `@${match[1]}`;
      const startPos = $from.pos - matchedText.length;
      const endPos = $from.pos;

      let posCoords = null;
      try {
        posCoords = editor.view.coordsAtPos($from.pos);
      } catch {
        posCoords = null;
      }

      if (!posCoords) {
        setIsOpen(false);
        setMode('none');
        return;
      }

      let category = 'all';
      if (searchStr.startsWith('tab') || searchStr.startsWith('table') || searchStr === 'tbl') {
        category = 'table';
      } else if (searchStr.startsWith('fig') || searchStr.startsWith('figure') || searchStr.startsWith('img')) {
        category = 'fig';
      }

      // Check if cursor is visible inside editor viewport bounds
      const editorDom = editor.view.dom.closest('.editor-scroll-container') || editor.view.dom.parentElement;
      if (editorDom) {
        const bounds = editorDom.getBoundingClientRect();
        if (posCoords.bottom < bounds.top || posCoords.top > bounds.bottom) {
          setIsOpen(false);
          setMode('none');
          return;
        }
      }

      // Show selection menu if typing table/fig or 3+ chars
      if (category === 'table' || category === 'fig' || (searchStr.length >= 3 && category === 'all')) {
        const allTargets = collectProjectTargets();
        const filtered = allTargets.filter((item) => {
          if (category === 'table' && item.type !== 'table') return false;
          if (category === 'fig' && item.type !== 'figure') return false;
          if (searchStr && category === 'all') {
            return (
              item.displayLabel.toLowerCase().includes(searchStr) ||
              item.title.toLowerCase().includes(searchStr)
            );
          }
          return true;
        });

        setItems(filtered);
        setMenuType(category);
        setQuery(searchStr);
        setRange({ from: startPos, to: endPos });
        setSelectedIndex(0);
        setCoords({
          top: posCoords.bottom + 6,
          left: Math.max(10, Math.min(posCoords.left, window.innerWidth - 290)),
        });
        setMode('menu');
        setIsOpen(true);
      } else if (searchStr.length <= 2) {
        // Show inline ghost hint badge @ cursor
        setCoords({
          top: posCoords.top - 2,
          left: posCoords.left + 14,
        });
        setMode('hint');
        setIsOpen(true);
      } else {
        setIsOpen(false);
        setMode('none');
      }
    };

    const handleScroll = () => {
      handleUpdate();
    };

    editor.on('selectionUpdate', handleUpdate);
    editor.on('update', handleUpdate);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('update', handleUpdate);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [editor, collectProjectTargets]);

  // Insert reference tag into document with exact Chapter.Index label (e.g. [@Figure 2.1])
  const selectItem = useCallback(
    (item) => {
      if (!editor || !item || !range) return;

      const numLabel = item.numLabel || (item.type === 'table' ? 'Table 1.1' : 'Figure 1.1');
      const tagText = `[${numLabel.startsWith('@') ? numLabel : `@${numLabel}`}] `;

      editor
        .chain()
        .focus()
        .insertContentAt(range, tagText)
        .run();

      setIsOpen(false);
      setMode('none');
    },
    [editor, range]
  );

  // Keyboard navigation when menu is open
  useEffect(() => {
    if (!isOpen || mode !== 'menu') return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (items.length > 0 && selectedIndex < items.length) {
          e.preventDefault();
          selectItem(items[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setMode('none');
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, mode, items, selectedIndex, selectItem]);

  if (!isOpen) return null;

  // Render Hint Mode via Portal to document.body
  if (mode === 'hint') {
    return createPortal(
      <div
        style={{ position: 'fixed', top: `${coords.top}px`, left: `${coords.left}px` }}
        className="ref-ghost-hint"
      >
        <span>@fig</span>
        <span className="ref-ghost-hint-sep">/</span>
        <span>@tbl</span>
      </div>,
      document.body
    );
  }

  // Render Menu Mode via Portal to document.body
  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: `${coords.top}px`, left: `${coords.left}px` }}
      className="ref-menu-popup"
    >
      <div className="ref-menu-header">
        <span>
          {menuType === 'table'
            ? 'Select Table Reference'
            : menuType === 'fig'
            ? 'Select Figure Reference'
            : 'Select Reference'}
        </span>
        <span className="text-[9px] font-normal text-[var(--text-faint)]">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="ref-menu-list">
        {items.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)] italic">
            No {menuType === 'table' ? 'tables' : menuType === 'fig' ? 'figures' : 'targets'} found in document
          </div>
        ) : (
          items.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const IconComponent = item.type === 'table' ? Table2 : ImageIcon;

            return (
              <button
                key={`${item.id}-${idx}`}
                onClick={() => selectItem(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`ref-menu-item ${isSelected ? 'ref-menu-item--selected' : ''}`}
              >
                <div className="ref-menu-icon-wrap">
                  <IconComponent size={14} />
                </div>

                <div className="ref-menu-text">
                  <div className="ref-menu-title">{item.numLabel}</div>
                  {item.title && item.title !== item.numLabel && (
                    <div className="ref-menu-desc">{item.title}</div>
                  )}
                </div>

                {item.chTitle && (
                  <div className="ref-menu-chapter">{item.chTitle}</div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body
  );
};

export default RefSuggestionMenu;
