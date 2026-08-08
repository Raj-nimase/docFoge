# Editor Code Refactoring & Modularization Design

## Overview
This design details the comprehensive refactoring and modularization of the **Editor** subsystem in **docForge**. We eliminate redundant AST traversals, remove multi-pass candidate loops in math rendering, replace hardcoded canvas magic numbers with central constants, and extract inline NodeView components out of the monolith `ChapterEditor.jsx`.

## Objectives
1. **Reduce Complexity**: Modularize `ChapterEditor.jsx` (1,211 lines) by extracting custom NodeView components (`MathView`, `ImageView`, `TableView`) into dedicated files.
2. **Optimize Performance**: Replace multi-pass candidate KaTeX rendering loops with a single unified LaTeX sanitizer.
3. **Eliminate Duplication**: Refactor `docUtils.js` to share AST splitting logic and eliminate 12+ redundant null-guard checks.
4. **Remove Magic Numbers**: Consolidate canvas dimensions, snap offsets, and alignment math into `canvasConstants.js`.
5. **DRY Preset Templates**: Reduce template JSON boilerplate in `presetTemplates.js` using a template object builder.

## Proposed File Architecture

```
frontend/src/features/Editor/components/ChapterEditor/
├── ChapterEditor.jsx              # Main TipTap Editor container (reduced to ~600 lines)
├── CertificateCanvasEditor.jsx    # Certificate visual canvas editor
├── docUtils.js                    # Cleaned AST split/merge utilities
├── docParserWorker.js             # Web worker for doc parsing
├── nodes/                         # Extracted NodeView components
│   ├── MathView.jsx               # KaTeX Math formula rendering & editing node
│   ├── ImageView.jsx              # Captionable image figure node
│   └── TableView.jsx              # Table caption & controls node
└── KonvaPageEditor/
    ├── canvasConstants.js         # Unified constants, page defaults & alignment math
    ├── presetTemplates.js         # Refactored preset templates with builder
    ├── KonvaStage.jsx             # Canvas rendering engine
    └── PropertyInspector.jsx      # Canvas object property controls
```

## Detailed Specifications

### 1. `docUtils.js` Refactoring
- Implement a shared helper `splitDocByHeadings(doc, headingLevel = 1)` that scans `doc.content` and partitions AST nodes whenever a matching heading is encountered.
- Update `splitSingleDocToChapters(doc)` and `splitSingleDocToProject(doc)` to call `splitDocByHeadings`.
- Replace verbose checks (`if (doc && doc.content && Array.isArray(doc.content))`) with concise optional chaining (`doc?.content`).

### 2. NodeView Component Extraction (`nodes/`)
- Extract `MathView` component into `nodes/MathView.jsx`.
- Extract `ImageView` component into `nodes/ImageView.jsx`.
- Extract `TableView` component into `nodes/TableView.jsx`.
- Move KaTeX formula sanitizer function `cleanLatexForKatex(latex)` into `nodes/MathView.jsx`.

### 3. Canvas Alignment Math & Constants (`canvasConstants.js`)
- Add helper function `alignCanvasObject(obj, page, type)` to `canvasConstants.js`:
  - `'center-h'`: `x = (page.width - obj.width) / 2`
  - `'center-v'`: `y = (page.height - obj.height) / 2`
  - `'left'`: `x = 0`
  - `'right'`: `x = page.width - obj.width`
  - `'top'`: `y = 0`
  - `'bottom'`: `y = page.height - obj.height`
- Replace hardcoded calculations in `PropertyInspector.jsx` and `KonvaStage.jsx` with calls to `alignCanvasObject`.

### 4. Preset Templates Object Builder (`presetTemplates.js`)
- Define `createTemplateObject(type, defaults, overrides)` helper in `presetTemplates.js` to supply default properties (`opacity: 1`, `rotation: 0`, `align: 'center'`, `fontFamily: 'Inter'`).
- Refactor `PRESET_TEMPLATES` array to use this builder.

## Verification & Testing Plan
- `npm run build` in `frontend/` after every task to ensure zero syntax or import errors.
- Run unit test suite for `docUtils.js` functions.
