# Certificate Feature Optimizations Design Specification

**Date:** 2026-08-05  
**Topic:** Certificate Feature Optimizations  

---

## 1. Overview & Objectives

This specification details three targeted optimizations to the Certificate feature in docForge:
1. **Pre-step Cache Invalidation**: Avoid redundant `pdf-lib` vector rendering when the Certificate JSON scene and metadata remain unchanged between compile calls.
2. **Preset Template Gallery Expansion**: Add 4 curated visual certificate templates (Degree Certificate, Course Completion, IEEE Excellence Award, Diploma Distinction Certificate) to the frontend preset picker and backend fallback defaults.
3. **Enhanced Font Mapping**: Expand `certificatePdfService.js` font family lookups to gracefully map Google Fonts (*Cinzel*, *Great Vibes*, *Montserrat*, *Playfair Display*) to their optimal standard vector font equivalents (*Times-Roman*, *Helvetica*, *Courier*).

---

## 2. Component Design & Changes

### A. Pre-Step Cache Invalidation (`backend/src/routes/compileRoutes.js`)
- Compute a SHA256 hash over `JSON.stringify({ scene: contentObj, metadata: combinedMetadata })`.
- Compare this hash against a persistent sidecar hash file (`cert_vector_<id>.pdf.hash`) stored in the temp compilation workspace.
- If the PDF exists and the hash matches, skip `renderCertificateVectorPdf` execution completely (~150ms saved per compile).

### B. Preset Gallery Expansion (`frontend/src/features/Editor/components/ChapterEditor/KonvaPageEditor/presetTemplates.js` & `backend/src/services/certificatePdfService.js`)
- Add 4 preset templates to `presetTemplates.js`:
  1. `degree-certificate` (🎓 Degree Certificate / Diploma Project Report)
  2. `course-completion` (📜 Course Completion Certificate)
  3. `ieee-award` (🏆 IEEE Conference / Academic Excellence Award)
  4. `distinction-certificate` (🎖️ Diploma / University Distinction Certificate)
- Mirror these presets into `DEFAULT_CERTIFICATE_OBJECTS` in `certificatePdfService.js` so backend fallback rendering is identical.

### C. Custom Font Mapping (`backend/src/services/certificatePdfService.js`)
- Update `getFont(fontFamily, fontWeight)` in `certificatePdfService.js` to recognize extended font aliases:
  - Serif/Display: `cinzel`, `playfair`, `georgia`, `times`, `times-roman`, `great vibes` -> `Times-Roman`
  - Sans-Serif: `montserrat`, `inter`, `roboto`, `arial`, `helvetica` -> `Helvetica`
  - Monospace: `monospace`, `courier`, `jetbrains` -> `Courier`

---

## 3. Verification Plan

### Automated / Node Verification
- Run a Node test script to execute `renderCertificateVectorPdf` against all 4 preset templates and verify PDF byte output.
- Perform a compile call twice to verify pre-step cache hit skips rendering on the second call.
