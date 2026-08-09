import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import useScrollSyncStore from '@/features/Editor/scrollSync/scrollSyncStore';
import { collectEditorAnchors } from '@/features/Editor/scrollSync/anchors';
import { extractPdfAnchors } from '@/features/Editor/scrollSync/extractPdfAnchors';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const DEFAULT_ZOOM = 1.25;  // wider panel — start a bit zoomed in so text is crisp
const ZOOM_STEP = 0.15;

/**
 * PdfViewer — vertical continuous scroll, one canvas per page.
 *
 * Props:
 *   blobUrl  {string}   – object URL of the compiled PDF
 *   stale    {boolean}  – fades the viewer while a new compile runs
 */
export default function PdfViewer({ blobUrl, stale = false }) {
  const stageRef      = useRef(null);
  const pdfDocRef     = useRef(null);
  const canvasRefs    = useRef([]);       // one ref per page canvas
  const pageWrapRefs  = useRef([]);       // one ref per page wrapper (for anchor offsets)
  const renderTaskRef = useRef([]);       // in-flight render tasks, indexed by page

  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom]             = useState(DEFAULT_ZOOM);
  const [loadError, setLoadError]   = useState(null);
  const [pagesRendered, setPagesRendered] = useState(0); // bumps once render loop finishes

  // ── Scroll-sync wiring ────────────────────────────────────────────────────
  const syncEnabled  = useScrollSyncStore(s => s.syncEnabled);
  const toggleSync   = useScrollSyncStore(s => s.toggleSync);
  const editorDom    = useScrollSyncStore(s => s.editorDom);
  const setPdfScroller = useScrollSyncStore(s => s.setPdfScroller);
  const setPdfAnchors  = useScrollSyncStore(s => s.setPdfAnchors);
  const zoomRef        = useRef(zoom);
  zoomRef.current = zoom;

  // ── Load document whenever blobUrl changes ───────────────────────────────
  useEffect(() => {
    if (!blobUrl) return;
    let cancelled = false;

    setLoadError(null);
    setTotalPages(0);
    setCurrentPage(1);
    canvasRefs.current = [];
    pageWrapRefs.current = [];
    renderTaskRef.current = [];

    // Cancel any previous document
    if (pdfDocRef.current) {
      pdfDocRef.current.destroy();
      pdfDocRef.current = null;
    }

    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument(blobUrl).promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load PDF');
      }
    })();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [blobUrl]);

  // ── Render all pages whenever pdf or zoom changes ────────────────────────
  useEffect(() => {
    if (!pdfDocRef.current || totalPages === 0) return;

    // Cancel all in-flight renders
    renderTaskRef.current.forEach(t => t?.cancel());
    renderTaskRef.current = [];

    let cancelled = false;

    (async () => {
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        if (cancelled) break;

        try {
          const page     = await pdfDocRef.current.getPage(pageNum);
          if (cancelled) break;

          const dpr      = window.devicePixelRatio || 1;
          // Render at the user's zoom level, scaled up by DPR for sharp output
          const viewport = page.getViewport({ scale: zoom * dpr });
          const canvas   = canvasRefs.current[pageNum - 1];
          if (!canvas) continue;

          const ctx = canvas.getContext('2d');

          // Physical canvas pixels = viewport size (already DPR-scaled)
          canvas.width  = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          // CSS size = logical pixels (divide back by DPR)
          canvas.style.width  = `${Math.floor(viewport.width  / dpr)}px`;
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

          const task = page.render({ canvasContext: ctx, viewport });
          renderTaskRef.current[pageNum - 1] = task;
          await task.promise;
        } catch (err) {
          if (err?.name === 'RenderingCancelledException') break;
          // skip bad pages silently
        }
      }
      if (!cancelled) setPagesRendered(p => p + 1); // signal anchors can be extracted
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current.forEach(t => t?.cancel());
      renderTaskRef.current = [];
    };
  }, [zoom, totalPages]);

  // ── Scroll-sync: register the PDF scroller ───────────────────────────────
  useEffect(() => {
    setPdfScroller(stageRef.current);
    return () => {
      if (useScrollSyncStore.getState().pdfScroller === stageRef.current) {
        setPdfScroller(null);
      }
    };
  }, [setPdfScroller]);

  // ── Scroll-sync: (re)build PDF heading anchors after each render (which also
  //    fires on zoom), or once the editor DOM registers. Sync-enabled only. ───
  useEffect(() => {
    if (!syncEnabled || totalPages === 0 || pagesRendered === 0) return;
    if (!pdfDocRef.current || !stageRef.current || !editorDom) return;

    let cancelled = false;
    (async () => {
      const { editorScroller } = useScrollSyncStore.getState();
      const editorKeys = new Set(
        collectEditorAnchors(editorScroller, editorDom).map(a => a.key)
      );
      const anchors = await extractPdfAnchors(
        pdfDocRef.current,
        stageRef.current,
        pageWrapRefs.current,
        zoomRef.current,
        editorKeys,
      );
      if (!cancelled) setPdfAnchors(anchors);
    })();

    return () => { cancelled = true; };
  }, [syncEnabled, totalPages, pagesRendered, editorDom, setPdfAnchors]);

  // ── Scroll spy — update current page indicator ──────────────────────────
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || totalPages === 0) return;

    const onScroll = () => {
      const stageTop = stage.getBoundingClientRect().top;
      let closest = 1;
      let minDist = Infinity;
      canvasRefs.current.forEach((canvas, i) => {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dist = Math.abs(rect.top - stageTop);
        if (dist < minDist) { minDist = dist; closest = i + 1; }
      });
      setCurrentPage(closest);
    };

    stage.addEventListener('scroll', onScroll, { passive: true });
    return () => stage.removeEventListener('scroll', onScroll);
  }, [totalPages]);

  // ── Zoom helpers (clamped continuous) ───────────────────────────────────
  const zoomIn    = useCallback(() => setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2))), []);
  const zoomOut   = useCallback(() => setZoom(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2))), []);
  const zoomReset = useCallback(() => setZoom(DEFAULT_ZOOM), []);

  // ── Ctrl + mouse-wheel zoom ──────────────────────────────────────────────
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else              zoomOut();
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomIn, zoomOut, totalPages]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (!stageRef.current) return;
      if ((e.key === '=' || e.key === '+') && e.ctrlKey) { e.preventDefault(); zoomIn(); }
      if (e.key === '-' && e.ctrlKey)                    { e.preventDefault(); zoomOut(); }
      if (e.key === '0' && e.ctrlKey)                    { e.preventDefault(); zoomReset(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomIn, zoomOut, zoomReset]);

  if (loadError) {
    return (
      <div className="pdf-viewer-error">
        <span className="pdf-viewer-error-icon">✕</span>
        <p>Could not render PDF</p>
        <pre>{loadError}</pre>
      </div>
    );
  }

  return (
    <div className={`pdf-viewer ${stale ? 'pdf-viewer--stale' : ''}`}>

      {/* ── Toolbar ── */}
      <div className="pdf-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="preview-status-chip" style={{ position: 'static', top: 'auto', right: 'auto', pointerEvents: 'auto' }}>
            <span className="preview-panel-dot" />
            PDF Preview
          </span>
          <span className="pdf-page-indicator">
            {totalPages > 0 ? `${currentPage} / ${totalPages}` : '—'}
          </span>
        </div>

        <div className="pdf-toolbar-group">
          <button
            className={`pdf-toolbar-btn pdf-link-btn ${syncEnabled ? 'pdf-link-btn--on' : ''}`}
            onClick={toggleSync}
            title={syncEnabled ? 'Scroll linked to editor — click to unlink' : 'Link scroll to editor'}
            aria-pressed={syncEnabled}
          >
            <span aria-hidden="true">🔗</span> Link
          </button>
          <button className="pdf-toolbar-btn" onClick={zoomOut}  disabled={zoom <= MIN_ZOOM} title="Zoom out (Ctrl −)">−</button>
          <button className="pdf-toolbar-zoom-label" onClick={zoomReset} title="Reset zoom (Ctrl 0)">
            {Math.round(zoom * 100)}%
          </button>
          <button className="pdf-toolbar-btn" onClick={zoomIn}   disabled={zoom >= MAX_ZOOM} title="Zoom in (Ctrl +)">+</button>
        </div>
      </div>

      {/* ── Scrollable stage — all pages stacked vertically ── */}
      <div className="pdf-stage" ref={stageRef}>
        {Array.from({ length: totalPages }, (_, i) => (
          <div
            key={i}
            className="pdf-page-wrap"
            ref={el => { pageWrapRefs.current[i] = el; }}
          >
            <canvas
              className="pdf-canvas"
              ref={el => { canvasRefs.current[i] = el; }}
            />
          </div>
        ))}

        {totalPages === 0 && !loadError && (
          <div className="pdf-render-spinner">
            <div className="preview-compile-spinner" />
          </div>
        )}
      </div>
    </div>
  );
}
