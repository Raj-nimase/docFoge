# Comprehensive Typst Table Customization & Editor Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full table customization (positioning, page-breaking, column sizing, visual presets, Booktabs, zebra striping, cell merging, padding, borders) in `typstGenerator.js` and create an inline Floating Table Control Ribbon (`TableBubbleMenu`) in the TipTap editor.

**Architecture:** Extended TipTap table schema attributes store formatting choices on document nodes; `TableBubbleMenu.jsx` provides a floating contextual UI matching the AcaDoc theme; `typstGenerator.js` translates node attributes into native Typst `table(...)` and `#figure(...)` code.

**Tech Stack:** React 19, TipTap (`@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`), Lucide Icons, Typst 0.11+.

---

## Global Constraints

- Preserve all existing document structure parsing and compiling functions.
- Follow AcaDoc design system colors (dark UI, subtle borders, accent colors).
- Ensure all node tests pass (`node --test`).

---

### Task 1: Typst Table Generator Backend Enhancements

**Files:**
- Modify: `backend/src/services/typstGenerator.js`
- Create: `backend/test-table-generator-styles.js`

**Interfaces:**
- Consumes: TipTap Table JSON nodes with attributes (`tableStyle`, `align`, `inset`, `borderColor`, `borderWidth`, `headerFill`, `repeatHeader`, `colwidth`, `colspan`, `rowspan`, `fill`).
- Produces: Native Typst `table(...)` markup inside breakable figure containers.

- [ ] **Step 1: Write backend unit tests for Typst table styles and parameters**

```javascript
// backend/test-table-generator-styles.js
import assert from "node:assert/strict";
import test from "node:test";
import typstPkg from "./src/services/typstGenerator.js";
const { convertTipTapToTypst } = typstPkg;

test("convertTipTapToTypst renders Booktabs style table without vertical lines", () => {
  const tableDoc = [
    {
      type: "table",
      attrs: { tableStyle: "booktabs" },
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [{ type: "text", text: "Header" }] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "text", text: "Data" }] },
          ],
        },
      ],
    },
  ];

  const state = { lastOrderedEnd: 0, lastWasContinuation: false, chNum: 1, figCount: 0, tblCount: 0 };
  const output = convertTipTapToTypst(tableDoc, null, 0, state);

  assert.match(output, /stroke: none/);
  assert.match(output, /table\.hline/);
});

test("convertTipTapToTypst renders Zebra style with alternating row fills", () => {
  const tableDoc = [
    {
      type: "table",
      attrs: { tableStyle: "zebra" },
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [{ type: "text", text: "Header" }] },
          ],
        },
      ],
    },
  ];

  const state = { lastOrderedEnd: 0, lastWasContinuation: false, chNum: 1, figCount: 0, tblCount: 0 };
  const output = convertTipTapToTypst(tableDoc, null, 0, state);

  assert.match(output, /calc\.even\(y\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test-table-generator-styles.js`
Expected: FAIL (Booktabs and Zebra style rules not yet implemented)

- [ ] **Step 3: Implement table style presets & alignment rules in `typstGenerator.js`**

Modify `backend/src/services/typstGenerator.js` to handle `node.attrs?.tableStyle` (`modern`, `booktabs`, `zebra`, `borderless`, `custom`), table alignment (`left`, `center`, `right`), custom padding (`inset`), and border stroke customization.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test-table-generator-styles.js`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add backend/src/services/typstGenerator.js backend/test-table-generator-styles.js
git commit -m "feat(backend): add Booktabs, Zebra, Borderless presets and table alignment in typstGenerator"
```

---

### Task 2: TipTap Schema Extensions for Advanced Table Attributes

**Files:**
- Modify: `frontend/src/features/Editor/components/ChapterEditor/ChapterEditor.jsx`
- Modify: `frontend/src/features/Editor/components/ChapterEditor/nodes/TableView.jsx`

**Interfaces:**
- Consumes: User table attribute changes from toolbar/bubble menu.
- Produces: TipTap JSON document nodes with persistent attributes (`tableStyle`, `align`, `inset`, `borderColor`, `borderWidth`, `headerFill`, `repeatHeader`, `colspan`, `rowspan`, `fill`).

- [ ] **Step 1: Extend Table, TableCell, and TableHeader schema attributes in `ChapterEditor.jsx`**

Update `Table.configure({ resizable: true }).extend(...)` to include:
- `tableStyle`: default `"modern"`
- `align`: default `"center"`
- `inset`: default `"normal"`
- `borderColor`: default `null`
- `borderWidth`: default `null`
- `headerFill`: default `null`
- `repeatHeader`: default `true`

Update `TableCell` and `TableHeader` to support `fill` and `align`.

- [ ] **Step 2: Update `TableView.jsx` to render table style classes and captions**

Update `TableView.jsx` to apply CSS classes (`table-style-modern`, `table-style-booktabs`, `table-style-zebra`, `table-style-borderless`) and render setting controls.

- [ ] **Step 3: Verify editor build passes**

Run: `node --test src/features/Editor/scrollSync/anchors.test.js`
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/features/Editor/components/ChapterEditor/ChapterEditor.jsx frontend/src/features/Editor/components/ChapterEditor/nodes/TableView.jsx
git commit -m "feat(frontend): extend TipTap Table schema with style, alignment, and cell formatting attributes"
```

---

### Task 3: Floating Contextual Table Action Ribbon (`TableBubbleMenu.jsx`)

**Files:**
- Create: `frontend/src/features/Editor/components/SelectionBubbleMenu/TableBubbleMenu.jsx`
- Modify: `frontend/src/features/Editor/components/ChapterEditor/ChapterEditor.jsx`

**Interfaces:**
- Consumes: TipTap `editor` instance when selection is inside a table.
- Produces: Interactive floating toolbar UI for style preset selection, cell merging/splitting, alignment, cell fill, padding, border controls, and header/footer toggles matching AcaDoc design theme.

- [ ] **Step 1: Build `TableBubbleMenu.jsx` component**

Create `frontend/src/features/Editor/components/SelectionBubbleMenu/TableBubbleMenu.jsx` with:
- Preset selector dropdown (*Modern Grid*, *Booktabs*, *Zebra Striped*, *Borderless*).
- Table alignment buttons (Left, Center, Right).
- Merge / Split Cells buttons (`editor.chain().focus().mergeCells().run()`, `splitCell()`).
- Cell alignment controls (Left, Center, Right, Top, Middle, Bottom).
- Background Color Fill picker for cell/row background.
- Padding selector (Compact: 4pt, Normal: 8pt, Spacious: 12pt).
- Header Repeat checkbox toggle.

- [ ] **Step 2: Mount `TableBubbleMenu` in `ChapterEditor.jsx`**

Render `<TableBubbleMenu editor={editor} />` alongside `SelectionBubbleMenu` and `SlashCommandMenu`.

- [ ] **Step 3: Verify frontend tests & build**

Run: `node --test src/features/Editor/scrollSync/anchors.test.js`
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add frontend/src/features/Editor/components/SelectionBubbleMenu/TableBubbleMenu.jsx frontend/src/features/Editor/components/ChapterEditor/ChapterEditor.jsx
git commit -m "feat(frontend): add TableBubbleMenu for inline floating table customization"
```

---

### Task 4: Integration & Verification

**Files:**
- Modify: `frontend/src/features/Editor/components/ChapterEditor/ChapterEditor.jsx`
- Test: `backend/test-table-generator-styles.js`

- [ ] **Step 1: Run backend tests**

Run: `node --test test-table-generator-styles.js`
Expected: PASS

- [ ] **Step 2: Run frontend scroll sync tests**

Run: `node --test src/features/Editor/scrollSync/anchors.test.js`
Expected: PASS

- [ ] **Step 3: Clean up backend test file**

Run: `Remove-Item backend/test-table-generator-styles.js`

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: complete table customization integration and cleanup"
```
