# Editor Paste Logic Optimization Design

## Overview
This design details the optimization and refactoring of the Editor paste processing subsystem (`useMathPaste`). We eliminate duplicate DOM parsing instances, replace quadratic nested loops in HTML list transformations, streamline the custom Markdown/LaTeX state machine parser, and clean up the decision tree in `handleRichPaste`.

## Problem Statement
1. `htmlParser.js` (42.7 KB) instantiates `new DOMParser()` repeatedly across multiple separate regex/DOM loops and runs quadratic nested `while` loops for MS Word list paragraph grouping.
2. `markdownParser.js` (27.1 KB) runs 15+ sequential regex passes across full clipboard text buffers for markdown headers, lists, bold, italics, tables, and math, causing heavy CPU and memory allocations on large pastes.
3. `useMathPaste.js` executes 8+ overlapping regex detection scans on every paste event, even for standard plain text.

## Proposed Architecture

```
[Clipboard Paste Event]
         │
         ▼
Extract rawText & htmlText (Exit early if empty)
         │
         ├─► [Single Standalone Formula?] ──► Insert Math Node
         │
         ├─► [Structured HTML (Word / Web)] ──► transformMathHtml()
         │                                       Single DOMParser instance
         │                                       Linear MS Word list pass
         │
         ├─► [Markdown / Math Text?] ─────► parseMarkdownMathToHtml()
         │                                       Tokenize math formulas ($ / $$)
         │                                       Single-pass Markdown conversion
         │                                       Re-inject math <span data-latex>
         │
         └─► [Standard Text / HTML] ─────────► Return false (Native TipTap handler)
```

## Detailed Specifications

### 1. `htmlParser.js` Optimization
- Reuse a single `DOMParser` instance inside `transformMathHtml(htmlText)`:
  - Parse `htmlText` into a DOM tree once at the start.
  - Run OMML, MathML, Word lists, and Word heading transformations on the single DOM tree.
  - Serialize back to HTML string once at the end via `doc.body.innerHTML`.
- Linearize MS Word list transformation:
  - Replace quadratic `while (i < listItems.length) { while (j ... ) }` with a single linear pass that groups adjacent list elements into `<ul>`/`<ol>` elements.

### 2. `markdownParser.js` Streamlining
- Refactor `parseMarkdownMathToHtml(markdownText)`:
  1. Tokenize math blocks (`$$...$$` display math and `$math$` inline math) into placeholders `__MATH_TOKEN_N__`.
  2. Perform single-pass markdown transformation for headings (`#`), lists (`*`, `-`, `1.`), bold (`**`), italic (`*`), code blocks (```), and tables.
  3. Replace placeholders `__MATH_TOKEN_N__` with HTML nodes `<span data-latex="escaped_latex" data-display="true|false"></span>`.

### 3. `useMathPaste.js` Decision Tree
- Update `handleRichPaste(view, event, editor)`:
  - Early exit if `!rawText && !htmlText`.
  - Check `isSingleFormula(rawText)` first (fastest check).
  - If structured HTML present (`htmlText`), call `transformMathHtml(htmlText)` once.
  - If markdown structure present (`rawText`), call `parseMarkdownMathToHtml(rawText)` once.
  - Return `false` for standard text pastes.

## Verification & Testing Plan
- Execute `npm run build` in `frontend/` to verify zero compilation errors.
- Run paste logic unit tests (`test-paste.mjs` / custom paste verification test script) to verify LaTeX math extraction, MS Word HTML list parsing, and markdown parsing.
