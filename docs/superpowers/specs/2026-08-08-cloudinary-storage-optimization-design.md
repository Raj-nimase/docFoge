# Cloudinary Storage Optimization & Automated Cleanup Design

## Overview
This design details the complete storage optimization and automated lifecycle cleanup for images in **docForge**. By combining client-side WebP compression, project-scoped Cloudinary folder namespacing, bulk project deletion, and single-image asset destruction, we ensure the application stays strictly within Cloudinary's free tier (25 GB storage limit) without recurring costs.

## Problem Statement
Previously:
1. User-uploaded images were sent raw (up to 10 MB per file) without compression.
2. Cloudinary assets were stored in a flat folder `docforge/{userId}` with no project association.
3. When projects or canvas image objects were deleted or replaced, their corresponding Cloudinary assets remained permanently stored as orphaned files.

## Architecture & Data Flow

```
[User Selects Image]
       │
       ▼
imageCompressor.js (Resize <=1600px, WebP quality 0.82)
       │  (Reduces size by 80-90%, e.g., 5MB -> ~180KB)
       ▼
uploadImage(file, projectId) ──► POST /api/images/upload?projectId=XYZ
                                          │
                                          ▼
                         storageService.js: upload_stream
                         Folder: docforge/{userId}/{projectId}
                         Tag: [userId, projectId]
                                          │
                                          ▼
                         Returns HTTPS URL + publicId

[Project Deletion Workflow]
User deletes project ──► syncProjects / deleteProject in projectController.js
                               │
                               ▼
            deleteProjectImages(userId, projectId)
            cloudinary.api.delete_resources_by_prefix("docforge/{userId}/{projectId}")
            cloudinary.api.delete_folder("docforge/{userId}/{projectId}")

[Single Image Replacement / Deletion]
User deletes/replaces image in Canvas Editor ──► DELETE /api/images/delete ({ url })
                                                         │
                                                         ▼
                                          cloudinary.uploader.destroy(publicId)
```

## Detailed Specifications

### 1. Client-Side Image Compressor (`frontend/src/utils/imageCompressor.js`)
- `compressImageForUpload(file, maxDimension = 1600, quality = 0.82)`
- Converts JPEG, PNG, WEBP, BMP images to lightweight `image/webp` blobs using an offscreen HTML5 canvas.
- Preserves transparency if PNG/WEBP contains alpha channels when appropriate, or flattens onto white background for JPEG.

### 2. Frontend API Updates (`frontend/src/services/api/index.js`)
- Update `uploadImage(file, projectId)`:
  - Compress `file` using `compressImageForUpload`.
  - Append `projectId` to `FormData` payload.
- Add `deleteImage(urlOrPublicId)`:
  - Calls `DELETE /api/images/delete` with `{ url }`.

### 3. Backend Storage Service (`backend/src/services/storageService.js`)
- Update `uploadImageBuffer(userId, projectId, buffer, mimeType)`:
  - Saves to folder `docforge/${userId}/${projectId || 'general'}`.
- Add `deleteProjectImages(userId, projectId)`:
  - Calls `cloudinary.api.delete_resources_by_prefix(`docforge/${userId}/${projectId}`)`.
  - Calls `cloudinary.api.delete_folder(`docforge/${userId}/${projectId}`)`.
- Add `deleteImageByUrl(url)`:
  - Extracts Cloudinary `public_id` from URL structure.
  - Calls `cloudinary.uploader.destroy(publicId)`.

### 4. Backend Image Routes (`backend/src/routes/imageRoutes.js`)
- Update `POST /api/images/upload` to parse `req.body.projectId` or `req.query.projectId`.
- Add `DELETE /api/images/delete` requiring authentication:
  - Accepts `{ url, publicId }` in request body.
  - Deletes target image asset via `deleteImageByUrl`.

### 5. Backend Controller Integration (`backend/src/controllers/projectController.js`)
- In `syncProjects` / `deleteProject`, when `deleteIds` contains project IDs:
  - Trigger `deleteProjectImages(userId, projectId)` asynchronously for each deleted project ID.

### 6. Canvas Editor Replacement Cleanup (`frontend/src/features/Editor/components/ChapterEditor/CertificateCanvasEditor.jsx`)
- When replacing an existing image object (`targetId`), if `oldObj.src` is a Cloudinary URL (`res.cloudinary.com`), call `api.deleteImage(oldObj.src)` in background to destroy the old Cloudinary asset.
