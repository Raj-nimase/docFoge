import { useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Code2,
  Quote,
  Table2,
  TableProperties,
  ImagePlus,
  Eraser,
  Rows3,
  Columns3,
  Trash2,
  Tag,
  Sigma,
  FileText,
  Type,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useEditorState } from '@tiptap/react';
import { HEADING_LEVELS, getActiveHeadingLevel, toggleHeading, clearHeading } from '@/features/Editor/utils/editorFormatActions';
import useAcaStore from '@/contexts/projectStore/projectStore';

function convertTextToParagraphsAndLists(lines) {
  const blocks = [];
  let currentBlock = [];
  let currentType = 'paragraph'; // 'paragraph', 'bulletList', 'orderedList'

  const getLineType = (trimmedLine) => {
    if (/^[-*•]\s+/.test(trimmedLine)) return 'bulletList';
    if (/^\d+[.)]\s+/.test(trimmedLine)) return 'orderedList';
    return 'paragraph';
  };

  const flushBlock = () => {
    if (currentBlock.length === 0) return;
    
    if (currentType === 'bulletList') {
      blocks.push({
        type: 'bulletList',
        content: currentBlock.map(line => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: line.replace(/^[-*•]\s+/, '').trim() }]
            }
          ]
        }))
      });
    } else if (currentType === 'orderedList') {
      blocks.push({
        type: 'orderedList',
        content: currentBlock.map(line => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: line.replace(/^\d+[.)]\s+/, '').trim() }]
            }
          ]
        }))
      });
    } else {
      blocks.push({
        type: 'paragraph',
        content: [{ type: 'text', text: currentBlock.join(' ') }]
      });
    }
    currentBlock = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flushBlock();
      continue;
    }

    const type = getLineType(trimmed);
    if (type !== currentType) {
      flushBlock();
      currentType = type;
    }
    currentBlock.push(trimmed);
  }
  flushBlock();
  return blocks;
}

const FONT_OPTIONS = [
  {
    id: 'Times New Roman',
    label: 'Times New Roman',
    tag: 'Academic Standard (IEEE/MSBTE)',
    fontFamily: "'Times New Roman', Times, serif",
  },
  {
    id: 'Arial',
    label: 'Arial',
    tag: 'Clean Sans-Serif',
    fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
  },
  {
    id: 'Courier New',
    label: 'Courier New',
    tag: 'Monospace / Code',
    fontFamily: "'Courier New', Courier, monospace",
  },
  {
    id: 'New Computer Modern',
    label: 'New Computer Modern',
    tag: 'LaTeX Math Paper',
    fontFamily: "'New Computer Modern', 'Computer Modern', serif",
  },
  {
    id: 'Libertinus Serif',
    label: 'Libertinus Serif',
    tag: 'Journal Serif',
    fontFamily: "'Libertinus Serif', 'Georgia', serif",
  },
];

function FontSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const currentProject = useAcaStore((s) => s.getCurrentProject());
  const updateMetadata = useAcaStore((s) => s.updateMetadata);

  const activeFontId = currentProject?.metadata?.fontFamily || 'Times New Roman';
  const activeFont = FONT_OPTIONS.find((f) => f.id === activeFontId) || FONT_OPTIONS[0];

  const handleSelect = (fontId) => {
    updateMetadata({ fontFamily: fontId });
    setIsOpen(false);
  };

  return (
    <div className="toolbar-font-container">
      <button
        type="button"
        className="toolbar-btn toolbar-btn--font"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        title="Document PDF Font Family"
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1, minWidth: 0 }}>
          <Type size={14} className="toolbar-heading-icon" style={{ flexShrink: 0 }} />
          <span className="toolbar-font-name" style={{ fontFamily: activeFont.fontFamily }}>
            {activeFont.label}
          </span>
        </span>
        <ChevronDown size={13} style={{ opacity: 0.65, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }} />
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99988 }} onClick={() => setIsOpen(false)} />
          <div className="toolbar-font-menu">
            <div className="toolbar-font-header">
              Document Font Family
            </div>
            {FONT_OPTIONS.map((f) => {
              const selected = f.id === activeFontId;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`toolbar-font-option ${selected ? 'toolbar-font-option--active' : ''}`}
                  onClick={() => handleSelect(f.id)}
                >
                  <div>
                    <div className="toolbar-font-option-title" style={{ fontFamily: f.fontFamily }}>
                      {f.label}
                    </div>
                    <div className="toolbar-font-option-desc">{f.tag}</div>
                  </div>
                  {selected && <Check size={14} style={{ color: 'var(--accent)', marginLeft: 8, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function ToolbarGroups({ editor }) {
  // Subscribe to editor transactions so active states track the selection
  // even though this component is mounted outside MultiChapterEditor.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        bulletList: e.isActive('bulletList'),
        orderedList: e.isActive('orderedList'),
        codeBlock: e.isActive('codeBlock'),
        blockquote: e.isActive('blockquote'),
        table: e.isActive('table'),
        math: e.isActive('math'),
        image: e.isActive('image'),
        activeHeadingLevel: getActiveHeadingLevel(e),
        mathDisplay: !!e.getAttributes('math').display,
      };
    },
  });

  if (!editor || !state) return null;

  const activeLevel = state.activeHeadingLevel;

  const iconBtn = (action, icon, label, title, isActive = false) => (
    <button
      type="button"
      className={`toolbar-btn toolbar-btn--icon${isActive ? ' toolbar-btn--active' : ''}`}
      onClick={action}
      title={title}
    >
      {icon}
      <span className="toolbar-btn-label">{label}</span>
    </button>
  );

  const headingBtn = ({ level, label, short, hint }) => {
    const icons = { 1: Heading1, 2: Heading2, 3: Heading3 };
    const Icon = icons[level];
    const active = activeLevel === level;
    const title = active
      ? `Unmark as ${label.toLowerCase()} — click to convert to normal text`
      : hint;
    return (
      <button
        key={level}
        type="button"
        className={`toolbar-btn toolbar-btn--heading${active ? ' toolbar-btn--active' : ''}`}
        onClick={() => toggleHeading(editor, level)}
        title={title}
      >
        <Icon size={15} strokeWidth={2} className="toolbar-heading-icon" />
        <span className="toolbar-heading-text">
          <span className="toolbar-heading-name">{label}</span>
          <span className="toolbar-heading-num">{short}</span>
        </span>
      </button>
    );
  };

  const divider = () => <span className="toolbar-divider-vert" />;

  const group = (label, children) => (
    <div className="toolbar-group" role="group" aria-label={label}>
      <span className="toolbar-group-label">{label}</span>
      <div className="toolbar-group-btns">{children}</div>
    </div>
  );

  const convertTextToTable = () => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');

    if (!selectedText.trim()) {
      alert('Select some text first.\n\nFormat: rows separated by newlines, columns by Tab, | or comma.');
      return;
    }

    let delimiter = '\t';
    if (selectedText.includes('\t')) delimiter = '\t';
    else if (selectedText.includes('|')) delimiter = '|';
    else if (selectedText.includes(',')) delimiter = ',';

    const lines = selectedText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/^\s*\|?[\s:|\\-]*-[\s:|\\-]*\|?\s*$/.test(l));

    if (lines.length < 1) return;

    const parseLine = (line) => {
      let s = line;
      if (delimiter === '|' && s.startsWith('|')) s = s.slice(1);
      if (delimiter === '|' && s.endsWith('|')) s = s.slice(0, -1);

      if (delimiter !== '|') {
        return s.split(delimiter).map((c) => c.trim());
      }

      const cells = [];
      let currentCell = '';
      let inMath = false;
      let inDoubleMath = false;
      let inCode = false;
      let i = 0;

      while (i < s.length) {
        const char = s[i];
        const nextChar = s[i + 1];

        if (char === '\\' && (nextChar === '|' || nextChar === '$' || nextChar === '`')) {
          currentCell += char + nextChar;
          i += 2;
          continue;
        }

        if (char === '`' && !inMath && !inDoubleMath) {
          inCode = !inCode;
          currentCell += char;
          i++;
          continue;
        }

        if (char === '$' && !inCode) {
          if (nextChar === '$') {
            inDoubleMath = !inDoubleMath;
            currentCell += '$$';
            i += 2;
            continue;
          } else {
            inMath = !inMath;
            currentCell += '$';
            i++;
            continue;
          }
        }

        if (char === '|' && !inMath && !inDoubleMath && !inCode) {
          cells.push(currentCell.trim());
          currentCell = '';
          i++;
          continue;
        }

        currentCell += char;
        i++;
      }
      cells.push(currentCell.trim());
      return cells;
    };

    const rows = lines.map(parseLine);
    const maxCols = Math.max(...rows.map(r => r.length), 1);
    const normalized = rows.map(r => {
      while (r.length < maxCols) r.push('');
      return r;
    });

    const tableRows = normalized.map((row, rowIdx) => ({
      type: 'tableRow',
      content: row.map(cellText => ({
        type: rowIdx === 0 ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph', content: cellText ? [{ type: 'text', text: cellText }] : [] }],
      })),
    }));

    editor.chain().focus().deleteSelection().insertContent({
      type: 'table',
      content: tableRows,
    }).run();
  };

  return (
    <div className="toolbar-groups-row">
      {group('Font', <FontSelector />)}

      {divider()}

      {group('Text', <>
        {iconBtn(() => editor.chain().focus().toggleBold().run(), <Bold size={15} />, 'Bold', 'Bold (Ctrl+B)', state.bold)}
        {iconBtn(() => editor.chain().focus().toggleItalic().run(), <Italic size={15} />, 'Italic', 'Italic (Ctrl+I)', state.italic)}
        {iconBtn(() => editor.chain().focus().toggleUnderline().run(), <Underline size={15} />, 'Underline', 'Underline (Ctrl+U)', state.underline)}
        {iconBtn(() => editor.chain().focus().toggleStrike().run(), <Strikethrough size={15} />, 'Strike', 'Strikethrough', state.strike)}
      </>)}

      {divider()}

      {group('Sections', <>
        {HEADING_LEVELS.map(headingBtn)}
        {activeLevel !== null && (
          <button
            type="button"
            className="toolbar-btn toolbar-btn--icon toolbar-btn--normal"
            onClick={() => clearHeading(editor)}
            title="Remove section marking — normal paragraph"
          >
            <Pilcrow size={15} />
            <span className="toolbar-btn-label">Normal</span>
          </button>
        )}
      </>)}

      {divider()}

      {group('Lists', <>
        {iconBtn(() => editor.chain().focus().toggleBulletList().run(), <List size={15} />, 'Bullets', 'Bullet list', state.bulletList)}
        {iconBtn(() => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={15} />, 'Numbered', 'Numbered list', state.orderedList)}
      </>)}

      {divider()}

      {group('Blocks', <>
        {iconBtn(() => editor.chain().focus().toggleCodeBlock().run(), <Code2 size={15} />, 'Code', 'Code block', state.codeBlock)}
        {iconBtn(() => editor.chain().focus().toggleBlockquote().run(), <Quote size={15} />, 'Quote', 'Blockquote', state.blockquote)}
      </>)}

      {divider()}

      {group('Insert', <>
        <button
          type="button"
          className={`toolbar-btn toolbar-btn--icon${state.math ? ' toolbar-btn--active' : ''}`}
          title={state.math ? "Convert Math formula back to plain text" : "Insert Math Equation (Ctrl+Shift+M)"}
          onClick={() => {
            if (editor.isActive('math')) {
              const { $from } = editor.state.selection;
              for (let d = $from.depth; d >= 0; d--) {
                const node = $from.node(d);
                if (node?.type?.name === 'math') {
                  const pos = $from.before(d);
                  const latex = node.attrs.latex || '';
                  editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).insertContentAt(pos, latex).run();
                  return;
                }
              }
            }
            editor.chain().focus().insertContent({ type: 'math', attrs: { latex: 'x', display: false } }).run();
          }}
        >
          <Sigma size={15} />
          <span className="toolbar-btn-label">{state.math ? 'To Text' : 'Equation'}</span>
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn--icon"
          title="Insert 3×3 table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <Table2 size={15} />
          <span className="toolbar-btn-label">Table</span>
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn--icon"
          title="Convert selected text to table (rows: newlines, cols: tab/pipe/comma)"
          onClick={convertTextToTable}
        >
          <TableProperties size={15} />
          <span className="toolbar-btn-label">Text→Table</span>
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn--icon"
          title="Insert image from file"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/png, image/jpeg, image/jpg';
            input.onchange = (e) => {
              const file = e.target.files[0];
              if (!file) return;
              const showToast = useAcaStore.getState().showToast;
              showToast('info', 'Uploading image...');
              import('@/services/api').then(({ uploadImage }) => {
                uploadImage(file)
                  .then((url) => {
                    editor.chain().focus().setImage({ src: url }).run();
                    showToast('success', 'Image uploaded ✓');
                  })
                  .catch((err) => {
                    console.error('Image upload failed:', err);
                    showToast('error', 'Image upload failed: ' + err.message);
                  });
              });
            };
            input.click();
          }}
        >
          <ImagePlus size={15} />
          <span className="toolbar-btn-label">Image</span>
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn--icon"
          title="Import text/paragraphs from PDF, DOCX, or text file"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf, .docx, .txt, .md';
            input.onchange = (e) => {
              const file = e.target.files[0];
              if (!file) return;
              const showToast = useAcaStore.getState().showToast;
              showToast('info', 'Uploading and extracting text...');
              import('@/services/api').then(({ uploadDocument }) => {
                uploadDocument(file)
                  .then((res) => {
                    if (res && res.text) {
                      const lines = res.text.split('\n');
                      const blocks = convertTextToParagraphsAndLists(lines);
                      editor.chain().focus().insertContent(blocks).run();
                      showToast('success', 'Document text imported ✓');
                    } else {
                      showToast('error', 'No text extracted from document');
                    }
                  })
                  .catch((err) => {
                    console.error('Document import failed:', err);
                    showToast('error', 'Import failed: ' + err.message);
                  });
              });
            };
            input.click();
          }}
        >
          <FileText size={15} />
          <span className="toolbar-btn-label">Import File</span>
        </button>
      </>)}

      {state.table && (
        <>
          {divider()}
          {group('Table edit', <>
            <button type="button" className="toolbar-btn toolbar-btn--icon" onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row">
              <Rows3 size={15} /><span className="toolbar-btn-label">+ Row</span>
            </button>
            <button type="button" className="toolbar-btn toolbar-btn--icon" onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">
              <Rows3 size={15} /><span className="toolbar-btn-label">− Row</span>
            </button>
            <button type="button" className="toolbar-btn toolbar-btn--icon" onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column">
              <Columns3 size={15} /><span className="toolbar-btn-label">+ Col</span>
            </button>
            <button type="button" className="toolbar-btn toolbar-btn--icon" onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">
              <Columns3 size={15} /><span className="toolbar-btn-label">− Col</span>
            </button>
            <button type="button" className="toolbar-btn toolbar-btn--icon btn-danger-hover" onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">
              <Trash2 size={15} /><span className="toolbar-btn-label">Delete</span>
            </button>
            <button
              type="button"
              className="toolbar-btn toolbar-btn--icon"
              title="Set table caption"
              onClick={() => {
                const currentCaption = editor.getAttributes('table').caption || '';
                const newCaption = prompt('Enter Table Name (Caption):', currentCaption);
                if (newCaption !== null) {
                  editor.chain().focus().updateAttributes('table', { caption: newCaption }).run();
                }
              }}
            >
              <Tag size={15} /><span className="toolbar-btn-label">Caption</span>
            </button>
          </>)}
        </>
      )}

      {state.math && (
        <>
          {divider()}
          {group('Equation', <>
            <button
              type="button"
              className="toolbar-btn toolbar-btn--icon"
              title="Toggle display mode (centered)"
              onClick={() => {
                const { display } = editor.getAttributes('math');
                editor.chain().focus().updateAttributes('math', { display: !display }).run();
              }}
            >
              <Sigma size={15} />
              <span className="toolbar-btn-label">{state.mathDisplay ? 'Inline' : 'Display'}</span>
            </button>
            <button
              type="button"
              className="toolbar-btn toolbar-btn--icon btn-danger-hover"
              title="Delete equation"
              onClick={() => editor.chain().focus().deleteSelection().run()}
            >
              <Trash2 size={15} /><span className="toolbar-btn-label">Delete</span>
            </button>
          </>)}
        </>
      )}

      {state.image && (
        <>
          {divider()}
          {group('Figure', <>
            <button
              type="button"
              className="toolbar-btn toolbar-btn--icon"
              title="Set figure caption"
              onClick={() => {
                const currentTitle = editor.getAttributes('image').title || '';
                const newTitle = prompt('Enter Figure Name (Caption):', currentTitle);
                if (newTitle !== null) {
                  editor.chain().focus().updateAttributes('image', { title: newTitle }).run();
                }
              }}
            >
              <Tag size={15} /><span className="toolbar-btn-label">Caption</span>
            </button>
            <button
              type="button"
              className="toolbar-btn toolbar-btn--icon btn-danger-hover"
              title="Delete image"
              onClick={() => editor.chain().focus().deleteSelection().run()}
            >
              <Trash2 size={15} /><span className="toolbar-btn-label">Delete</span>
            </button>
          </>)}
        </>
      )}

      {divider()}

      <button
        type="button"
        className="toolbar-btn toolbar-btn--icon"
        title="Clear all formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <Eraser size={15} />
        <span className="toolbar-btn-label">Clear</span>
      </button>
    </div>
  );
}
