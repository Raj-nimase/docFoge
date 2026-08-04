## docfoge-architecture

# docFoge Architecture Overview

docFoge (AcaDoc) is a publication-grade academic document creation, editing, and compilation workspace.

## Core Architecture Layers
1. **Frontend (React 19 + Vite 6)**:
   - Visual WYSIWYG block editor powered by Tiptap.
   - Live KaTeX math rendering, Fabric.js / Konva canvas for graphic annotations.
   - Zustand 5 stores for state management (`projectStore`, `authStore`).
   - Tailwind CSS 4 styling.

2. **Backend (Node.js 20+ / Express 5)**:
   - Express REST API with JWT authentication (`jsonwebtoken`, `bcryptjs`).
   - MongoDB database with Mongoose ORM (`User`, `Project` models).
   - Async PDF compilation queue using in-memory `Map` job tracking.

3. **Compilation Engine (Tectonic TeX CLI)**:
   - Native server-side compilation into publication-quality PDFs via Tectonic binary.
   - SHA-256 disk-persisted content-hash PDF caching in `TMP_DIR/_cache`.
   - Vector certificate pre-rendering powered by `pdf-lib`.

4. **AI & Cloud Services**:
   - Google Gemini 1.5/2.0 Flash Vision AI for image-to-LaTeX and document extraction.
   - Cloudinary CDN for drag-and-drop image asset hosting.

**Type:** architecture  
**Tags:** architecture, overview, tectonic, express, react, tiptap  
**Updated:** 8/3/2026
