import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export const EDITOR_TOUR_STORAGE_KEY = 'acadoc_editor_tour_v1';

export function hasCompletedEditorTour() {
  try {
    return localStorage.getItem(EDITOR_TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markEditorTourComplete() {
  try {
    localStorage.setItem(EDITOR_TOUR_STORAGE_KEY, '1');
  } catch (_) {}
}

export function resetEditorTour() {
  try {
    localStorage.removeItem(EDITOR_TOUR_STORAGE_KEY);
  } catch (_) {}
}

/**
 * @param {{ onComplete?: () => void }} [options]
 */
export function startEditorTour(options = {}) {
  const { onComplete, markComplete = true } = options;

  const driverObj = driver({
    showProgress: true,
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayOpacity: 0.55,
    stagePadding: 10,
    stageRadius: 10,
    popoverOffset: 12,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it',
    progressText: '{{current}} of {{total}}',
    onDestroyed: () => {
      if (markComplete) markEditorTourComplete();
      onComplete?.();
    },
    steps: [
      {
        element: '#tour-left-panel',
        popover: {
          title: 'Document outline',
          description:
            '<p><strong>Front Matter</strong> holds title page, certificate, abstract, and similar sections. Items marked <em>auto</em> are generated from Document Settings.</p>' +
            '<p><strong>Chapters</strong> are your main body. Drag chapters using the <strong>⋮⋮</strong> handle to reorder. Double-click a chapter to rename it. Use <strong>+ Add Chapter</strong> for new sections, and <strong>✕</strong> to remove optional chapters.</p>',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '#tour-editor-toolbar',
        popover: {
          title: 'Formatting toolbar',
          description:
            '<p>Use this toolbar to style your content: <strong>bold</strong>, <em>italic</em>, headings, lists, tables, code blocks, quotes, and math (Σ).</p>' +
            '<p>Formatting applies to the chapter you selected in the outline on the left.</p>',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-editor-content',
        popover: {
          title: 'Chapter editor',
          description:
            '<p>Paste or type your content <strong>chapter by chapter</strong>—select a section on the left, then edit here.</p>' +
            '<p><strong>Tip:</strong> You can paste an image or screenshot directly into the editor. We extract text and formulas from the image using vision AI. This can take a few seconds, and results may not be perfect—especially for complex math—so review and fix anything that looks wrong.</p>' +
            '<p>Pasted content is a starting point; always proofread before compiling.</p>',
          side: 'left',
          align: 'start',
        },
      },
      {
        element: '#tour-preview-panel',
        popover: {
          title: 'PDF preview',
          description:
            '<p>After you click <strong>Compile</strong> in the top bar, your PDF appears here. Compilation usually takes 5–15 seconds.</p>' +
            '<p>When the build succeeds, you can preview the document and download the PDF from this panel.</p>',
          side: 'left',
          align: 'start',
        },
      },
      {
        element: '#tour-compile-btn',
        popover: {
          title: 'Compile',
          description:
            '<p>Click <strong>Compile</strong> to turn your chapters and settings into a publication-ready PDF using the LaTeX engine.</p>' +
            '<p>Compile whenever you want to check layout, citations, or the final look of your document.</p>',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-doc-settings',
        popover: {
          title: 'Document settings',
          description:
            '<p>Open <strong>⚙ Settings</strong> to set your title, authors, institution, and template-specific metadata.</p>' +
            '<p>Auto-generated sections (title page, table of contents) pull from these fields. You can also configure custom headers and footers here.</p>',
          side: 'bottom',
          align: 'end',
        },
      },
    ],
  });

  driverObj.drive();
  return driverObj;
}
