import useDocStore from '@/contexts/projectStore/projectStore';

/**
 * LivePreview — right panel.
 * Renders blocks as a styled HTML document that approximates the final PDF.
 * Updates instantly on every keystroke — no compilation needed.
 * The "Download PDF" button triggers actual Tectonic compilation.
 */
export default function LivePreview({ onDownload, exportJob }) {
  const blocks   = useDocStore(s => s.blocks);
  const title    = useDocStore(s => s.title);
  const template = useDocStore(s => s.template);

  const isExporting = exportJob?.status === 'pending' || exportJob?.status === 'processing';
  const templateClass = `preview-doc preview-doc--${template}`;

  return (
    <div className="live-preview-panel">
      {/* Panel header */}
      <div className="preview-header">
        <span className="preview-header-title">
          <span className="preview-header-icon">📄</span>
          Output Preview
        </span>
        <div className="preview-header-actions">
          <span className="preview-badge">{template}</span>
          <button
            id="btn-download-pdf"
            className={`btn-download-pdf ${isExporting ? 'btn-download-pdf--loading' : ''}`}
            onClick={onDownload}
            disabled={isExporting || !blocks.length}
            title="Compile and download PDF"
          >
            {isExporting ? (
              <>
                <span className="download-spinner" />
                Compiling…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Document preview */}
      <div className="preview-scroll">
        <div className="preview-page-wrap">
          <div className={templateClass}>
            {/* Document title */}
            {title && title !== 'Untitled Document' && (
              <div className="preview-title">{title}</div>
            )}

            {/* Blocks */}
            {blocks.length === 0 ? (
              <p className="preview-empty">Start typing in the editor to see your document here…</p>
            ) : (
              blocks.map(block => <PreviewBlock key={block.id} block={block} />)
            )}
          </div>
        </div>

        {/* PDF export status */}
        {exportJob?.status === 'done' && (
          <div className="preview-export-done">
            <span>✓ PDF ready</span>
            {exportJob.blobUrl && (
              <a
                href={exportJob.blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="preview-open-pdf-link"
                download={`${exportJob.safeTitle || 'document'}.pdf`}
              >
                Click here if download didn't start →
              </a>
            )}
          </div>
        )}
        {exportJob?.status === 'failed' && (
          <div className="preview-export-error">
            ✕ Export failed — check console
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewBlock({ block }) {
  switch (block.type) {
    case 'heading':
      return <PreviewHeading block={block} />;
    case 'paragraph':
      return block.content?.trim()
        ? <p className="preview-paragraph">{block.content}</p>
        : null;
    case 'bullet_list':
      return (
        <ul className="preview-list preview-list--bullet">
          {(block.items || []).map((item, i) => (
            <li key={i} className="preview-list-item">{item}</li>
          ))}
        </ul>
      );
    case 'numbered_list':
      return (
        <ol className="preview-list preview-list--ordered">
          {(block.items || []).map((item, i) => (
            <li key={i} className="preview-list-item">{item}</li>
          ))}
        </ol>
      );
    default:
      return null;
  }
}

function PreviewHeading({ block }) {
  const text = block.content || '';
  if (!text.trim()) return null;
  switch (block.level) {
    case 1: return <h1 className="preview-h1">{text}</h1>;
    case 2: return <h2 className="preview-h2">{text}</h2>;
    case 3: return <h3 className="preview-h3">{text}</h3>;
    default: return <h2 className="preview-h2">{text}</h2>;
  }
}
