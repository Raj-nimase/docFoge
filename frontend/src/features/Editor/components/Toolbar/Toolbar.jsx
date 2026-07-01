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
} from 'lucide-react';
import { HEADING_LEVELS, getActiveHeadingLevel, toggleHeading, clearHeading } from '@/features/Editor/utils/editorFormatActions';

export default function EditorToolbar({ editor }) {
  if (!editor) return null;

  const activeLevel = getActiveHeadingLevel(editor);

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

    const lines = selectedText.split('\n').filter(l => l.trim());
    if (lines.length < 1) return;

    const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
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
    <div id="tour-editor-toolbar" className="editor-toolbar">
      {group('Text', <>
        {iconBtn(() => editor.chain().focus().toggleBold().run(), <Bold size={15} />, 'Bold', 'Bold (Ctrl+B)', editor.isActive('bold'))}
        {iconBtn(() => editor.chain().focus().toggleItalic().run(), <Italic size={15} />, 'Italic', 'Italic (Ctrl+I)', editor.isActive('italic'))}
        {iconBtn(() => editor.chain().focus().toggleUnderline().run(), <Underline size={15} />, 'Underline', 'Underline (Ctrl+U)', editor.isActive('underline'))}
        {iconBtn(() => editor.chain().focus().toggleStrike().run(), <Strikethrough size={15} />, 'Strike', 'Strikethrough', editor.isActive('strike'))}
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
        {iconBtn(() => editor.chain().focus().toggleBulletList().run(), <List size={15} />, 'Bullets', 'Bullet list', editor.isActive('bulletList'))}
        {iconBtn(() => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={15} />, 'Numbered', 'Numbered list', editor.isActive('orderedList'))}
      </>)}

      {divider()}

      {group('Blocks', <>
        {iconBtn(() => editor.chain().focus().toggleCodeBlock().run(), <Code2 size={15} />, 'Code', 'Code block', editor.isActive('codeBlock'))}
        {iconBtn(() => editor.chain().focus().toggleBlockquote().run(), <Quote size={15} />, 'Quote', 'Blockquote', editor.isActive('blockquote'))}
      </>)}

      {divider()}

      {group('Insert', <>
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
              if (file) {
                const reader = new FileReader();
                reader.onload = (readerEvent) => {
                  editor.chain().focus().setImage({ src: readerEvent.target.result }).run();
                };
                reader.readAsDataURL(file);
              }
            };
            input.click();
          }}
        >
          <ImagePlus size={15} />
          <span className="toolbar-btn-label">Image</span>
        </button>
      </>)}

      {editor.isActive('table') && (
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

      {editor.isActive('math') && (
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
              <span className="toolbar-btn-label">{editor.getAttributes('math').display ? 'Inline' : 'Display'}</span>
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

      {editor.isActive('image') && (
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
