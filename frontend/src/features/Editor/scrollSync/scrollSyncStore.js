import { create } from "zustand";

/**
 * scrollSyncStore — coordinates the editor ↔ PDF scroll-sync feature across the
 * two sibling panels (EditorPanel / PreviewPanel), which share no other state.
 *
 * Split responsibilities:
 *   - `syncEnabled` is REACTIVE — components (the toolbar toggle) subscribe to it.
 *   - the element/anchor registrations are refs-in-a-store: they change often and
 *     are read imperatively by the useScrollSync controller via getState(), so
 *     they intentionally live outside React's render path (no re-render on set).
 */

const STORAGE_KEY = "acadoc_scroll_sync_enabled";

function loadEnabled() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "true"; // default ON
  } catch {
    return true;
  }
}

function saveEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch (_) {}
}

const useScrollSyncStore = create((set, get) => ({
  // ── Reactive UI state ──────────────────────────────────────────────────
  syncEnabled: loadEnabled(),
  toggleSync: () =>
    set((s) => {
      const next = !s.syncEnabled;
      saveEnabled(next);
      return { syncEnabled: next };
    }),
  setSyncEnabled: (enabled) => {
    saveEnabled(enabled);
    set({ syncEnabled: enabled });
  },

  // ── Imperative registrations (read via getState in the controller) ──────
  editorScroller: null, // `.chapter-editor-scroll` element
  editorDom: null, // ProseMirror content root (for querying headings)
  pdfScroller: null, // `.pdf-stage` element
  pdfAnchors: [], // [{ key, pdfTop }] computed after each PDF render/zoom
  anchorsVersion: 0, // bumps whenever pdfAnchors change → controller re-pairs

  setEditorScroller: (el) => set({ editorScroller: el }),
  setEditorDom: (el) => set({ editorDom: el }),
  setPdfScroller: (el) => set({ pdfScroller: el }),
  setPdfAnchors: (anchors) =>
    set((s) => ({
      pdfAnchors: anchors || [],
      anchorsVersion: s.anchorsVersion + 1,
    })),
}));

export default useScrollSyncStore;
