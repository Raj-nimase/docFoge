## docfoge-authentication-flow

# docFoge Authentication & Session Architecture

## Token & Session Management
- **JWT Signing**: Signed via `jsonwebtoken` with sub=`user._id` and 7-day expiration (`JWT_EXPIRES_IN=7d`).
- **Middleware Security**: `requireAuth` middleware parses `Authorization: Bearer <token>` headers, verifies token cryptographically against `JWT_SECRET`, loads user from DB via `User.findById(payload.sub)`, and attaches `req.user`.

## Guest Mode & Project Migration
- Unauthenticated users can create and edit documents offline in local storage.
- Upon registering or logging in, the client calls `POST /api/projects/sync` with all local projects.
- Backend uses MongoDB `bulkWrite` with `upsert: true` and filter `{ userId: req.user._id, clientId: p.id }` to seamlessly merge local guest documents into the registered user account without data loss.

## Password Reset Security Flow (3-Step OTP)
1. **Request OTP (`forgotPassword`)**: Generates 6-digit numeric OTP, stores SHA-256 hash on user record (10-minute expiry), and emails OTP via Nodemailer. Always responds with success to prevent user enumeration attacks.
2. **Verify OTP (`verifyOtp`)**: Compares SHA-256 hash of submitted OTP with DB record. If valid, clears OTP fields and issues a single-use 32-byte hex `resetToken` (stored as SHA-256 hash with 15-minute expiry).
3. **Reset Password (`resetPassword`)**: Validates `resetToken` and updates user password securely.

**Type:** decision  
**Tags:** auth, jwt, security, otp, sync, guest-migration  
**Updated:** 8/3/2026


## docfoge-important-implementation-details

# docFoge Important Implementation Details

## Tectonic LaTeX Execution & Pass Selection
- Tectonic binary is spawned via `child_process.spawn` with flags: `-Z continue-on-errors --outdir <outDir> --reruns <pass_count>`.
- Pass count heuristic (`needsMultiPass`):
  - Simple documents: `--reruns 0` (1 pass, ~40% faster).
  - Documents containing `\tableofcontents`, `\listoffigures`, `\ref{`, `\cite{`, or `\label{`: `--reruns 2` (3 passes) to sync page numbers.

## Vector Certificate Rendering (`pdf-lib`)
- Special frontMatter pages (certificates, custom canvas items) are pre-rendered into pure vector PDF files (`cert_vector_*.pdf`) using `pdf-lib` prior to LaTeX code generation.
- The generated LaTeX document includes these vector PDFs seamlessly via `\includepdf`.

## Vision AI Prompt & Formatting Constraints
- Gemini Vision AI prompt strictly specifies dual output classification (`type: "math"` vs `type: "html"`).
- Instructs Gemini to wrap LaTeX inline/block formulas as `<span data-latex="..."></span>` instead of standard dollar signs, preserving Tiptap DOM compatibility.

## Body Parser Limits
- Express body parser set to `express.json({ limit: '5mb' })`. Images are uploaded to Cloudinary CDN rather than embedded as heavy base64 strings inside project JSON documents.

**Type:** decision  
**Tags:** implementation, tectonic, pdf-lib, gemini, performance  
**Updated:** 8/3/2026


## docfoge-dashboard-uiux-enhancements

# docFoge Dashboard UI/UX Enhancements

Applied UI/UX enhancements to the Dashboard while strictly preserving existing theme CSS variables:
- **Hero Banner**: Added live status pill indicator, greeting subtitle, and hover scale micro-interactions.
- **Stats Grid**: Glassmorphism cards with theme borders (`var(--border)`) and hover lifts.
- **Template Showcase**: Interactive card gallery with template preview icons and 1-click launch triggers.
- **Project Cards**: Added monospace chapter count badges (`Ch.`), pin status toggle button rotation, relative date timestamps, and smooth action buttons.
- **Search Bar**: Live fuzzy title/author search with clear (`X`) button and zero-state search missing fallback screen.
- **Theme Preservation**: All enhancements utilize existing CSS custom variables (`var(--card)`, `var(--border)`, `var(--accent)`, `var(--shadow-card)`).

**Type:** decision  
**Tags:** ui, ux, dashboard, theme-preservation, frontend-design, design-spells  
**Updated:** 8/3/2026
