import { useEffect, useRef, useState } from 'react';
import useAcaStore from '@/contexts/projectStore/projectStore';

// Stages that map poll count → label (gives a sense of progress)
const STAGES = [
  { after: 0,  label: 'Sending document to compiler…' },
  { after: 1,  label: 'Generating LaTeX source…'       },
  { after: 2,  label: 'Running pdflatex (pass 1)…'     },
  { after: 4,  label: 'Running pdflatex (pass 2)…'     },
  { after: 6,  label: 'Finalising PDF…'                },
];

export default function PreviewPanel() {
  const compileJob = useAcaStore(s => s.compileJob);

  const isCompiling = compileJob?.status === 'pending' || compileJob?.status === 'processing';
  const isDone      = compileJob?.status === 'done';
  const isFailed    = compileJob?.status === 'failed';

  // Track elapsed seconds & poll count while compiling
  const [elapsed, setElapsed]     = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const prevStatus                = useRef(null);
  const timerRef                  = useRef(null);

  // Keep the last successful PDF so we can show it (faded) during recompile
  const [lastBlobUrl, setLastBlobUrl] = useState(null);

  // Track the "current" blobUrl that is fully rendered (no black flash)
  // iframeReady: the blobUrl we consider safe to show without opacity:0
  const [iframeReady, setIframeReady] = useState(false);
  // seenBlobUrl: the blobUrl we have already started the reveal timer for
  const seenBlobUrlRef = useRef(null);

  useEffect(() => {
    if (isDone && compileJob?.blobUrl) {
      // Only start the reveal timer once per new blobUrl
      if (seenBlobUrlRef.current === compileJob.blobUrl) return;
      seenBlobUrlRef.current = compileJob.blobUrl;

      setIframeReady(false);
      setLastBlobUrl(compileJob.blobUrl);

      // Give the browser/PDF engine 800 ms to paint the first frame
      // before we fade in the iframe. This prevents the black flash.
      const timer = setTimeout(() => {
        setIframeReady(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isDone, compileJob?.blobUrl]);

  useEffect(() => {
    if (isCompiling) {
      // Reset on new compile start
      if (prevStatus.current !== 'processing' && prevStatus.current !== 'pending') {
        setElapsed(0);
        setPollCount(0);
        setIframeReady(false);
        seenBlobUrlRef.current = null;
      }
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    prevStatus.current = compileJob?.status ?? null;
    return () => clearInterval(timerRef.current);
  }, [isCompiling, compileJob?.status]);

  // Increment poll count whenever status is 'processing'
  useEffect(() => {
    if (compileJob?.status === 'processing') {
      setPollCount(c => c + 1);
    }
  }, [compileJob?._tick]);

  // Show the progress UI while compiling OR while the fresh iframe is still loading
  const iframeLoading = isDone && compileJob?.blobUrl && !iframeReady;
  const showProgress  = isCompiling || iframeLoading;

  // Pick the current stage label
  const stageLabel = iframeLoading
    ? 'Rendering PDF document…'
    : [...STAGES].reverse().find(s => pollCount >= s.after)?.label ?? STAGES[0].label;

  // Fake-progress: grows from 5% to 90% based on elapsed, snaps to 100% when done
  const progressPct = (isDone || iframeLoading)
    ? 100
    : Math.min(90, 5 + elapsed * 6);

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
        {isDone && iframeReady && (
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

        {/* ── Idle: no compile yet ── */}
        {!compileJob && !lastBlobUrl && (
          <div className="preview-idle">
            <div className="preview-idle-icon">📄</div>
            <p className="preview-idle-text">Click <strong>Compile</strong> to generate your PDF</p>
          </div>
        )}

        {/* ── Old PDF shown faded while recompiling or rendering ── */}
        {showProgress && lastBlobUrl && (
          <iframe
            className="preview-iframe preview-iframe--stale"
            src={lastBlobUrl}
            title="Previous PDF (recompiling…)"
          />
        )}

        {/* ── Progress overlay (shown on top of faded PDF or blank) ── */}
        {showProgress && (
          <div className={`preview-progress-overlay ${lastBlobUrl ? 'preview-progress-overlay--floating' : ''}`}>
            <div className="preview-compile-spinner" />
            <div className="preview-progress-bar-wrap">
              <div
                className="preview-progress-bar"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="preview-compile-text">{stageLabel}</p>
            <p className="preview-compile-hint">{elapsed}s elapsed</p>
          </div>
        )}

        {/* ── Error ── */}
        {isFailed && (
          <div className="preview-error">
            <div className="preview-error-icon">✕</div>
            <p className="preview-error-title">Compilation Failed</p>
            <pre className="preview-error-log">{compileJob.error}</pre>
          </div>
        )}

        {/* ── Done: show fresh PDF only after the reveal timer fires ── */}
        {isDone && compileJob?.blobUrl && iframeReady && (
          <iframe
            className="preview-iframe preview-iframe--fresh"
            src={compileJob.blobUrl}
            title="PDF Preview"
          />
        )}
      </div>
    </div>
  );
}
