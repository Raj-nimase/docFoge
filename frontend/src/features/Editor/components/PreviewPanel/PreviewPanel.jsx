import useAcaStore from '@/contexts/projectStore/projectStore';

export default function PreviewPanel() {
  const compileJob = useAcaStore(s => s.compileJob);

  const isCompiling = compileJob?.status === 'pending' || compileJob?.status === 'processing';
  const rotateSpinner = isCompiling; // custom variable
  const isDone      = compileJob?.status === 'done';
  const isFailed    = compileJob?.status === 'failed';

  const handleDownload = () => {
    if (!compileJob?.blobUrl) return;
    const a = document.createElement('a');
    a.href = compileJob.blobUrl;
    a.download = 'document.pdf';
    a.click();
  };

  return (
    <div id="tour-preview-panel" className="preview-panel">
      <div className="preview-panel-header">
        <span className="preview-panel-label">
          <span className="preview-panel-dot" />
          PDF Preview
        </span>
        {isDone && (
          <button className="btn-download" onClick={handleDownload} title="Download PDF">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download PDF
          </button>
        )}
      </div>

      <div className="preview-body">
        {/* Idle state */}
        {!compileJob && (
          <div className="preview-idle">
            <div className="preview-idle-icon">📄</div>
            <p className="preview-idle-text">Click <strong>Compile</strong> to generate your PDF</p>
          </div>
        )}

        {/* Compiling */}
        {isCompiling && (
          <div className="preview-compiling">
            <div className="preview-compile-spinner" />
            <p className="preview-compile-text">Compiling with Tectonic…</p>
            <p className="preview-compile-hint">This takes 5–15 seconds</p>
          </div>
        )}

        {/* Error */}
        {isFailed && (
          <div className="preview-error">
            <div className="preview-error-icon">✕</div>
            <p className="preview-error-title">Compilation Failed</p>
            <pre className="preview-error-log">{compileJob.error}</pre>
          </div>
        )}

        {/* PDF iframe */}
        {isDone && compileJob.blobUrl && (
          <iframe
            className="preview-iframe"
            src={compileJob.blobUrl}
            title="PDF Preview"
          />
        )}
      </div>
    </div>
  );
}
