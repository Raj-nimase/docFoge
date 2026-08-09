/**
 * anchors.test.js — standalone tests for the pure scroll-sync helpers.
 *
 * The project has no test runner wired up (empty *.test.js stubs, no vitest),
 * so this file is written to run directly with Node's built-in test runner:
 *
 *     node --test src/features/Editor/scrollSync/anchors.test.js
 *
 * anchors.js is pure (no DOM / framework imports), so it runs unmodified in Node.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeHeadingKey, pairAnchors, mapScroll } from "./anchors.js";

test("normalizeHeadingKey strips CHAPTER prefix", () => {
  assert.equal(normalizeHeadingKey("CHAPTER 1: REFERENCES"), "references");
  assert.equal(normalizeHeadingKey("Chapter 12 - Results"), "results");
});

test("normalizeHeadingKey strips section numbering (editor has none, PDF does)", () => {
  // PDF side: number is real text
  assert.equal(
    normalizeHeadingKey("1.1 METHOD 1 (RECOMMENDED): INSTALL WITH THE SKILLS CLI"),
    "method 1 (recommended): install with the skills cli"
  );
  // Editor side: number is a CSS counter, absent from textContent → same key
  assert.equal(
    normalizeHeadingKey("METHOD 1 (RECOMMENDED): INSTALL WITH THE SKILLS CLI"),
    "method 1 (recommended): install with the skills cli"
  );
  assert.equal(normalizeHeadingKey("1.1.1 Method 2: Copy the file"), "method 2: copy the file");
});

test("normalizeHeadingKey handles empty / number-only lines", () => {
  assert.equal(normalizeHeadingKey("CHAPTER 1"), "");
  assert.equal(normalizeHeadingKey(""), "");
  assert.equal(normalizeHeadingKey("   "), "");
});

test("pairAnchors skips extra PDF headings (title/TOC/certificate)", () => {
  const editor = [
    { key: "abstract", top: 0 },
    { key: "references", top: 500 },
    { key: "method 1", top: 800 },
  ];
  // PDF has title/toc/certificate up front with no editor match
  const pdf = [
    { key: "title page", pdfTop: 0 },
    { key: "certificate", pdfTop: 900 },
    { key: "table of contents", pdfTop: 1800 },
    { key: "abstract", pdfTop: 2700 },
    { key: "references", pdfTop: 3600 },
    { key: "method 1", pdfTop: 4200 },
  ];
  const pairs = pairAnchors(editor, pdf);
  assert.deepEqual(pairs, [
    { editorTop: 0, pdfTop: 2700 },
    { editorTop: 500, pdfTop: 3600 },
    { editorTop: 800, pdfTop: 4200 },
  ]);
});

test("pairAnchors matches duplicate titles in order", () => {
  const editor = [
    { key: "overview", top: 100 },
    { key: "overview", top: 900 },
  ];
  const pdf = [
    { key: "overview", pdfTop: 1000 },
    { key: "overview", pdfTop: 5000 },
  ];
  const pairs = pairAnchors(editor, pdf);
  assert.deepEqual(pairs, [
    { editorTop: 100, pdfTop: 1000 },
    { editorTop: 900, pdfTop: 5000 },
  ]);
});

test("mapScroll interpolates linearly within a segment", () => {
  const pairs = [
    { editorTop: 0, pdfTop: 2000 },
    { editorTop: 1000, pdfTop: 4000 },
  ];
  // editor → pdf: halfway between anchors
  assert.equal(mapScroll(500, pairs, "editor", 10000), 3000);
  // pdf → editor: halfway back
  assert.equal(mapScroll(3000, pairs, "pdf", 10000), 500);
});

test("mapScroll clamps before the first anchor (extra-pages dead zone)", () => {
  const pairs = [
    { editorTop: 0, pdfTop: 2000 }, // first shared heading is deep in the PDF
    { editorTop: 1000, pdfTop: 4000 },
  ];
  // Editor at very top → PDF pinned to first heading (page 8), NOT page 1.
  assert.equal(mapScroll(0, pairs, "editor", 10000), 2000);
  // Scrolling the PDF through its leading pages (< first pdfTop) → editor stays at top.
  assert.equal(mapScroll(0, pairs, "pdf", 10000), 0);
  assert.equal(mapScroll(1500, pairs, "pdf", 10000), 0);
});

test("mapScroll extrapolates past the last anchor and clamps to dstMax", () => {
  const pairs = [
    { editorTop: 0, pdfTop: 2000 },
    { editorTop: 1000, pdfTop: 4000 },
  ];
  // slope = 2 (pdf per editor); 200 past last editor anchor → 4000 + 400 = 4400
  assert.equal(mapScroll(1200, pairs, "editor", 10000), 4400);
  // clamp to dstMax
  assert.equal(mapScroll(100000, pairs, "editor", 4300), 4300);
});

test("mapScroll returns null when there are no pairs", () => {
  assert.equal(mapScroll(500, [], "editor", 10000), null);
});
