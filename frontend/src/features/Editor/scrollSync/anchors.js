/**
 * scrollSync/anchors.js — pure, dependency-free helpers for editor ↔ PDF
 * scroll synchronization.
 *
 * The two panes (editor `.chapter-editor-scroll` and PDF `.pdf-stage`) are NOT
 * proportional: the PDF has extra leading pages (title / TOC / certificate) and
 * different content density, and is independently zoomable. The reliable shared
 * landmark is the HEADINGS, which appear in the same order on both sides. We
 * build a list of matched {editorTop, pdfTop} anchor pairs and map a scroll
 * position from one pane to the other by piecewise-linear interpolation between
 * the two bracketing anchors.
 *
 * Everything here is framework-agnostic and unit-testable (see anchors.test.js).
 */

/**
 * Normalize a heading string to a stable matching key shared by both panes.
 *
 * Editor headings expose only the title text ("METHOD 1 …", "CHAPTER 1: REFERENCES",
 * "ABSTRACT") — the "1.1" / "1.1.1" numbers are CSS ::before counters, absent from
 * textContent. The Typst PDF, by contrast, renders those numbers as real text
 * ("1.1 METHOD 1 …"). So we strip any leading numbering/lettering + a leading
 * "CHAPTER N:" prefix and lowercase, leaving the bare title as the join key.
 *
 * Mirrors `stripAllPrefixes` in ChapterEditor.jsx (looped strip of dotted-numeric,
 * single-letter, and roman prefixes) so both panes normalize identically.
 *
 * @param {string} text
 * @returns {string} normalized key ("" if nothing meaningful remains)
 */
export function normalizeHeadingKey(text) {
  if (!text) return "";
  let s = String(text).replace(/\s+/g, " ").trim();

  // Drop a leading "CHAPTER 3:" / "CHAPTER 3 -" / "CHAPTER 3" prefix (editor h1s).
  s = s.replace(/^chapter\s+\d+\s*[:.\-–—]?\s*/i, "");

  // Loop-strip leading section numbering the way stripAllPrefixes does:
  //   dotted numeric ("1", "1.1", "1.1.1"), single letter ("a.", "b)"),
  //   roman numeral ("i.", "iv)").
  let prev;
  do {
    prev = s;
    s = s.replace(/^\s*\d+(?:\.\d+)*(?:\.\s+|\s+|\.$)/, "");
    s = s.replace(/^\s*[a-z][.)]\s+/i, "");
    s = s.replace(/^\s*(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[.)]\s+/i, "");
  } while (s !== prev);

  return s.trim().toLowerCase();
}

/**
 * Collect heading anchors from the live editor DOM, as scroll offsets within the
 * editor's scroll container.
 *
 * @param {HTMLElement} container  the `.chapter-editor-scroll` element (scroller)
 * @param {HTMLElement} editorDom  the ProseMirror content root to query headings in
 * @returns {Array<{key:string, top:number}>} in document order, only keyed headings
 */
export function collectEditorAnchors(container, editorDom) {
  if (!container || !editorDom) return [];
  const containerTop = container.getBoundingClientRect().top;
  const scrollTop = container.scrollTop;

  const nodes = editorDom.querySelectorAll("h1, h2, h3, h4");
  const anchors = [];
  nodes.forEach((node) => {
    const key = normalizeHeadingKey(node.textContent || "");
    if (!key) return;
    // Offset of this heading from the top of the scrollable content.
    const top = node.getBoundingClientRect().top - containerTop + scrollTop;
    anchors.push({ key, top });
  });
  return anchors;
}

/**
 * Pair editor anchors with PDF anchors by walking both lists in document order.
 *
 * For each editor anchor we advance a cursor through the PDF anchors to the next
 * one with a matching key at/after the cursor. PDF headings with no editor
 * counterpart (title page, TOC, certificate) are simply skipped, which is exactly
 * what makes the "extra PDF pages" case work. Order-preserving, so duplicate
 * heading titles pair up 1st-with-1st, 2nd-with-2nd, etc.
 *
 * @param {Array<{key:string, top:number}>} editorAnchors
 * @param {Array<{key:string, pdfTop:number}>} pdfAnchors
 * @returns {Array<{editorTop:number, pdfTop:number}>} sorted ascending by editorTop
 */
export function pairAnchors(editorAnchors, pdfAnchors) {
  if (!editorAnchors?.length || !pdfAnchors?.length) return [];

  const pairs = [];
  let cursor = 0;
  for (const ea of editorAnchors) {
    let found = -1;
    for (let i = cursor; i < pdfAnchors.length; i++) {
      if (pdfAnchors[i].key === ea.key) {
        found = i;
        break;
      }
    }
    if (found !== -1) {
      pairs.push({ editorTop: ea.top, pdfTop: pdfAnchors[found].pdfTop });
      cursor = found + 1;
    }
  }

  // Guard monotonicity: interpolation assumes both axes strictly increase.
  pairs.sort((a, b) => a.editorTop - b.editorTop);
  const monotonic = [];
  let lastPdf = -Infinity;
  for (const p of pairs) {
    if (p.pdfTop > lastPdf) {
      monotonic.push(p);
      lastPdf = p.pdfTop;
    }
  }
  return monotonic;
}

/**
 * Map a scroll offset from the source pane to the target pane using the paired
 * anchors. Piecewise-linear interpolation between bracketing anchors, with:
 *   - before the first pair  → clamp to the first pair's target (dead zone that
 *     absorbs the PDF's extra leading pages / keeps the editor pinned at top),
 *   - after the last pair    → extrapolate along the last segment's slope,
 *   - final result clamped to [0, dstMaxScroll].
 *
 * @param {number} srcTop     current scrollTop of the source pane
 * @param {Array<{editorTop:number, pdfTop:number}>} pairs
 * @param {"editor"|"pdf"} srcPane   which pane srcTop belongs to
 * @param {number} dstMaxScroll      max scrollTop of the destination (scrollHeight - clientHeight)
 * @returns {number|null} destination scrollTop, or null if no mapping is possible
 */
export function mapScroll(srcTop, pairs, srcPane, dstMaxScroll) {
  if (!pairs || pairs.length === 0) return null;

  const srcKey = srcPane === "editor" ? "editorTop" : "pdfTop";
  const dstKey = srcPane === "editor" ? "pdfTop" : "editorTop";

  const clamp = (v) => Math.max(0, Math.min(v, dstMaxScroll ?? Infinity));

  // Before / at the first anchor → dead zone, pin to first target.
  if (srcTop <= pairs[0][srcKey]) {
    return clamp(pairs[0][dstKey]);
  }
  // After / at the last anchor → extrapolate along the last segment.
  const last = pairs[pairs.length - 1];
  if (srcTop >= last[srcKey]) {
    if (pairs.length === 1) return clamp(last[dstKey]);
    const prev = pairs[pairs.length - 2];
    const dSrc = last[srcKey] - prev[srcKey];
    const slope = dSrc === 0 ? 0 : (last[dstKey] - prev[dstKey]) / dSrc;
    return clamp(last[dstKey] + (srcTop - last[srcKey]) * slope);
  }

  // Binary-search the bracketing pair [lo, hi] with lo.src <= srcTop < hi.src.
  let lo = 0;
  let hi = pairs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pairs[mid][srcKey] <= srcTop) lo = mid;
    else hi = mid;
  }

  const a = pairs[lo];
  const b = pairs[hi];
  const dSrc = b[srcKey] - a[srcKey];
  const t = dSrc === 0 ? 0 : (srcTop - a[srcKey]) / dSrc;
  return clamp(a[dstKey] + t * (b[dstKey] - a[dstKey]));
}
