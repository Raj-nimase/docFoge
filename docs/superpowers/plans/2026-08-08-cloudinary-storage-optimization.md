# Cloudinary Storage Optimization & Automated Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement client-side image compression, project-scoped Cloudinary folder namespacing, bulk project image deletion, and single-asset replacement cleanup to minimize Cloudinary storage usage and stay within free tier limits.

**Architecture:** Client resizes/compresses images to WebP before upload. Cloudinary uploads are stored in `docforge/{userId}/{projectId}/`. Backend automatically purges Cloudinary folders when projects are deleted and destroys old assets when images are replaced in the canvas editor.

**Tech Stack:** JavaScript (ES6+), Canvas API, Node.js / Express, Cloudinary SDK v2, React.

## Global Constraints
- Compress images before uploading to reduce file sizes by 80–90%.
- Store Cloudinary images under `docforge/{userId}/{projectId}/`.
- Clean up Cloudinary assets when projects or individual images are deleted/replaced.

---

### Task 1: Client-Side Image Compressor & API Helper Updates

**Files:**
- Create: `frontend/src/utils/imageCompressor.js`
- Modify: `frontend/src/services/api/index.js:330-345`

**Interfaces:**
- Consumes: `File` object
- Produces: `compressImageForUpload(file)` -> `Promise<File|Blob>`, `uploadImage(file, projectId)` -> `Promise<string>`, `deleteImage(url)` -> `Promise<boolean>`

- [ ] **Step 1: Create `frontend/src/utils/imageCompressor.js`**
  ```javascript
  /**
   * Compress an image file using browser Canvas API before uploading.
   * Scales image max dimension to maxDimension (default 1600px) and converts to WebP.
   */
  export async function compressImageForUpload(file, maxDimension = 1600, quality = 0.82) {
    if (!file || !file.type.startsWith('image/')) return file;
    // SVGs or tiny files don't need raster compression
    if (file.type === 'image/svg+xml' || file.size < 100_000) return file;

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if (!width || !height) return resolve(file);

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);

        // Fill background white for non-transparent formats
        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) return resolve(file);
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.webp', {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = objectUrl;
    });
  }
  ```

- [ ] **Step 2: Update `uploadImage` and add `deleteImage` in `frontend/src/services/api/index.js`**
  ```javascript
  import { compressImageForUpload } from '@/utils/imageCompressor';

  export async function uploadImage(file, projectId = '') {
    const token = getStoredToken();
    const compressedFile = await compressImageForUpload(file);
    const form = new FormData();
    form.append('file', compressedFile);

    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const res = await fetch(`${BASE}/images/upload${query}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'Image upload failed');
    return data.url;
  }

  export async function deleteImage(url) {
    if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return false;
    const token = getStoredToken();
    try {
      const res = await fetch(`${BASE}/images/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      return !!(res.ok && data.success);
    } catch (e) {
      return false;
    }
  }
  ```

---

### Task 2: Backend Cloudinary Service & Deletion Routes

**Files:**
- Modify: `backend/src/services/storageService.js`
- Modify: `backend/src/routes/imageRoutes.js`

**Interfaces:**
- Consumes: `userId`, `projectId`, `url`, `buffer`
- Produces: `uploadImageBuffer(userId, projectId, buffer, mimeType)`, `deleteProjectImages(userId, projectId)`, `deleteImageByUrl(url)`, `DELETE /api/images/delete`

- [ ] **Step 1: Update `backend/src/services/storageService.js`**
  Add helper to parse publicId from URL and functions to destroy single images and project folders:
  ```javascript
  function extractPublicIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i);
    return match ? match[1] : null;
  }

  async function uploadImageBuffer(userId, projectId, buffer, mimeType) {
    const resourceType = 'image';
    const folder = projectId ? `docforge/${userId}/${projectId}` : `docforge/${userId}/general`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder,
          tags: projectId ? [userId, projectId] : [userId],
          use_filename: false,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) return reject(new Error(error.message || 'Cloudinary upload failed'));
          resolve(result.secure_url);
        }
      );
      uploadStream.end(buffer);
    });
  }

  async function deleteImageByUrl(url) {
    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) return false;
    try {
      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch (err) {
      console.warn('[storageService] failed to destroy image:', err.message);
      return false;
    }
  }

  async function deleteProjectImages(userId, projectId) {
    if (!userId || !projectId) return false;
    const folderPath = `docforge/${userId}/${projectId}`;
    try {
      await cloudinary.api.delete_resources_by_prefix(folderPath);
      await cloudinary.api.delete_folder(folderPath);
      return true;
    } catch (err) {
      console.warn(`[storageService] failed to delete project folder ${folderPath}:`, err.message);
      return false;
    }
  }

  module.exports = { uploadImageBuffer, deleteImageByUrl, deleteProjectImages, extractPublicIdFromUrl };
  ```

- [ ] **Step 2: Update `backend/src/routes/imageRoutes.js`**
  Pass `projectId` from request and add `DELETE /api/images/delete`:
  ```javascript
  const { uploadImageBuffer, deleteImageByUrl } = require('../services/storageService');

  // In POST /upload route:
  const userId = req.user._id.toString();
  const projectId = req.body?.projectId || req.query?.projectId || '';
  const url = await uploadImageBuffer(userId, projectId, req.file.buffer, req.file.mimetype);
  res.json({ success: true, url });

  // Add DELETE route:
  router.delete('/delete', requireAuth, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });
    try {
      await deleteImageByUrl(url);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  ```

---

### Task 3: Project Deletion Hook & Canvas Image Replacement Cleanup

**Files:**
- Modify: `backend/src/controllers/projectController.js`
- Modify: `frontend/src/features/Editor/components/ChapterEditor/CertificateCanvasEditor.jsx`

- [ ] **Step 1: Clean up Cloudinary images in `projectController.js` on project deletion**
  In `syncProjects`:
  ```javascript
  const { deleteProjectImages } = require('../services/storageService');

  // Inside syncProjects after bulkWrite deleteMany or soft delete:
  if (deleteIds.length > 0) {
    deleteIds.forEach((pId) => {
      deleteProjectImages(req.user._id.toString(), pId).catch((err) =>
        console.warn(`[syncProjects] Error cleaning images for ${pId}:`, err.message)
      );
    });
  }
  ```

- [ ] **Step 2: Clean up old Cloudinary images on replacement in `CertificateCanvasEditor.jsx`**
  In `handleImageFile`:
  ```javascript
  import { uploadImage, deleteImage } from "@/services/api";

  // Pass current project ID to uploadImage:
  const imageUrl = await uploadImage(file, currentProject?.id);

  if (targetId) {
    const oldObj = scene.objects?.find((o) => o.id === targetId);
    if (oldObj?.src && oldObj.src.includes("res.cloudinary.com")) {
      deleteImage(oldObj.src); // fire and forget cleanup
    }
    updateObject(targetId, { src: imageUrl });
    showToast("Image replaced.");
    return;
  }
  ```

---

### Task 4: Verification & Build Validation

- [ ] **Step 1: Verify frontend build with `npm run build`**
- [ ] **Step 2: Verify backend routes and exports**
