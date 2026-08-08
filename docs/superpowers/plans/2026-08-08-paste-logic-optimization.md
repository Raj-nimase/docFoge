# Editor Paste Logic Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize paste processing speed, eliminate redundant DOM parsing allocations, linearize MS Word list transformations, and simplify markdown/math conversion pipelines.

**Architecture:** Reuse a single DOMParser instance in `htmlParser.js`, tokenize math formulas in `markdownParser.js` for single-pass markdown rendering, and re-order `useMathPaste.js` decision tree for early exits.

**Tech Stack:** JavaScript (ES6+), DOMParser, ProseMirror / TipTap, Vite.

## Global Constraints
- Preserve exact math formula extraction (`data-latex="..."`) from MS Word, Google Docs, ChatGPT, and raw LaTeX pastes.
- Keep HTML list formatting for Word and markdown pastes intact.
- Ensure `npm run build` succeeds after each task.

---

### Task 1: Optimize `htmlParser.js`

**Files:**
- Modify: `frontend/src/hooks/useMathPaste/htmlParser.js`

- [ ] **Step 1: Reuse single `DOMParser` instance in `transformMathHtml`**
  Parse HTML string once at top of `transformMathHtml` and execute DOM transforms on the single tree.

- [ ] **Step 2: Linearize MS Word list paragraph grouping in `transformWordListParagraphs`**
  Replace quadratic nested loops with a single linear pass that collects adjacent list elements and wraps them in `<ul>` / `<ol>`.

- [ ] **Step 3: Verify frontend build with `npm run build`**

---

### Task 2: Streamline `markdownParser.js`

**Files:**
- Modify: `frontend/src/hooks/useMathPaste/markdownParser.js`

- [ ] **Step 1: Implement math tokenization in `parseMarkdownMathToHtml`**
  Extract `$math$` and `$$math$$` into `__MATH_TOKEN_N__` placeholders before markdown parsing.

- [ ] **Step 2: Consolidate markdown element conversion**
  Convert headings, lists, bold, italics, tables, and code blocks in a single clean pass, then restore math placeholders as `<span data-latex="...">`.

- [ ] **Step 3: Verify frontend build with `npm run build`**

---

### Task 3: Clean `useMathPaste.js` Decision Tree

**Files:**
- Modify: `frontend/src/hooks/useMathPaste/useMathPaste.js`

- [ ] **Step 1: Re-order decision tree in `handleRichPaste`**
  1. Exit early if `!rawText && !htmlText`.
  2. Handle single standalone formula (`isSingleFormula`).
  3. Handle structured HTML (`htmlText`).
  4. Handle markdown / math text (`rawText`).
  5. Fallback to native TipTap paste handler.

- [ ] **Step 2: Verify frontend build with `npm run build`**

---

### Task 4: Verification & Build Validation

- [ ] **Step 1: Run `npm run build` in `frontend/`**
- [ ] **Step 2: Run paste logic unit tests (`frontend/test-paste.mjs`)**
