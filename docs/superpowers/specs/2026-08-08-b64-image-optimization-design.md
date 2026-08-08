# Base64 Image Storage Optimization Design

## Overview
This design details the refactoring of image storage in **docForge**, specifically within the Certificate Canvas Editor and document persistence pipelines. By replacing Base64 Data URL persistence with direct Cloudinary HTTPS URL uploads, we eliminate database bloat in MongoDB, prevent LocalStorage quota crashes, and accelerate sync and compilation speed.

## Problem Statement
Currently, images uploaded to the **Certificate Canvas Editor** are converted into Base64 Data URLs (`data:image/png;base64,...`) by `prepareImageFile()`. These Base64 strings are stored directly inside scene objects (`content.objects`). Because `stripBase64FromDoc()` only sanitizes TipTap rich text nodes, canvas Base64 images are persisted directly to MongoDB (`Project.frontMatter` and `Project.chapters`) and `localStorage`, causing multi-megabyte payload bloat and severe UI/network latency.

## Proposed Changes

### 1. Canvas Editor Image Upload (`frontend/src/features/Editor/components/ChapterEditor/CertificateCanvasEditor.jsx`)
- In `handleImageFile()`, when a user picks an image file:
  1. Measure natural aspect ratio and dimensions via `prepareImageFile()`.
  2. Upload the raw image file to Cloudinary via `api.uploadImage(file)` (calls `/api/images/upload`).
  3. Set `object.src` to the secure Cloudinary HTTPS URL (`https://res.cloudinary.com/...`).
  4. Provide toast notifications for upload status and error handling.

### 2. Base64 Sanitization in Sync Engine (`frontend/src/contexts/projectStore/projectStore.js`)
- Update `stripBase64FromDoc(doc)`:
  - Add logic to inspect `doc.objects` if `doc.isCertificateCanvas` or `Array.isArray(doc.objects)`.
  - For any canvas object where `obj.src` starts with `data:`, replace `obj.src` with an empty string `""` before sending payloads to MongoDB or saving to `localStorage`.

### 3. PDF Vector & Compile Verification
- Ensure `pdfVectorRenderer.js` and `certificatePdfService.js` handle HTTPS URLs smoothly via `fetch(src)`.

## Data Flow
```
User selects image file
       │
       ▼
prepareImageFile(file) ──► measure (width, height)
       │
       ▼
api.uploadImage(file)  ──► POST /api/images/upload (Cloudinary)
       │
       ▼
Receive HTTPS URL (https://res.cloudinary.com/...)
       │
       ▼
addObject("image", { src: httpsUrl, overrides: { width, height } })
       │
       ▼
Persist lightweight JSON scene (URL only) to projectStore & MongoDB
```
