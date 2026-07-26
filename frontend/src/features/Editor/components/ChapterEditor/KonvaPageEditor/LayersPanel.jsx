import { useState } from "react";
import {
  Type,
  Image as ImageIcon,
  QrCode,
  Table2,
  Square,
  Circle,
  Minus,
  Frame,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  GripVertical,
  Layers,
} from "lucide-react";
import { describeObject } from "./canvasConstants";

function iconFor(obj) {
  if (obj.type === "text") return Type;
  if (obj.type === "image") return ImageIcon;
  if (obj.type === "qr") return QrCode;
  if (obj.type === "table") return Table2;
  if (obj.type === "shape") {
    if (obj.shapeType === "circle") return Circle;
    if (obj.shapeType === "line") return Minus;
    if (obj.shapeType === "border") return Frame;
  }
  return Square;
}

/**
 * Object list, topmost first.
 *
 * Without this, an object sitting underneath another is simply unreachable —
 * the only way to select it was to drag the top one away and back.
 */
export default function LayersPanel({
  objects,
  selectedId,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onReorder,
}) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  if (!objects.length) {
    return (
      <div className="cs-empty">
        <Layers size={22} />
        <span>No objects yet. Add text, an image or a shape from the toolbar.</span>
      </div>
    );
  }

  // Painted back-to-front, but read top-to-bottom — so the list is reversed.
  const rows = objects.map((obj, idx) => ({ obj, idx })).reverse();

  return (
    <div className="cs-layers">
      {rows.map(({ obj, idx }) => {
        const Icon = iconFor(obj);
        const isActive = obj.id === selectedId;

        return (
          <div
            key={obj.id}
            className={[
              "cs-layer-row",
              isActive ? "cs-layer-row--active" : "",
              obj.hidden ? "cs-layer-row--hidden" : "",
              dragIdx === idx ? "cs-layer-row--dragging" : "",
              overIdx === idx && dragIdx !== null && dragIdx !== idx
                ? "cs-layer-row--drop-target"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIdx(idx);
            }}
            onDragEnd={() => {
              setDragIdx(null);
              setOverIdx(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx !== null && dragIdx !== idx) onReorder(dragIdx, idx);
              setDragIdx(null);
              setOverIdx(null);
            }}
            onClick={() => onSelect(obj.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(obj.id);
              }
            }}
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            title={describeObject(obj)}
          >
            <span className="cs-layer-grip" aria-hidden="true">
              <GripVertical size={13} />
            </span>
            <span className="cs-layer-icon">
              <Icon size={14} />
            </span>
            <span className="cs-layer-name">{describeObject(obj)}</span>

            <span className="cs-layer-actions">
              <button
                type="button"
                className={`cs-icon-btn${obj.locked ? " cs-icon-btn--on" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLocked(obj.id, !obj.locked);
                }}
                title={obj.locked ? "Unlock" : "Lock position"}
                aria-label={obj.locked ? "Unlock object" : "Lock object"}
              >
                {obj.locked ? <Lock size={13} /> : <LockOpen size={13} />}
              </button>
              <button
                type="button"
                className="cs-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHidden(obj.id, !obj.hidden);
                }}
                title={obj.hidden ? "Show" : "Hide"}
                aria-label={obj.hidden ? "Show object" : "Hide object"}
              >
                {obj.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
