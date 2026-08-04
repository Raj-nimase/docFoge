## docfoge-folder-structure

# docFoge Folder Structure & Organization

## Backend (`backend/src/`)
- `server.js`: Main Express application entrypoint, CORS policy, 5MB body limit, health checks, Render keep-alive, Tectonic pre-warming.
- `config/`: `db.js` (MongoDB connection), `gemini.js` (Google Generative AI client configuration).
- `controllers/`: Route logic handlers:
  - `authController.js`: User authentication, registration, password change, 3-step OTP reset flow.
  - `projectController.js`: Local-to-cloud project management, bulk guest project synchronization.
  - `compileController.js`, `exportController.js`, `formatController.js`, `parseController.js`.
- `middleware/`: `auth.js` (`requireAuth` JWT middleware), `requestSizeGuard.js`.
- `models/`: Mongoose schemas (`User.js`, `Project.js`).
- `routes/`: Route declarations (`authRoutes.js`, `compileRoutes.js`, `documentRoutes.js`, `imageRoutes.js`, `projectRoutes.js`, `templateRoutes.js`, `visionRoutes.js`).
- `services/`: Core business logic:
  - `tectonicRunner.js`: Tectonic compilation wrapper, SHA-256 PDF caching.
  - `latexGenerator.js`: Tiptap AST to LaTeX code generator.
  - `certificatePdfService.js`: `pdf-lib` vector PDF renderer.
  - `exportQueue.js`, `parserService.js`.

## Frontend (`frontend/src/`)
- `components/`: UI primitives (Toast, Modal, Spinner).
- `contexts/`: Zustand stores (`projectStore`, `authStore`).
- `features/`: Key domain features (`Auth`, `Dashboard`, `Editor`, `NewProject`).
- `pages/`: Application routes (`Home`, `PdfTesterPage`).
- `services/`: API client utilities and HTTP wrappers.

**Type:** pattern  
**Tags:** structure, directory, backend, frontend, components  
**Updated:** 8/3/2026


## docfoge-database-schema

# docFoge MongoDB Database Schemas

## User Model (`backend/src/models/User.js`)
- `name`: String (required, trimmed)
- `email`: String (required, trimmed, lowercase, unique index)
- `password`: String (required, minlength 8, hashed via bcrypt, `select: false` by default)
- `role`: String (enum: `['Student', 'Researcher', 'Faculty', 'Engineer', 'Other']`, default: `'Student'`)
- `institution`: String (trimmed, default: `''`)
- `department`: String (trimmed, default: `''`)
- `resetOtp`: String (SHA-256 hash of 6-digit OTP, `select: false`)
- `resetOtpExpires`: Date (`select: false`)
- `resetToken`: String (SHA-256 hash of 32-byte hex reset token, `select: false`)
- `resetTokenExpires`: Date (`select: false`)

### Methods
- `comparePassword(candidatePassword)`: Asynchronously compares candidate string with hashed password using bcrypt.
- `toPublicJSON()`: Sanitizes document to return public fields (`id`, `name`, `email`, `role`, `institution`, `department`).

---

## Project Model (`backend/src/models/Project.js`)
- `userId`: ObjectId (ref: `User`, indexed)
- `clientId`: String (client-generated UUID, indexed)
- `templateId`: String (required)
- `metadata`: Object (title, author, institution, abstract, date, etc.)
- `frontMatter`: Array of Objects (certificates, acknowledgements, uploaded PDFs)
- `chapters`: Array of Objects (title, content, sections)
- `createdAt`: Date (default: `Date.now`)
- `updatedAt`: Date (default: `Date.now`)

### Indexes & Schema Features
- Compound Index: `{ userId: 1, clientId: 1 }` (unique per user).
- `toClientJSON()`: Transforms document for client consumption, mapping `clientId` to `id`.

**Type:** pattern  
**Tags:** database, schema, mongoose, mongodb, user, project  
**Updated:** 8/3/2026


## docfoge-coding-conventions

# docFoge Coding Conventions & Standards

## Code Style & Formatting
- **Module Systems**: CommonJS (`require` / `module.exports`) in backend Node.js services; ES Modules (`import` / `export`) in frontend React code.
- **Error Propagation**: Express route handlers use async `try...catch` blocks passing errors to `next(err)`.
- **Response Format**: Standard JSON response shape across all endpoints:
  - Success: `{ success: true, ...data }`
  - Error: `{ success: false, error: 'Human readable message' }`
- **Data Normalization**: User emails are normalized via `.trim().toLowerCase()`. Text inputs are trimmed.
- **Sanitization**: LaTeX text generator cleans control characters (`\uFFFD`), surrogate pairs (`\uD800-\uDFFF`), zero-width spaces (`\u200B-\u200D`), and smart quotes before compiling.
- **Resilience Safeguards**: Remote image download failures during LaTeX compilation fall back to a 1x1 transparent PNG buffer (`FALLBACK_PNG_BUFFER`) to prevent Tectonic binary division-by-zero crashes.

**Type:** pattern  
**Tags:** conventions, coding-standards, error-handling, sanitization  
**Updated:** 8/3/2026


## docfoge-design-patterns

# docFoge Software & Architectural Design Patterns

## 1. Async Job Queue Pattern
- PDF compilation (`/api/compile`) and document exports execute asynchronously.
- The route Handler generates a UUID `jobId`, stores initial job state in an in-memory `Map`, and returns `202 Accepted` immediately.
- Execution continues via `setImmediate`. Clients poll `/api/compile/:jobId/status` and stream the PDF via `/api/compile/:jobId/pdf`.
- An automatic timer evicts job entries and temporary files older than 30 minutes.

## 2. SHA-256 Content-Hash PDF Caching Pattern
- `tectonicRunner.js` calculates `sha256(latexSource + certVectorHashes)`.
- If a PDF matching the hash exists in `TMP_DIR/_cache`, it returns the cached PDF in <50ms without spawning a child process.
- The index is mirrored in memory and persisted on disk (`index.json`).

## 3. Client-ID Upsert Pattern
- Projects use client-generated UUIDs (`clientId`) as stable keys.
- Backend `syncProjects` uses MongoDB `bulkWrite` with `upsert: true` and filter `{ userId, clientId }`, avoiding duplicate records during offline-to-online sync.

## 4. Cold-Start Pre-warming & Keep-alive Pattern
- `tectonicRunner.js` exports `warmUp()` which compiles a minimal LaTeX preamble document at server startup to prime the Tectonic format cache.
- Render free-tier dynos run a 14-minute self-ping interval (`startKeepAlive()`) to prevent Render spin-down.

**Type:** pattern  
**Tags:** patterns, design-patterns, caching, job-queue, prewarming  
**Updated:** 8/3/2026
