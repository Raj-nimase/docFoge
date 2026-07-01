## Project: DocForge (AcaDoc)
Goal: An interactive academic document editor and compiler that allows students and researchers to draft structured documents and compile them into high-quality PDFs via LaTeX.
Stack: React 19, Vite, TailwindCSS 4, Zustand 5, Express, MongoDB, Tectonic (LaTeX Compiler), Gemini API (Vision/Math parsing)

## Architecture decisions (locked in — don't relitigate these)
- **Tectonic LaTeX Engine**: Rather than requiring a heavy 5GB+ local LaTeX installation, the backend uses Tectonic (`tectonic.exe` on Windows, resolved dynamically on Unix). Tectonic compiles documents on the fly and downloads missing LaTeX packages from the internet as needed.
- **Local-First State with Server Sync**: Zustand manages client-side project state. Local storage caches projects immediately. When authenticated, Zustand merges local and cloud lists (via `updatedAt` timestamps) and syncs via a backend MongoDB `bulkWrite` operation. Guest usage is fully supported without an account.
- **Section-Based Document Hierarchy**: Documents are structured into separate frontMatter and chapter arrays rather than a single document blob. This allows the React frontend to support drag-and-drop reordering (`@hello-pangea/dnd`) and allows the backend to generate modular, template-driven LaTeX sections.
- **HTML Paste and Formula Conversion**: Custom clipboard parsing intercepts content pasted from word processors or webpages, converting MathML and HTML tables into native LaTeX elements for compile-time safety.
- **Feature-Based Folder Structure (Frontend)**: Re-structured the frontend under `/src/features/` (Auth, Dashboard, Editor, NewProject, Workspace) to keep pages, components, and logic modular and decoupled.

## Current status
- Working:
  - User authentication (JWT) with register, login, and secure route access.
  - Project templates selection: B.Tech/B.E. Thesis, IEEE Research Paper, Diploma Project Report, Assignment, and Blank Slate.
  - Chapter-based Tiptap WYSIWYG editor with live math formula rendering (KaTeX) and image uploading.
  - Drag-and-drop chapter reordering on the left sidebar.
  - Asynchronous LaTeX compilation backend queue using UUID-based Job IDs.
  - Tectonic LaTeX compilation to PDF and stream-back.
  - Vision endpoint (`/api/vision/math`) calling Gemini API to transcribe images containing mathematical formulas into LaTeX/HTML.
- In progress:
  - Diagnostic logging and timers in the sync endpoint (`backend/src/controllers/projectController.js`) to analyze slow sync issues under bulk writes.
- Known issues:
  - Vite build outputs a warning: `[INEFFECTIVE_DYNAMIC_IMPORT]` due to `src/services/api/index.js` being statically imported in App/stores but dynamically imported in ChapterEditor.
  - Temp files on the server (under `os.tmpdir()/docforge`) are cleared after 30 seconds on download or by a 30-minute interval cleaner, but unhandled crashes can leave stale files.

## Next steps
1. Address the Vite build warning regarding dynamic/static imports of `src/services/api/index.js`.
2. Refine the clipboard paste event handler to support complex multi-line math formulas.
3. Add a fallback/warning UI in the PDF compiler panel when LaTeX compilation fails, displaying compilation logs.

## Session log
- 2026-06-30 — Initialized PROJECT_STATE.md. Documented current system state, architecture decisions, and current features after verifying frontend build success.
