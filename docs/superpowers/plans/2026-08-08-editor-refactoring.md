# Editor Refactoring & Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modularize `ChapterEditor.jsx`, clean up duplicated AST utilities in `docUtils.js`, optimize math formula rendering, and replace hardcoded canvas alignment calculations with unified helper functions.

**Architecture:** Extract inline NodeView components (`MathView`, `ImageView`, `TableView`) into `nodes/` subfolder. Implement `splitDocByHeadings` in `docUtils.js` and `alignCanvasObject` in `canvasConstants.js`.

**Tech Stack:** React, TipTap / ProseMirror, KaTeX, Konva Canvas, Vite.

## Global Constraints
- All existing TipTap node features (latex editing, image captions, table captions) must function identically.
- Ensure `npm run build` succeeds after each task.

---

### Task 1: Refactor `docUtils.js` & `presetTemplates.js`

**Files:**
- Modify: `frontend/src/features/Editor/components/ChapterEditor/docUtils.js`
- Modify: `frontend/src/features/Editor/components/ChapterEditor/KonvaPageEditor/presetTemplates.js`

- [ ] **Step 1: Refactor `docUtils.js` with shared `splitDocByHeadings`**
  Unify AST splitting logic and replace redundant null checks with optional chaining.

- [ ] **Step 2: Add template object builder in `presetTemplates.js`**
  Define `buildTemplateObject(type, overrides)` to reduce repetitive default style JSON properties across templates.

- [ ] **Step 3: Verify frontend build with `npm run build`**

---

### Task 2: Canvas Alignment Helpers & Magic Numbers

**Files:**
- Modify: `frontend/src/features/Editor/components/ChapterEditor/KonvaPageEditor/canvasConstants.js`
- Modify: `frontend/src/features/Editor/components/ChapterEditor/KonvaPageEditor/PropertyInspector.jsx`
- Modify: `frontend/src/features/Editor/components/ChapterEditor/KonvaPageEditor/KonvaStage.jsx`

- [ ] **Step 1: Add `alignCanvasObject(obj, page, alignmentType)` to `canvasConstants.js`**
  Export helper function that returns updated `{ x, y }` coordinates for horizontal/vertical centering and edge alignments.

- [ ] **Step 2: Replace inline alignment math in `PropertyInspector.jsx` and `KonvaStage.jsx`**
  Use `alignCanvasObject` helper for alignment operations.

- [ ] **Step 3: Verify frontend build with `npm run build`**

---

### Task 3: Extract NodeView Components & Modularize `ChapterEditor.jsx`

**Files:**
- Create: `frontend/src/features/Editor/components/ChapterEditor/nodes/MathView.jsx`
- Create: `frontend/src/features/Editor/components/ChapterEditor/nodes/ImageView.jsx`
- Create: `frontend/src/features/Editor/components/ChapterEditor/nodes/TableView.jsx`
- Modify: `frontend/src/features/Editor/components/ChapterEditor/ChapterEditor.jsx`

- [ ] **Step 1: Create `nodes/MathView.jsx`**
  Move `MathView` component and formula sanitization helper out of `ChapterEditor.jsx`.

- [ ] **Step 2: Create `nodes/ImageView.jsx`**
  Move `ImageView` component out of `ChapterEditor.jsx`.

- [ ] **Step 3: Create `nodes/TableView.jsx`**
  Move `TableView` component out of `ChapterEditor.jsx`.

- [ ] **Step 4: Update `ChapterEditor.jsx` to import NodeViews from `./nodes/`**
  Replace inline definitions with imports.

- [ ] **Step 5: Verify frontend build with `npm run build`**

---

### Task 4: Verification & Build Validation

- [ ] **Step 1: Run `npm run build` in `frontend/`**
- [ ] **Step 2: Execute `docUtils` unit tests**
