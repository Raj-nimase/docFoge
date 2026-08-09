import { useEffect } from "react";
import useScrollSyncStore from "../scrollSync/scrollSyncStore.js";
import { collectEditorAnchors, pairAnchors, mapScroll } from "../scrollSync/anchors.js";

/**
 * useScrollSync — the single controller that drives editor ↔ PDF scroll sync.
 *
 * Mounted once (in EditorPage). It reads the elements/anchors registered in the
 * scrollSyncStore by ChapterEditor (editor scroller + DOM) and PdfViewer (PDF
 * scroller + PDF anchors), and installs scroll listeners that mirror one pane's
 * position onto the other via piecewise-linear anchor interpolation.
 *
 * Design notes:
 *   - Driver pane: whichever pane the user is interacting with drives; only its
 *     scroll events move the follower. Because the follower is never the driver,
 *     the position we write to it fires a scroll event that is simply ignored —
 *     that alone breaks the classic two-way feedback loop (no timers needed).
 *   - Editor anchors are recomputed each time a pane claims the driver role
 *     (cheap; keeps up with live editing / layout changes). PDF anchors come from
 *     the store, refreshed by PdfViewer on render/zoom (via anchorsVersion).
 *   - Follower position is set by DIRECT assignment (not scrollTo) to bypass the
 *     `.pdf-stage` CSS `scroll-behavior: smooth`, which would lag / oscillate.
 */
export default function useScrollSync() {
  const syncEnabled = useScrollSyncStore((s) => s.syncEnabled);
  const anchorsVersion = useScrollSyncStore((s) => s.anchorsVersion);
  const editorEl = useScrollSyncStore((s) => s.editorScroller);
  const pdfEl = useScrollSyncStore((s) => s.pdfScroller);

  useEffect(() => {
    if (!syncEnabled || !editorEl || !pdfEl) return;

    let pairs = [];
    let driver = null; // "editor" | "pdf" | null
    let rafId = null;

    const rebuildPairs = () => {
      const s = useScrollSyncStore.getState();
      const editorAnchors = collectEditorAnchors(s.editorScroller, s.editorDom);
      pairs = pairAnchors(editorAnchors, s.pdfAnchors);
    };
    rebuildPairs();

    const drive = (srcEl, dstEl, srcPane) => {
      if (rafId) return; // coalesce bursts of scroll events into one frame
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (pairs.length === 0) return;

        const dstMax = dstEl.scrollHeight - dstEl.clientHeight;
        const target = mapScroll(srcEl.scrollTop, pairs, srcPane, dstMax);
        if (target == null) return;
        if (Math.abs(dstEl.scrollTop - target) < 1) return; // avoid sub-pixel churn

        dstEl.scrollTop = target; // direct assignment → ignores smooth-scroll CSS
      });
    };

    const onEditorScroll = () => {
      if (driver == null) driver = "editor"; // claim on first scroll if idle
      if (driver !== "editor") return; // follower echo → ignored
      drive(editorEl, pdfEl, "editor");
    };
    const onPdfScroll = () => {
      if (driver == null) driver = "pdf";
      if (driver !== "pdf") return;
      drive(pdfEl, editorEl, "pdf");
    };

    // Claiming the driver role also recomputes editor anchors, so live edits /
    // layout shifts since the last interaction are reflected.
    const claimEditor = () => {
      if (driver !== "editor") {
        driver = "editor";
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        rebuildPairs();
      }
    };
    const claimPdf = () => {
      if (driver !== "pdf") {
        driver = "pdf";
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        rebuildPairs();
      }
    };

    const CLAIM_EVENTS = ["mouseenter", "wheel", "touchstart", "pointerdown"];
    CLAIM_EVENTS.forEach((ev) => {
      editorEl.addEventListener(ev, claimEditor, { passive: true });
      pdfEl.addEventListener(ev, claimPdf, { passive: true });
    });
    editorEl.addEventListener("scroll", onEditorScroll, { passive: true });
    pdfEl.addEventListener("scroll", onPdfScroll, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      CLAIM_EVENTS.forEach((ev) => {
        editorEl.removeEventListener(ev, claimEditor);
        pdfEl.removeEventListener(ev, claimPdf);
      });
      editorEl.removeEventListener("scroll", onEditorScroll);
      pdfEl.removeEventListener("scroll", onPdfScroll);
    };
    // Re-install when sync toggles, when PDF anchors change (new compile/zoom),
    // or when either registered scroller element changes identity.
  }, [syncEnabled, anchorsVersion, editorEl, pdfEl]);
}
