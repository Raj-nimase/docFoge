# Base64 Image Storage Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate Base64 image storage in MongoDB and LocalStorage by uploading canvas images directly to Cloudinary and sanitizing scene data before sync.

**Architecture:** Upload images directly to Cloudinary via `api.uploadImage(file)` when added to the Certificate/Canvas Editor, store Cloudinary HTTPS URLs in the scene JSON instead of Base64 Data URLs, and extend `stripBase64FromDoc()` to sanitize any residual canvas Base64 images.

**Tech Stack:** React, Konva Canvas, Cloudinary API, Node.js / Express, MongoDB / Mongoose

## Global Constraints
- Do NOT store Base64 strings (`data:image/...;base64,...`) in `projectStore` or MongoDB.
- Preserve image aspect ratios and dimensions when inserting into canvas scenes.
- Keep PDF rendering (Typst and pdf-lib) operational with HTTPS image URLs.

---

### Task 1: Canvas Editor Direct Image Upload

**Files:**
- Modify: [`frontend/src/features/Editor/components/ChapterEditor/CertificateCanvasEditor.jsx:125-153`](file:///C:/Users/User/Desktop/EXP/docFoge/frontend/src/features/Editor/components/ChapterEditor/CertificateCanvasEditor.jsx#L125-L153)

**Interfaces:**
- Consumes: [`prepareImageFile(file)`](file:///C:/Users/User/Desktop/EXP/docFoge/frontend/src/features/Editor/components/ChapterEditor/KonvaPageEditor/imagePrep.js#L44), [`uploadImage(file)`](file:///C:/Users/User/Desktop/EXP/docFoge/frontend/src/services/api/index.js#L330)
- Produces: Object in scene with `src: httpsUrl`

- [ ] **Step 1: Inspect `handleImageFile` in `CertificateCanvasEditor.jsx`**
  Verify imports for `api.uploadImage` or `uploadImage` from `@/services/api`.

- [ ] **Step 2: Update `handleImageFile` to upload image file directly to Cloudinary**
  Update `handleImageFile` in `CertificateCanvasEditor.jsx`:
  ```javascript
  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      showToast("Uploading image...", "info");
      // 1. Get aspect ratio and dimensions
      const { width, height } = await prepareImageFile(file);
      
      // 2. Upload raw file to Cloudinary via API helper
      const imageUrl = await uploadImage(file);
      
      const targetId = replaceTargetRef.current;
      replaceTargetRef.current = null;

      if (targetId) {
        updateObject(targetId, { src: imageUrl });
        showToast("Image replaced.");
        return;
      }

      const maxEdge = 200;
      const ratio = width / height;
      const w = ratio >= 1 ? maxEdge : Math.round(maxEdge * ratio);
      const h = ratio >= 1 ? Math.round(maxEdge / ratio) : maxEdge;

      addObject("image", { src: imageUrl, overrides: { width: w, height: h } });
      showToast("Image added successfully.");
    } catch (err) {
      showToast(err.message || "Could not upload image.", "error");
    }
  };
  ```

- [ ] **Step 3: Verify build and syntax**
  Check for any syntax or import issues in `CertificateCanvasEditor.jsx`.

---

### Task 2: Canvas Scene Base64 Sanitization in `projectStore.js`

**Files:**
- Modify: [`frontend/src/contexts/projectStore/projectStore.js:310-319`](file:///C:/Users/User/Desktop/EXP/docFoge/frontend/src/contexts/projectStore/projectStore.js#L310-L319)

**Interfaces:**
- Consumes: `doc` structure (TipTap document or Certificate Canvas Scene)
- Produces: Sanitized `doc` free of Base64 image data URLs

- [ ] **Step 1: Update `stripBase64FromDoc` to sanitize canvas objects**
  In `frontend/src/contexts/projectStore/projectStore.js`:
  ```javascript
  function stripBase64FromDoc(doc) {
    if (!doc || typeof doc !== 'object') return doc;
    if (Array.isArray(doc)) return doc.map(stripBase64FromDoc);
    
    // Check TipTap rich text image nodes
    if (doc.type === 'image' && typeof doc.attrs?.src === 'string' && doc.attrs.src.startsWith('data:')) {
      return { ...doc, attrs: { ...doc.attrs, src: '' } };
    }
    
    // Check Canvas Scene objects array
    if (Array.isArray(doc.objects)) {
      const cleanObjects = doc.objects.map((obj) => {
        if (obj && typeof obj.src === 'string' && obj.src.startsWith('data:')) {
          return { ...obj, src: '' };
        }
        return obj;
      });
      return { ...doc, objects: cleanObjects };
    }

    if (doc.content) {
      return { ...doc, content: stripBase64FromDoc(doc.content) };
    }
    return doc;
  }
  ```

- [ ] **Step 2: Verify `stripBase64FromDoc` handles nested arrays and canvas scenes**
  Ensure recursively checking `doc.content` handles `{ content: { objects: [...] } }`.

---

### Task 3: Verification & Validation

- [ ] **Step 1: Check `pdfVectorRenderer.js` and backend `compileRoutes.js` compatibility**
  Verify HTTPS image loading in [`pdfVectorRenderer.js`](file:///C:/Users/User/Desktop/EXP/docFoge/frontend/src/utils/pdfVectorRenderer.js#L236) and [`compileRoutes.js`](file:///C:/Users/User/Desktop/EXP/docFoge/backend/src/routes/compileRoutes.js#L267).
- [ ] **Step 2: Complete implementation and test verification**
