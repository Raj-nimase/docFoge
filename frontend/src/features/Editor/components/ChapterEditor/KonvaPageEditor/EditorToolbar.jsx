import { useEffect, useRef, useState } from "react";
import {
  Type,
  Image as ImageIcon,
  QrCode,
  Table2,
  Square,
  Circle,
  Minus,
  Frame,
  Undo2,
  Redo2,
  BringToFront,
  SendToBack,
  Copy,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Eye,
  EyeOff,
  Download,
  Sparkles,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { ZOOM_STEPS } from "./canvasConstants";

/** Closes a dropdown on outside click or Escape. */
function useDismiss(open, onClose) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return ref;
}

function ShapeMenu({ onAddShape }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const shapes = [
    { kind: "rect", label: "Rectangle", Icon: Square },
    { kind: "circle", label: "Circle", Icon: Circle },
    { kind: "line", label: "Line", Icon: Minus },
    { kind: "border", label: "Document Border", Icon: Frame },
  ];

  return (
    <div className="cs-menu-wrap" ref={ref}>
      <button
        type="button"
        className="cs-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Insert a shape"
      >
        <Square size={15} />
        Shape
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="cs-menu" role="menu">
          {shapes.map(({ kind, label, Icon }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              className="cs-menu-item"
              onClick={() => {
                onAddShape(kind);
                setOpen(false);
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ZoomControl({ zoom, onZoomIn, onZoomOut, onSetZoom, onFit }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  return (
    <div className="cs-zoom">
      <button
        type="button"
        className="cs-icon-btn"
        onClick={onZoomOut}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <ZoomOut size={15} />
      </button>

      <div className="cs-menu-wrap" ref={ref}>
        <button
          type="button"
          className="cs-zoom-value"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Zoom level"
        >
          {Math.round(zoom * 100)}%
        </button>
        {open && (
          <div className="cs-menu cs-menu--right" role="menu" style={{ minWidth: 140 }}>
            {ZOOM_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                role="menuitem"
                className={`cs-menu-item${Math.abs(zoom - step) < 0.001 ? " cs-menu-item--on" : ""}`}
                onClick={() => {
                  onSetZoom(step);
                  setOpen(false);
                }}
              >
                {Math.round(step * 100)}%
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              className="cs-menu-item"
              onClick={() => {
                onFit();
                setOpen(false);
              }}
            >
              <Maximize size={14} />
              Fit to screen
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="cs-icon-btn"
        onClick={onZoomIn}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <ZoomIn size={15} />
      </button>
    </div>
  );
}

export default function EditorToolbar({
  onAddText,
  onPickImage,
  onAddQr,
  onAddTable,
  onAddShape,
  onOpenTemplates,
  onDeleteSelected,
  onDuplicate,
  onMoveLayer,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onSetZoom,
  onFit,
  showMergePreview,
  onToggleMergePreview,
  onExportPdf,
  isExporting,
  hasSelected,
}) {
  return (
    <div className="cs-toolbar" role="toolbar" aria-label="Certificate editor tools">
      {/* Insert */}
      <div className="cs-toolbar-group">
        <button type="button" className="cs-btn" onClick={onAddText} title="Add text (T)">
          <Type size={15} />
          Text
        </button>
        <button type="button" className="cs-btn" onClick={onPickImage} title="Add an image">
          <ImageIcon size={15} />
          Image
        </button>
        <button type="button" className="cs-btn" onClick={onAddQr} title="Add a QR code">
          <QrCode size={15} />
          QR
        </button>
        <button type="button" className="cs-btn" onClick={onAddTable} title="Add a table">
          <Table2 size={15} />
          Table
        </button>
        <ShapeMenu onAddShape={onAddShape} />
      </div>

      <div className="cs-divider" />

      {/* History */}
      <div className="cs-toolbar-group">
        <button
          type="button"
          className="cs-btn cs-btn--icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="cs-btn cs-btn--icon"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 size={15} />
        </button>
      </div>

      <div className="cs-divider" />

      {/* Arrange — disabled rather than hidden, so the toolbar never reflows
          and the controls stay where the user last saw them. */}
      <div className="cs-toolbar-group">
        <button
          type="button"
          className="cs-btn cs-btn--icon"
          onClick={() => onMoveLayer("top")}
          disabled={!hasSelected}
          title="Bring to front (Ctrl+])"
          aria-label="Bring to front"
        >
          <BringToFront size={15} />
        </button>
        <button
          type="button"
          className="cs-btn cs-btn--icon"
          onClick={() => onMoveLayer("bottom")}
          disabled={!hasSelected}
          title="Send to back (Ctrl+[)"
          aria-label="Send to back"
        >
          <SendToBack size={15} />
        </button>
        <button
          type="button"
          className="cs-btn cs-btn--icon"
          onClick={onDuplicate}
          disabled={!hasSelected}
          title="Duplicate (Ctrl+D)"
          aria-label="Duplicate"
        >
          <Copy size={15} />
        </button>
        <button
          type="button"
          className="cs-btn cs-btn--icon cs-btn--danger"
          onClick={onDeleteSelected}
          disabled={!hasSelected}
          title="Delete (Del)"
          aria-label="Delete selected"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="cs-toolbar-spacer" />

      {/* View + export */}
      <div className="cs-toolbar-group">
        <button type="button" className="cs-btn" onClick={onOpenTemplates} title="Browse templates">
          <Sparkles size={15} />
          Templates
        </button>

        <ZoomControl
          zoom={zoom}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onSetZoom={onSetZoom}
          onFit={onFit}
        />

        <button
          type="button"
          className={`cs-btn${showMergePreview ? " cs-btn--active" : ""}`}
          onClick={onToggleMergePreview}
          title={
            showMergePreview
              ? "Showing merged values — click to show raw {{tags}}"
              : "Showing raw {{tags}} — click to preview merged values"
          }
          aria-pressed={showMergePreview}
        >
          {showMergePreview ? <Eye size={15} /> : <EyeOff size={15} />}
          {showMergePreview ? "Preview" : "Tags"}
        </button>

        <button
          type="button"
          className="cs-btn cs-btn--primary"
          onClick={onExportPdf}
          disabled={isExporting}
          title="Download as a vector PDF"
        >
          {isExporting ? (
            <Loader2 size={15} className="cs-spin" />
          ) : (
            <Download size={15} />
          )}
          {isExporting ? "Generating…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}
