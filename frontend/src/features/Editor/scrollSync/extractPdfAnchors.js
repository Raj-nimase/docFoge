import { normalizeHeadingKey } from "./anchors.js";

/**
 * extractPdfAnchors — find editor heading titles inside the rendered PDF text
 * and compute their scroll offsets within the `.pdf-stage` container.
 *
 * This is async (getTextContent returns promises) and is re-run after each PDF
 * render and whenever zoom changes, since the scroll offsets change with zoom.
 *
 * @param {Object} pdfDoc           pdf.js PDFDocumentProxy (from getDocument(...).promise)
 * @param {HTMLElement} stageEl      the `.pdf-stage` scroll container
 * @param {HTMLElement[]} pageWraps  array of `.pdf-page-wrap` DOM elements (one per page, in order)
 * @param {number} zoom             current zoom multiplier (same scale used for rendering)
 * @param {Set<string>} editorKeys  the set of normalized heading keys from the editor
 *                                  (we only keep PDF lines whose key is in this set)
 * @returns {Promise<Array<{key:string, pdfTop:number}>>} in document order
 */
export async function extractPdfAnchors(
  pdfDoc,
  stageEl,
  pageWraps,
  zoom,
  editorKeys
) {
  if (!pdfDoc || !stageEl || !pageWraps?.length || !editorKeys?.size) return [];

  const anchors = [];
  const stageTop = stageEl.getBoundingClientRect().top;
  const scrollTop = stageEl.scrollTop;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    try {
      const pageWrap = pageWraps[pageNum - 1];
      if (!pageWrap) continue;

      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: zoom });

      // Offset of this page's top from the top of the scrollable content —
      // computed via bounding rects (robust regardless of offsetParent).
      const pageTop = pageWrap.getBoundingClientRect().top - stageTop + scrollTop;

      // Group text items into lines by y-coordinate (items with similar y belong to one line).
      const lines = groupIntoLines(textContent.items);

      for (const line of lines) {
        const key = normalizeHeadingKey(line.text);
        if (!key || !editorKeys.has(key)) continue;

        // Convert the line's y-coordinate from PDF points to CSS pixels at current zoom.
        // viewport.convertToViewportPoint returns [x_px, y_px] where origin is top-left.
        const [, yPx] = viewport.convertToViewportPoint(0, line.y);

        anchors.push({ key, pdfTop: pageTop + yPx });
      }
    } catch (err) {
      // Skip bad pages silently (same pattern as PdfViewer render loop).
      continue;
    }
  }

  return anchors;
}

/**
 * Group text items into lines by clustering on y-coordinate. Items with y within
 * ~2 units of each other are considered the same line. Returns lines sorted by y.
 *
 * @param {Array} items  textContent.items from pdf.js (each has { str, transform })
 * @returns {Array<{text:string, y:number}>}
 */
function groupIntoLines(items) {
  if (!items || items.length === 0) return [];

  // Each item has a transform matrix [a,b,c,d,e,f]; (e,f) is the position.
  // f is the y-coordinate (in PDF space, bottom-up; we only care about grouping).
  const yTolerance = 2;
  const lineMap = new Map(); // y_rounded -> { text, y }

  for (const item of items) {
    if (!item.str) continue;
    const y = item.transform[5];
    const yKey = Math.round(y / yTolerance) * yTolerance;

    if (!lineMap.has(yKey)) {
      lineMap.set(yKey, { text: item.str, y });
    } else {
      lineMap.get(yKey).text += item.str;
    }
  }

  return Array.from(lineMap.values()).sort((a, b) => b.y - a.y); // top-to-bottom
}
