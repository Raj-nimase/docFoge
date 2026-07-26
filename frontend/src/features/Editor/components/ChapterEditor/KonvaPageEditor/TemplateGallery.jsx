
import { X, TriangleAlert } from "lucide-react";
import { PRESET_TEMPLATES } from "./presetTemplates";

/**
 * Miniature wireframe of a template's layout.
 *
 * Enough to tell the four presets apart at a glance without paying to mount
 * four full Konva stages — each object becomes a positioned block, scaled to
 * fit the thumbnail.
 */
function TemplateThumb({ template }) {
  const pageW = template.page?.width || 595;
  const pageH = template.page?.height || 842;

  const BOX = { w: 176, h: 124 };
  const scale = Math.min(BOX.w / pageW, BOX.h / pageH);
  const w = pageW * scale;
  const h = pageH * scale;

  const markFor = (obj) => {
    if (obj.hidden) return null;

    if (obj.type === "shape" && obj.shapeType === "border") {
      const m = (obj.margin || 20) * scale;
      return {
        left: m,
        top: m,
        width: Math.max(1, w - m * 2),
        height: Math.max(1, h - m * 2),
        border: `1px solid ${obj.stroke || "#1e3a8a"}`,
        background: "transparent",
      };
    }

    const left = (obj.x || 0) * scale;
    const top = (obj.y || 0) * scale;

    if (obj.type === "text") {
      const fontSize = (obj.fontSize || 14) * scale;
      const lines = String(obj.text || "").split("\n").length;
      return {
        left,
        top,
        width: Math.max(2, (obj.width || 100) * scale),
        height: Math.max(1.5, fontSize * 1.25 * lines),
        background: obj.fill || "#64748b",
        opacity: 0.72,
      };
    }

    if (obj.type === "qr") {
      const s = (obj.size || 70) * scale;
      return { left, top, width: s, height: s, background: "#111827", opacity: 0.8 };
    }

    if (obj.type === "table") {
      const rowH = ((obj.fontSize || 11) + (obj.cellPadding || 8) * 2) * scale;
      const lines = (obj.headers?.length ? 1 : 0) + (obj.rows?.length || 0);
      return {
        left,
        top,
        width: (obj.width || 475) * scale,
        height: Math.max(2, rowH * lines),
        background: obj.headerBg || "#e2e8f0",
        border: `1px solid ${obj.borderColor || "#cbd5e1"}`,
      };
    }

    return {
      left,
      top,
      width: Math.max(1, (obj.width || 50) * scale),
      height: Math.max(1, (obj.height || 50) * scale),
      background: obj.fill || "transparent",
      border: obj.stroke ? `1px solid ${obj.stroke}` : "none",
    };
  };

  return (
    <div className="cs-template-thumb">
      <div
        className="cs-template-page"
        style={{ width: w, height: h, background: template.page?.bg || "#ffffff" }}
      >
        {template.objects.map((obj, i) => {
          const style = markFor(obj);
          if (!style) return null;
          return <div key={obj.id || i} className="cs-template-mark" style={style} />;
        })}
      </div>
    </div>
  );
}

/**
 * Template picker.
 *
 * Applying a template throws away the current layout, so it gets a real
 * preview and — when there's work to lose — an explicit confirmation. The old
 * unlabelled <select> destroyed the document on a single mis-click.
 */
export default function TemplateGallery({ open, onClose, onApply, isDirty }) {
  if (!open) return null;

  const handlePick = (template) => {
    if (isDirty) {
      const ok = window.confirm(
        `Replace the current design with “${template.name}”?\n\nYour layout will be replaced. Your variable values are kept, and you can undo this with Ctrl+Z.`,
      );
      if (!ok) return;
    }
    onApply(template);
    onClose();
  };

  return (
    <div
      className="cs-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a template"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cs-modal">
        <div className="cs-modal-head">
          <div>
            <div className="cs-modal-title">Templates</div>
            <div className="cs-modal-sub">
              Replaces the current layout. Your variable values are preserved.
            </div>
          </div>
          <button
            type="button"
            className="cs-btn cs-btn--icon cs-btn--ghost"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="cs-modal-body">
          <div className="cs-template-grid">
            {PRESET_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className="cs-template-card"
                onClick={() => handlePick(template)}
              >
                <TemplateThumb template={template} />
                <div className="cs-template-meta">
                  <div className="cs-template-name">{template.name}</div>
                  <div className="cs-template-dims">
                    {template.page?.width || 595} × {template.page?.height || 842} pt ·{" "}
                    {template.objects.length} objects
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="cs-modal-foot">
          {isDirty ? (
            <span className="cs-warn-text">
              <TriangleAlert size={14} />
              You have unsaved layout changes — you'll be asked to confirm.
            </span>
          ) : (
            <span className="cs-hint">Pick a template to start from.</span>
          )}
          <button type="button" className="cs-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
