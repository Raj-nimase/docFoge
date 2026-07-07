# AcaDoc — Frontend Documentation

> A React + Vite web application for writing, structuring, and compiling academic documents into PDF via LaTeX.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Routing & App Entry](#routing--app-entry)
4. [Authentication](#authentication)
5. [Dashboard](#dashboard)
6. [New Project Flow](#new-project-flow)
7. [Editor — Deep Dive](#editor--deep-dive)
   - [Editor Layout](#editor-layout)
   - [TopBar](#topbar)
   - [Left Panel (Chapter Navigator)](#left-panel-chapter-navigator)
   - [Editor Panel & Chapter Editor](#editor-panel--chapter-editor)
   - [Toolbar](#toolbar)
   - [Selection Bubble Menu](#selection-bubble-menu)
   - [Preview Panel](#preview-panel)
8. [State Management](#state-management)
9. [Key Hooks](#key-hooks)
10. [Mobile Editor](#mobile-editor)
11. [Component Library](#component-library)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 (JSX) |
| Build Tool | Vite |
| Routing | React Router v6 |
| Rich-Text Editor | TipTap (ProseMirror-based) |
| Math Rendering | KaTeX |
| State Management | Zustand (via custom stores) |
| Drag & Drop | `@hello-pangea/dnd` |
| Icons | Lucide React |
| i18n | react-i18next |
| Styling | Vanilla CSS (index.css + app-overrides.css) |

---

## Project Structure

```
frontend/
└── src/
    ├── App.jsx                  ← Root component, routing
    ├── main.jsx                 ← Entry point
    ├── index.css                ← Global design system & tokens
    ├── app-overrides.css        ← TipTap / third-party overrides
    ├── components/              ← Shared UI components
    │   ├── Modal/
    │   ├── SketchDecor/         ← SVG decorative elements
    │   ├── Spinner/
    │   └── Toast/               ← Global notification toasts
    ├── contexts/                ← Zustand stores
    │   ├── authStore/           ← Auth state (user, status, trial)
    │   └── projectStore/        ← Projects, chapters, compile job
    ├── features/                ← Feature-based modules
    │   ├── Auth/                ← Login / signup page
    │   ├── Dashboard/           ← Home, Templates, Exports, Settings
    │   ├── Editor/              ← Rich-text academic editor
    │   │   ├── components/
    │   │   │   ├── ChapterEditor/       ← Core TipTap editor instance
    │   │   │   ├── EditorPanel/         ← Wraps ChapterEditor + breadcrumb
    │   │   │   ├── LeftPanel/           ← Chapter navigator sidebar
    │   │   │   ├── LivePreview/
    │   │   │   ├── MetadataForm/        ← Title, authors, institution form
    │   │   │   ├── PreviewPanel/        ← PDF compile progress & viewer
    │   │   │   ├── SelectionBubbleMenu/ ← Floating formatting bubble
    │   │   │   ├── Toolbar/             ← Main formatting toolbar
    │   │   │   └── TopBar/              ← App header, compile button
    │   │   ├── pages/
    │   │   │   ├── EditorPage.jsx       ← Desktop editor layout
    │   │   │   └── MobileEditorPage.jsx ← Mobile-optimised layout
    │   │   └── utils/                   ← Heading format action helpers
    │   ├── NewProject/          ← Project creation wizard
    │   └── Workspace/
    ├── hooks/
    │   ├── useEditorTour/       ← Guided onboarding tour
    │   └── useMathPaste/        ← Math paste / transform helpers
    ├── pages/
    │   └── Home.jsx
    ├── services/
    │   └── api.js               ← API layer (compile, poll, upload, auth)
    ├── styles/                  ← Additional style partials
    └── utils/                   ← Guest trial helpers, misc utils
```

---

## Routing & App Entry

**File:** `App.jsx`

`App.jsx` is the root component. On mount it:

1. **Bootstraps auth** — calls `authStore.bootstrap()` to restore session from local storage / cookies.
2. **Health-checks the backend** — hits `/health` with a 1.2 s timeout. If reachable, loads the user's cloud projects in the background.
3. **Redirects** — if auth is required (trial expired, not logged in) the user is sent to `/auth`.

### Routes

| Path | Component | Description |
|---|---|---|
| `/` | `DashboardLayout` → `DashboardHomePage` | Project list & stats |
| `/templates` | `TemplatesPage` | Browse document templates |
| `/exports` | `ExportsPage` | Past PDF exports |
| `/settings` | `SettingsPage` | Document & account settings |
| `/new-project` | `NewProject` | Project creation wizard |
| `/editor` | `Editor` (EditorPage) | Main document editor |
| `/auth` | `Auth` | Sign in / sign up |
| `/mobile-editor` | `MobileEditorPage` | Mobile-only editor path |
| `*` | Redirect → `/` | Catch-all |

---

## Authentication

**Store:** `authStore` (Zustand)  
**Page:** `features/Auth/pages/AuthPage.jsx`

- Supports **authenticated** users and **guest** users.
- Guests get a configurable free-trial window (`GUEST_TRIAL_DAYS`).
- `canAccessApp()` decides if the app is accessible — returns `false` when the trial expires for an unauthenticated user, forcing them to the auth page.
- After sign-in, local (guest) projects are automatically merged/uploaded to the user's cloud account.
- Toast messages inform the user of sync results (loaded N projects, merged local projects, offline mode, etc.).

---

## Dashboard

**Layout:** `DashboardLayout.jsx`

The dashboard is a classic **sidebar + content area** layout.

### Sidebar

- Collapsible (toggle button or hamburger menu in the top navbar).
- Navigation links: Dashboard, Templates, Exports, Settings.
- Bottom profile strip shows user name, role/institution (or guest trial info), and a sign-in/sign-out button.

### Top Navbar

- Breadcrumb showing current section.
- Notification bell panel (dropdown with recent activity items).
- **New Project** primary action button.

### Dashboard Home

| Section | Details |
|---|---|
| **Hero banner** | Personalised welcome with user's first name; "New Project" and "Browse Templates" CTAs; decorative SVG sketch accents |
| **Stats grid** | Cards for Total Papers, PDFs Generated, AI Formatting uses, LaTeX Health |
| **Search** | Live filter across project title, authors, and template name |
| **Projects grid** | Cards per project with: template icon, title, template name, author, last-modified date, "Open Workspace" button, delete (with confirmation modal), pin toggle |
| **Empty state** | Illustrated empty state with a "New Project" CTA |

---

## New Project Flow

**Feature:** `features/NewProject/pages/NewProjectPage.jsx`

A step-by-step wizard where users:
1. Choose a document **template** (e.g. IEEE, APA, blank).
2. Enter project **metadata** (title, authors, institution).
3. Confirm — a new project is created in the store and the user is navigated to `/editor`.

---

## Editor — Deep Dive

The editor is the core of AcaDoc. It opens when a user selects or creates a project.

**Entry:** `EditorPage.jsx`

```
┌──────────────────────────────────────────────────────┐
│                      TopBar                          │
├──────────────┬───────────────────────┬───────────────┤
│              │       Toolbar         │               │
│  Left Panel  │  ─────────────────── │  Preview      │
│  (Chapters)  │    Chapter Editor     │  Panel        │
│              │    (TipTap canvas)    │  (PDF Viewer) │
└──────────────┴───────────────────────┴───────────────┘
```

---

### Editor Layout

**File:** `EditorPage.jsx`

- Renders a `div.editor-layout` containing three panels.
- `leftCollapsed` state controls whether the Left Panel is in icon-rail mode or full mode.
- Automatically starts the **guided editor tour** on first visit (`useEditorTour({ autoStart: true })`).

---

### TopBar

**File:** `TopBar.jsx`

The fixed header of the editor. Contains:

| Element | Behaviour |
|---|---|
| **AcaDoc logo / brand** | Clicking navigates back to the dashboard |
| **Project name** | Shows the current project title from metadata |
| **Sign Out button** | Only visible when authenticated |
| **Tour button** | Triggers the guided onboarding tour |
| **Download PDF button** | Appears only after a successful compile; downloads the blob URL |
| **Compile button** | The primary action — triggers LaTeX compilation |

#### Compile Flow

1. User clicks **Compile**.
2. `compileProject(currentProject)` is called → backend returns a `jobId`.
3. `pollUntilDone(jobId, callback, { intervalMs: 1500, maxAttempts: 30 })` polls the backend every 1.5 s.
4. On completion, `fetchCompiledPdf(jobId)` fetches the binary PDF and creates a local `blob:` URL.
5. The blob URL is stored in `compileJob.blobUrl` in the global store.
6. A success toast is shown and the Download PDF button appears.
7. Background project sync is paused during compilation (`setCompileActive`) to avoid race conditions.

---

### Left Panel (Chapter Navigator)

**File:** `LeftPanel.jsx`

A collapsible sidebar showing the document structure.

#### Expanded Mode

- **Header row**: project title and a collapse toggle button.
- **Template badge**: shows the template ID (e.g. `ieee conference`).
- **Front Matter section**: Auto-generated sections (Title Page, Table of Contents) shown with a `⚙` icon and an `auto` badge. These sections are not editable.
- **Chapters section**: User-defined chapters with:
  - **Drag-and-drop reordering** via `@hello-pangea/dnd`.
  - **Click** to switch to that chapter.
  - **Double-click** to rename inline (edit → confirm with Enter or blur, cancel with Escape).
  - **Delete button** (✕) on non-required chapters.
  - **Add Chapter** form at the bottom (Enter to confirm, Escape to cancel).

#### Collapsed (Icon Rail) Mode

- Shows only icon buttons — `⚙` for auto sections, chapter number for chapters.
- Clicking expands the panel back.

---

### Editor Panel & Chapter Editor

**EditorPanel** — `EditorPanel.jsx`

The container that decides what to render in the main editing area:

| Case | What renders |
|---|---|
| Active section is `auto` (e.g. Title Page, ToC) | Read-only notice: "This section is auto-generated" |
| Active section exists and is editable | `ChapterEditor` |
| No active section | Empty state: "Select a chapter from the left panel" |

Also renders:
- **Breadcrumb** at the top: `Project Title › Chapter Name`.
- **MetadataForm** (inline settings for title, authors, etc.).

---

**ChapterEditor** — `ChapterEditor.jsx`

The richest component. Powered by **TipTap** (ProseMirror wrapper for React).

#### TipTap Extensions Used

| Extension | Purpose |
|---|---|
| `StarterKit` | Paragraphs, bold, italic, strike, code, blockquote, lists, history (undo/redo), headings H1–H3 |
| `Underline` | Underline mark |
| `Placeholder` | Shows "Start writing this section…" in empty editor |
| `Table` + Row/Header/Cell | Resizable tables with an optional caption input |
| `Image` | Images with Cloudinary URL storage and editable caption/figure name |
| `MathExtension` (custom) | Inline & display math nodes rendered via KaTeX |
| `MathPasteHandler` (custom) | Intercepts clipboard paste to detect and convert LaTeX formulas |
| `HeadingCleaner` (custom) | ProseMirror plugin that strips numeric prefixes (e.g. "1.2 Introduction" → "Introduction") from headings automatically |
| `HeadingNumbering` (custom) | Adds CSS `data-number` decorations to headings (e.g. `2.1`, `2.1.3`) based on chapter position — purely visual, not stored |
| `TrailingNode` (custom) | Always keeps a blank paragraph at the end of the document so the cursor can always be placed after the last block |

#### Math Support

- **Inline math**: type `$formula$` → automatically converts to a rendered KaTeX node.
- **Display math**: same but set to display mode (centered block).
- **Paste detection**: pasting `$...$`, `\[...\]`, or `\(...\)` is intercepted and converted to math nodes.
- **Symbol auto-conversion**: Unicode characters like `²`, `θ`, `π`, `α` etc. are normalised to their LaTeX equivalents for rendering.

#### Image Handling

Images are **not stored as base64**. They are uploaded to **Cloudinary** via the API:
- **Toolbar button** → opens a file picker → uploads → inserts `<img src="cloudinary-url">`.
- **Drag & drop** onto the editor → same upload flow.
- **Paste from clipboard** → if clipboard contains an image file, it is uploaded and inserted.
- Each image has an editable **figure name / caption** rendered as an input below the image.

#### Tables

- **Insert Table** → creates a 3×3 table with a header row.
- **Text → Table** → converts selected delimited text (tab, pipe, or comma) to a proper table.
- Table editing buttons (add/remove row/column, delete table, set caption) appear in the Toolbar when the cursor is inside a table.
- Each table has an optional **caption** input at the bottom.

#### Save / Sync Behaviour

- Content changes are **debounced 400 ms** before calling `onContentChange(editor.getJSON())`.
- On **blur** (editor loses focus), any pending debounced save is flushed immediately to prevent data loss.
- On **unmount** (user switches chapters before 400 ms), the pending save is also flushed.
- When the active section changes, the editor content is **replaced** (`setContent`) only if the JSON representation actually differs from what's already loaded — preventing unnecessary re-renders and cursor position resets.

---

### Toolbar

**File:** `Toolbar.jsx`

A horizontal toolbar rendered above the editor canvas. It is **context-aware** — extra groups appear when the cursor is inside certain node types.

#### Always-visible Groups

| Group | Buttons |
|---|---|
| **Text** | Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U), Strikethrough |
| **Sections** | H1 (Section), H2 (Subsection), H3 (Subsubsection); "Normal" button appears when a heading is active to revert to paragraph |
| **Lists** | Bullet list, Numbered list |
| **Blocks** | Code block, Blockquote |
| **Insert** | Insert Table (3×3), Text→Table converter, Insert Image (file picker → Cloudinary upload) |
| **Clear** | Clear all formatting (unset all marks + clear nodes) |

#### Context-sensitive Groups

| Active node | Extra group shown |
|---|---|
| `table` | **Table edit**: Add Row, Delete Row, Add Column, Delete Column, Delete Table, Set Caption |
| `math` | **Equation**: Toggle Inline/Display mode, Delete equation |
| `image` | **Figure**: Set Caption, Delete image |

---

### Selection Bubble Menu

**File:** `SelectionBubbleMenu.jsx`

A **floating toolbar** that appears above any text selection. Provides quick-access formatting without reaching for the main toolbar — typically bold, italic, underline and heading toggles for the selected text.

---

### Preview Panel

**File:** `PreviewPanel.jsx`

The right-hand panel that shows the PDF output.

#### States

| State | What the user sees |
|---|---|
| **Idle** (no compile yet) | "📄 Click Compile to generate your PDF" |
| **Compiling** | Spinner + animated progress bar (fake-progress 5%→90% based on elapsed seconds) + stage labels that update as polls complete |
| **Done** | Embedded PDF viewer (via `PdfViewer.jsx`) + Download PDF button |
| **Failed** | Error panel with the LaTeX error log from the backend |

#### Stage Labels (during compile)

The panel shows progressively descriptive status messages based on poll count:

1. Sending document to compiler…
2. Generating LaTeX source…
3. Running pdflatex (pass 1)…
4. Running pdflatex (pass 2)…
5. Finalising PDF…

#### Stale PDF

When the user re-compiles while a PDF is already shown, the **previous PDF stays visible** (slightly faded) while the new compile runs. This avoids a jarring blank state.

---

## State Management

Two Zustand stores are used throughout the application:

### `authStore`

Manages:
- `status`: `'loading'` | `'guest'` | `'authenticated'`
- `user`: user object (name, email, role, institution)
- `bootstrap()`: restores session on app load
- `logout()`: clears auth state
- `canAccessApp()`: checks trial/auth validity
- `getInitials()`, `getTrialLabel()`: UI helpers

### `projectStore`

Manages all document data:
- `projects[]`: list of all user projects
- `activeChapterId`: which chapter/section is open in the editor
- `compileJob`: `{ status, jobId, blobUrl, error }` — tracks compile state
- Key actions:
  - `loadProjectsForUser()` — loads from cloud (or local cache offline)
  - `openProject(id)` — sets the active project
  - `addChapter()`, `deleteChapter()`, `renameChapter()`, `reorderChapters()`
  - `updateSectionContent(sectionId, json)` — saves editor content
  - `setCompileJob(job)` — updates compile progress
  - `showToast(type, message)` — triggers global toast notifications

---

## Key Hooks

### `useEditorTour`

**File:** `hooks/useEditorTour/useEditorTour.js`

Drives a step-by-step **onboarding tour** of the editor using tour target IDs (`#tour-left-panel`, `#tour-editor-toolbar`, `#tour-editor-content`, `#tour-preview-panel`, `#tour-compile-btn`).

- `autoStart: true` → automatically starts the tour for first-time users.
- `runTour(true)` → can be triggered manually from the TopBar "Tour" button.

### `useMathPaste`

**File:** `hooks/useMathPaste/useMathPaste.js`

Provides:
- `extractLatex(text)` — extracts LaTeX formulas from plain text.
- `isSingleFormula(text)` — detects if the clipboard contains exactly one formula.
- `handleRichPaste(view, event, editor)` — the ProseMirror paste handler that intercepts rich content pasting.
- `transformMathHtml(html)` — transforms HTML containing MathML or `\[...\]` into TipTap-compatible `data-latex` spans before the editor parses it.

---

## Mobile Editor

**File:** `MobileEditorPage.jsx`

An alternate editor layout served at `/mobile-editor`. It is detected before any routing in `App.jsx`:

```jsx
if (window.location.pathname === '/mobile-editor') {
  return <MobileEditorPage />;
}
```

This provides a simplified, touch-friendly editing experience optimised for phones/tablets, with a different panel arrangement compared to the three-column desktop layout.

---

## Component Library

Shared components in `src/components/`:

| Component | Description |
|---|---|
| `Toast` | Global toast notification system. Messages are queued via `showToast(type, message)` in the project store. Types: `success`, `error`, `warning`, `info`. |
| `Modal` | Reusable modal panel wrapper |
| `Spinner` | Loading spinner used across various loading states |
| `SketchDecor` | SVG decorative illustration components (`SketchHeroAccent`, `SketchUnderline`, `SketchDocument`) used in the dashboard hero and empty states |

---

## Data Flow Summary

```
User types in ChapterEditor
        │
        ▼ (400ms debounce)
updateSectionContent(sectionId, json)  ← projectStore action
        │
        ▼
projectStore.projects[...].chapters[...].sections[...].content = json
        │
        ▼ (background sync)
api.saveProject() → backend persisted
        │
        ▼ (on Compile click)
compileProject(project) → jobId
        │
        ▼ (polling)
pollUntilDone(jobId) → final status
        │
        ▼ (on done)
fetchCompiledPdf(jobId) → blob:URL
        │
        ▼
compileJob.blobUrl → PreviewPanel renders PDF
```
