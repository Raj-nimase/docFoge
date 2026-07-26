import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import useAcaStore from "@/contexts/projectStore/projectStore";
import { generateVectorPdfFromScene } from "@/utils/pdfVectorRenderer";
import KonvaStage from "./KonvaPageEditor/KonvaStage";
import EditorToolbar from "./KonvaPageEditor/EditorToolbar";
import PropertyInspector from "./KonvaPageEditor/PropertyInspector";
import TemplateGallery from "./KonvaPageEditor/TemplateGallery";
import useCertificateScene from "./KonvaPageEditor/useCertificateScene";
import { prepareImageFile } from "./KonvaPageEditor/imagePrep";
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_MERGE_DATA } from "./KonvaPageEditor/canvasConstants";
import "./KonvaPageEditor/certificateEditor.css";

const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** True when focus is in a field, so shortcuts don't hijack typing. */
function isTypingTarget(el) {
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

export default function CertificateCanvasEditor({ section }) {
  const currentProject = useAcaStore((s) => s.getCurrentProject());
  const metadata = currentProject?.metadata || {};

  const {
    scene,
    selectedId,
    setSelectedId,
    selectedObject,
    sceneByteSize,
    canUndo,
    canRedo,
    undo,
    redo,
    commit,
    addObject,
    updateObject,
    deleteObject,
    duplicate,
    moveLayer,
    reorderObject,
    nudge,
    updatePage,
    updateMergeData,
    applyTemplate,
  } = useCertificateScene(section);

  const [zoom, setZoom] = useState(1);
  const [showMergePreview, setShowMergePreview] = useState(true);
  const [activeTab, setActiveTab] = useState("design");
  const [editingId, setEditingId] = useState(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState(null);

  const rootRef = useRef(null);
  const fileInputRef = useRef(null);
  const replaceTargetRef = useRef(null);

  const showToast = useCallback((message, tone = "info") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Anything undoable means there's layout worth confirming before a template
  // overwrites it.
  const isDirty = canUndo;

  /* ── Zoom ─────────────────────────────────────────────────────────────── */

  const fitToScreen = useCallback(() => {
    const wrap = rootRef.current?.querySelector(".cs-canvas-wrap");
    if (!wrap) return;
    // 64px accounts for the workspace padding on both sides.
    const available = { w: wrap.clientWidth - 64, h: wrap.clientHeight - 64 };
    const pageW = scene.page?.width || 595;
    const pageH = scene.page?.height || 842;
    if (available.w <= 0 || available.h <= 0) return;
    setZoom(clampZoom(Math.min(available.w / pageW, available.h / pageH)));
  }, [scene.page]);

  // Fit once on mount so an A4 page isn't cropped by a short viewport.
  const didFitRef = useRef(false);
  useEffect(() => {
    if (didFitRef.current) return;
    didFitRef.current = true;
    // Wait a frame for the panel to size itself.
    requestAnimationFrame(fitToScreen);
  }, [fitToScreen]);

  /**
   * Zoom around the pointer, keeping the point under the cursor fixed —
   * otherwise Ctrl+scroll drifts away from whatever you were looking at.
   */
  const handleZoomAt = useCallback((factor, pointer) => {
    setZoom((prev) => {
      const next = clampZoom(prev * factor);
      if (next === prev) return prev;

      const wrap = rootRef.current?.querySelector(".cs-canvas-wrap");
      if (wrap && pointer) {
        const ratio = next / prev;
        requestAnimationFrame(() => {
          wrap.scrollLeft = pointer.clientX * ratio - pointer.viewX;
          wrap.scrollTop = pointer.clientY * ratio - pointer.viewY;
        });
      }
      return next;
    });
  }, []);

  /* ── Images ───────────────────────────────────────────────────────────── */

  const pickImage = useCallback((replaceId = null) => {
    replaceTargetRef.current = replaceId;
    fileInputRef.current?.click();
  }, []);

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const { src, width, height } = await prepareImageFile(file);
      const targetId = replaceTargetRef.current;
      replaceTargetRef.current = null;

      if (targetId) {
        updateObject(targetId, { src });
        showToast("Image replaced.");
        return;
      }

      // Size the new object to the image's real aspect ratio rather than
      // forcing it into a square. Passed as overrides so insertion is a single
      // undo step.
      const maxEdge = 200;
      const ratio = width / height;
      const w = ratio >= 1 ? maxEdge : Math.round(maxEdge * ratio);
      const h = ratio >= 1 ? Math.round(maxEdge / ratio) : maxEdge;

      addObject("image", { src, overrides: { width: w, height: h } });
    } catch (err) {
      showToast(err.message || "Could not add that image.", "error");
    }
  };

  /* ── Export ───────────────────────────────────────────────────────────── */

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const pdfBytes = await generateVectorPdfFromScene(
        scene,
        showMergePreview ? scene.mergeData : {},
      );
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = (scene.mergeData?.student_name || "certificate")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      a.download = `${name || "certificate"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("PDF downloaded.");
    } catch (err) {
      console.error("Failed to generate vector PDF:", err);
      showToast(err.message || "Could not generate the PDF.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  /* ── Keyboard ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    const onKeyDown = (e) => {
      const root = rootRef.current;
      if (!root) return;

      // Only claim keys when the studio owns focus. Clicking the canvas or a
      // toolbar button puts focus inside root; on first load nothing is
      // focused yet, so body counts as ours too. Without this, Delete pressed
      // while a sidebar button had focus would destroy a canvas object.
      const active = document.activeElement;
      const ownsFocus = root.contains(e.target) || active === document.body || active === root;
      if (!ownsFocus) return;

      // Never steal keys from a form field or the inline text editor.
      if (isTypingTarget(e.target) || editingId) return;

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate(selectedId);
        return;
      }
      if (mod && e.key === "0") {
        e.preventDefault();
        fitToScreen();
        return;
      }
      if (mod && (e.key === "]" || e.key === "[")) {
        e.preventDefault();
        moveLayer(e.key === "]" ? "forward" : "backward");
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selectedId) return;
        e.preventDefault();
        deleteObject(selectedId);
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }

      if (e.key.startsWith("Arrow")) {
        if (!selectedId) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const deltas = {
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
        };
        const [dx, dy] = deltas[e.key] || [0, 0];
        nudge(dx, dy);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    editingId,
    selectedId,
    undo,
    redo,
    duplicate,
    deleteObject,
    moveLayer,
    nudge,
    setSelectedId,
    fitToScreen,
  ]);

  /* ── Handlers wired to children ───────────────────────────────────────── */

  const handleUpdateSelected = useCallback(
    (patch, options) => {
      if (selectedId) updateObject(selectedId, patch, options);
    },
    [selectedId, updateObject],
  );

  const handleResetMergeData = useCallback(() => {
    commit((prev) => ({
      ...prev,
      mergeData: {
        ...DEFAULT_MERGE_DATA,
        ...(metadata.authors ? { student_name: metadata.authors } : {}),
        ...(metadata.title ? { project_title: metadata.title } : {}),
      },
    }));
    showToast("Variables refilled from project metadata.");
  }, [commit, metadata.authors, metadata.title, showToast]);

  const handleSelectFromLayers = useCallback(
    (id) => {
      setSelectedId(id);
      setActiveTab("design");
    },
    [setSelectedId],
  );

  return (
    <div className="cert-studio" ref={rootRef} tabIndex={-1}>
      <EditorToolbar
        onAddText={() => addObject("text")}
        onPickImage={() => pickImage(null)}
        onAddQr={() => addObject("qr")}
        onAddTable={() => addObject("table")}
        onAddShape={(shapeType) => addObject("shape", { shapeType })}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onDeleteSelected={() => deleteObject(selectedId)}
        onDuplicate={() => duplicate(selectedId)}
        onMoveLayer={moveLayer}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => clampZoom(z + 0.1))}
        onZoomOut={() => setZoom((z) => clampZoom(z - 0.1))}
        onSetZoom={(z) => setZoom(clampZoom(z))}
        onFit={fitToScreen}
        showMergePreview={showMergePreview}
        onToggleMergePreview={() => setShowMergePreview((v) => !v)}
        onExportPdf={handleExportPdf}
        isExporting={isExporting}
        hasSelected={Boolean(selectedId)}
      />

      <div className="cs-body">
        <KonvaStage
          scene={scene}
          selectedId={selectedId}
          onSelectId={setSelectedId}
          onCommitObject={updateObject}
          mergeData={showMergePreview ? scene.mergeData : {}}
          zoom={zoom}
          onZoomAt={handleZoomAt}
          editingId={editingId}
          onStartEditing={setEditingId}
          onFinishEditing={() => setEditingId(null)}
        />

        <PropertyInspector
          scene={scene}
          selectedObject={selectedObject}
          selectedId={selectedId}
          onSelectId={handleSelectFromLayers}
          onUpdateSelected={handleUpdateSelected}
          onUpdateObject={updateObject}
          onUpdatePage={updatePage}
          onUpdateMergeData={updateMergeData}
          onResetMergeData={handleResetMergeData}
          onReorder={reorderObject}
          onReplaceImage={pickImage}
          sceneByteSize={sceneByteSize}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
        />
      </div>

      <TemplateGallery
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onApply={applyTemplate}
        isDirty={isDirty}
      />

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleImageFile}
        style={{ display: "none" }}
      />

      {toast && (
        <div className={`cs-toast${toast.tone === "error" ? " cs-toast--error" : ""}`} role="status">
          {toast.tone === "error" && <CircleAlert size={15} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
