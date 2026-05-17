export default function EditorToolbar({ editor }) {
  if (!editor) return null;

  const btn = (action, label, title, isActive = false) => (
    <button
      className={`toolbar-btn ${isActive ? 'toolbar-btn--active' : ''}`}
      onClick={action}
      title={title}
      type="button"
    >
      {label}
    </button>
  );

  const divider = () => <span className="toolbar-divider-vert" />;

  /**
   * Convert selected text into a table.
   * Splits rows on newlines and columns on tab, pipe (|), or comma.
   * First row becomes the header row.
   */
  const convertTextToTable = () => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');

    if (!selectedText.trim()) {
      alert('Select some text first.\n\nFormat: rows separated by newlines, columns by Tab, | or comma.');
      return;
    }

    // Detect delimiter: tab > pipe > comma
    let delimiter = '\t';
    if (selectedText.includes('\t')) {
      delimiter = '\t';
    } else if (selectedText.includes('|')) {
      delimiter = '|';
    } else if (selectedText.includes(',')) {
      delimiter = ',';
    }

    const lines = selectedText.split('\n').filter(l => l.trim());
    if (lines.length < 1) return;

    const rows = lines.map(line =>
      line.split(delimiter).map(cell => cell.trim())
    );

    // Normalize column count to the max across all rows
    const maxCols = Math.max(...rows.map(r => r.length), 1);
    const normalized = rows.map(r => {
      while (r.length < maxCols) r.push('');
      return r;
    });

    // Build TipTap table JSON
    const tableRows = normalized.map((row, rowIdx) => ({
      type: 'tableRow',
      content: row.map(cellText => ({
        type: rowIdx === 0 ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph', content: cellText ? [{ type: 'text', text: cellText }] : [] }],
      })),
    }));

    // Delete selected text and insert table
    editor.chain().focus().deleteSelection().insertContent({
      type: 'table',
      content: tableRows,
    }).run();
  };

  return (
    <div className="editor-toolbar">
      {/* Text formatting */}
      {btn(() => editor.chain().focus().toggleBold().run(),      <b>B</b>,       'Bold',      editor.isActive('bold'))}
      {btn(() => editor.chain().focus().toggleItalic().run(),    <i>I</i>,       'Italic',    editor.isActive('italic'))}
      {btn(() => editor.chain().focus().toggleUnderline().run(), <u>U</u>,       'Underline', editor.isActive('underline'))}
      {btn(() => editor.chain().focus().toggleStrike().run(),    <s>S</s>,       'Strikethrough', editor.isActive('strike'))}
      {divider()}

      {/* Headings */}
      {btn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), '§ 1.1', 'Section (1.1)', editor.isActive('heading', { level: 1 }))}
      {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), '§ 1.1.1', 'Subsection (1.1.1)', editor.isActive('heading', { level: 2 }))}
      {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), '§ 1.1.1.1', 'Sub-subsection (1.1.1.1)', editor.isActive('heading', { level: 3 }))}
      {divider()}

      {/* Lists */}
      {btn(() => editor.chain().focus().toggleBulletList().run(),  '• List',  'Bullet List',   editor.isActive('bulletList'))}
      {btn(() => editor.chain().focus().toggleOrderedList().run(), '1. List', 'Ordered List',  editor.isActive('orderedList'))}
      {divider()}

      {/* Blocks */}
      {btn(() => editor.chain().focus().toggleCodeBlock().run(),  '</>', 'Code Block', editor.isActive('codeBlock'))}
      {btn(() => editor.chain().focus().toggleBlockquote().run(), '❝',  'Blockquote', editor.isActive('blockquote'))}
      {divider()}

      {/* Table */}
      {btn(
        () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        '⊞ Table',
        'Insert 3×3 Table'
      )}
      {btn(convertTextToTable, '⊞ Text→Table', 'Convert selected text to table (rows: newlines, cols: tab/pipe/comma)')}

      {/* When inside a table: add/remove rows/cols */}
      {editor.isActive('table') && (
        <>
          {divider()}
          {btn(() => editor.chain().focus().addRowAfter().run(),    '+ Row',    'Add Row')}
          {btn(() => editor.chain().focus().deleteRow().run(),      '− Row',    'Delete Row')}
          {btn(() => editor.chain().focus().addColumnAfter().run(), '+ Col',    'Add Column')}
          {btn(() => editor.chain().focus().deleteColumn().run(),   '− Col',    'Delete Column')}
          {btn(() => editor.chain().focus().deleteTable().run(),    '✕ Table',  'Delete Table')}
        </>
      )}

      {divider()}
      {btn(() => editor.chain().focus().unsetAllMarks().clearNodes().run(), '✕ Clear', 'Clear Formatting')}

      {divider()}
      <button
        className="toolbar-btn"
        title="Insert Image (Local)"
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
        🖼 Image
      </button>

      {editor.isActive('math') && (
        <>
          {divider()}
          <button
            className="toolbar-btn"
            title="Toggle Display Mode (Centered)"
            onClick={() => {
              const { display } = editor.getAttributes('math');
              editor.chain().focus().updateAttributes('math', { display: !display }).run();
            }}
          >
            {editor.getAttributes('math').display ? '↳ Inline' : '↔ Display'}
          </button>
          <button
            className="toolbar-btn btn-danger-hover"
            title="Delete Equation"
            onClick={() => editor.chain().focus().deleteSelection().run()}
          >
            ✕ Delete Eq.
          </button>
        </>
      )}

      {editor.isActive('image') && (
        <>
          {divider()}
          <button
            className="toolbar-btn"
            title="Set Figure Caption (Name)"
            onClick={() => {
              const currentTitle = editor.getAttributes('image').title || '';
              const newTitle = prompt('Enter Figure Name (Caption):', currentTitle);
              if (newTitle !== null) {
                editor.chain().focus().updateAttributes('image', { title: newTitle }).run();
              }
            }}
          >
            🏷 Set Caption
          </button>
          <button
            className="toolbar-btn btn-danger-hover"
            title="Delete Selected Image"
            onClick={() => editor.chain().focus().deleteSelection().run()}
          >
            ✕ Delete Image
          </button>
        </>
      )}

      {editor.isActive('table') && (
        <>
          {divider()}
          <button
            className="toolbar-btn"
            title="Set Table Caption (Name)"
            onClick={() => {
              const currentCaption = editor.getAttributes('table').caption || '';
              const newCaption = prompt('Enter Table Name (Caption):', currentCaption);
              if (newCaption !== null) {
                editor.chain().focus().updateAttributes('table', { caption: newCaption }).run();
              }
            }}
          >
            🏷 Set Table Caption
          </button>
        </>
      )}
    </div>
  );
}
