# Design Specification: Comprehensive Typst Table Customization & Editor Controls

**Date:** 2026-08-09  
**Status:** Approved  
**Feature:** Advanced Table Styling, Positioning, and Editor Controls matching AcaDoc Design System

---

## 1. Executive Summary
This design specification details the end-to-end table customization feature for AcaDoc. It empowers users with full control over table positioning, page-breaking, column sizing, visual styles, cell merging, padding, borders, and captions in both the **TipTap Editor UI** and the **Typst PDF compilation engine**.

---

## 2. Table Positioning & Page Layout Controls

| Parameter | Description | Typst Rendering | Editor Control |
| :--- | :--- | :--- | :--- |
| **Table Page Alignment** | Left, Center, or Right alignment of the table on the page. | `#align(center)[#figure(...)]` / `#align(left)[...]` | Alignment buttons on Table Action Bar. |
| **Page-Break Behavior** | Allow table to split across pages (`breakable: true`) or keep together (`breakable: false`). | `#show figure.where(kind: table): set block(breakable: true)` | "Allow Page Break" Toggle. |
| **Header Repetition** | Repeat header row at top of new page when breaking. | `table.header(repeat: true, ...)` | "Repeat Header" Checkbox. |
| **Footer Repetition** | Repeat summary/total rows across page breaks. | `table.footer(repeat: true, ...)` | "Repeat Footer" Checkbox. |
| **Column Sizing Mode** | **Auto-Fit**: Short text `auto`, Long text `1fr`.<br>**Equal**: All `1fr`.<br>**Custom**: Dragged widths (`120fr`, `80fr`, `300fr`). | `columns: (auto, auto, 1fr)` or `(120fr, 80fr, 300fr)` | Column sizing mode toggle + drag handle. |

---

## 3. Table Visual Presets & Styling

Matching the AcaDoc sleek dark/light design system:

| Preset Name | Border & Fill Configuration | Typst Output |
| :--- | :--- | :--- |
| **Modern Grid** *(Default)* | Soft header background (`#f1f5f9`), subtle borders (`#cbd5e1`), padding `8pt`. | `stroke: 0.5pt + rgb("#cbd5e1")`, `fill: header-grey` |
| **Academic Booktabs** | Thick top rule (`1.5pt`), thin header rule (`0.8pt`), thick bottom rule (`1.5pt`), no vertical lines. | Custom `table.hline` rules, `stroke: none` |
| **Zebra Striped** | Alternating row fills (`#f8fafc` / `white`), subtle grid. | `fill: (x, y) => if calc.even(y) { rgb("#f8fafc") }` |
| **Borderless** | Clean borderless layout without outer/inner strokes. | `stroke: none` |
| **Custom Style** | Custom border color picker, border width (`0.5pt`, `1pt`, `1.5pt`), padding (`compact`, `normal`, `spacious`). | User-selected `stroke`, `fill`, `inset` |

---

## 4. Cell Formatting & Merging

- **Cell Merging**: Combine horizontal/vertical cells using `table.cell(colspan: N, rowspan: M)`.
- **Cell Alignment**: Independent horizontal (`left`, `center`, `right`) and vertical (`top`, `horizon`, `bottom`) alignment per cell or column.
- **Cell Fill Color**: Highlight individual cells or entire rows with a custom background fill.
- **Header & Footer Rows**: Mark top row(s) as `tableHeader` and bottom row(s) as `tableFooter`.

---

## 5. TipTap Editor UI Integration (Floating Table Bubble Bar)

When the cursor is placed inside any table, a **Floating Contextual Table Bar (`TableBubbleMenu`)** appears directly above the table with the following tools matching the AcaDoc theme:

1. 🎨 **Style Presets**: Dropdown (*Modern Grid*, *Booktabs*, *Zebra Striped*, *Borderless*, *Custom*).
2. 📐 **Table Alignment**: Left, Center, Right align buttons.
3. ↔️ **Column Mode**: Auto-Fit Content, Equal Widths, or Drag Resizing.
4. 🔲 **Borders & Padding**: Padding selector (Compact: 4pt, Normal: 8pt, Spacious: 12pt) & Border Color.
5. 🔀 **Merge & Split**: One-click Merge selected cells (`colspan`/`rowspan`) or Split cells.
6. 🎯 **Cell Alignment**: Left, Center, Right, Top, Middle, Bottom.
7. 🖌️ **Cell Background Fill**: Color palette for cell/row background.
8. 🔁 **Header & Footer Toggles**: Checkboxes for "Repeat Header on Page Break" and "Repeat Footer".
9. 🏷️ **Caption Input**: Text field for Table Caption / Name.

---

## 6. Architecture & Data Flow

```
[TipTap Editor UI (TableBubbleMenu / TableView)]
         │
         ▼ (Saves node attributes: tableStyle, align, inset, colwidth, colspan, rowspan, fill, breakable, repeatHeader)
[Project Store / JSON Document Tree]
         │
         ▼ (Sent to compilation service)
[typstGenerator.js]
         │
         ▼ (Translates attributes to native Typst primitives: table.header, table.cell, stroke, fill, inset, columns, #align, #figure)
[Compiled Typst PDF]
```

---

## 7. Verification Plan

### Automated Tests
- Run `node --test test-smart-tables.js` to verify Typst code generation for:
  - Smart column width calculation (`(auto, auto, 1fr)`).
  - Header repetition (`table.header(repeat: true, ...)`).
  - Cell merging (`table.cell(colspan: N, rowspan: M)`).
  - Presets (Booktabs, Zebra, Borderless).
- Run `node --test src/features/Editor/scrollSync/anchors.test.js` to ensure scroll synchronization remains intact.

### Manual Verification
- Test TipTap Table Action Bar in browser (`npm run dev`).
- Add/modify tables in Diploma Project Report, Thesis, and IEEE templates.
- Compile to PDF and confirm table layouts, page breaks, column auto-adjustments, and List of Tables entries match expectations.
