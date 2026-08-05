# Certificate Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement pre-step rendering cache invalidation, expand the preset certificate gallery to 4 templates, and enhance font family aliases for `pdf-lib` vector rendering.

**Architecture:** 
1. Cache invalidation computes SHA256 hashes of scene JSON + metadata in `compileRoutes.js` and skips `renderCertificateVectorPdf` on cache hits.
2. Preset templates in `presetTemplates.js` and `certificatePdfService.js` are updated with 4 complete template scenes.
3. Font mapping in `certificatePdfService.js` maps display/serif/sans/mono font families to corresponding `pdf-lib` standard fonts.

**Tech Stack:** Node.js, pdf-lib, React, Konva, Zustand.

## Global Constraints

- Preserve pure vector PDF generation with pdf-lib.
- Maintain backwards compatibility with legacy projects.

---

### Task 1: Enhanced Font Family Mapping & Expanded Preset Gallery in Backend

**Files:**
- Modify: `backend/src/services/certificatePdfService.js`

- [ ] **Step 1: Update font mapping and preset templates in certificatePdfService.js**
  - Add extended font alias lookups in `getFont()` (Cinzel, Playfair, Great Vibes, Montserrat, Inter, Roboto).
  - Include 4 preset templates (`degree-certificate`, `course-completion`, `ieee-award`, `distinction-certificate`) in `DEFAULT_CERTIFICATE_OBJECTS`.

- [ ] **Step 2: Verify with Node execution script**
  - Run node test script to render vector PDFs for all presets.

---

### Task 2: Expand Preset Gallery in Frontend Canvas Studio

**Files:**
- Modify: `frontend/src/features/Editor/components/ChapterEditor/KonvaPageEditor/presetTemplates.js`

- [ ] **Step 1: Add expanded preset templates to presetTemplates.js**
  - Add `course-completion`, `ieee-award`, and `distinction-certificate` presets to `PRESET_TEMPLATES`.

---

### Task 3: Implement Pre-Step Cache Invalidation in Compile Pipeline

**Files:**
- Modify: `backend/src/routes/compileRoutes.js`

- [ ] **Step 1: Add scene hash check before calling renderCertificateVectorPdf**
  - Compute SHA256 hash over scene JSON and metadata.
  - Skip vector rendering if hash matches sidecar `.hash` file and output PDF exists.

- [ ] **Step 2: Test compile pipeline performance & verification**
  - Run test compile script and verify cache hit skip behavior.
