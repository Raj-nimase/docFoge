import { useRef, useState } from "react";
import {
  SlidersHorizontal,
  Database,
  Layers,
  Plus,
  X,
  Trash2,
  RotateCcw,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  TriangleAlert,
} from "lucide-react";
import { NumberField, ColorField, RangeField, SelectField, SegmentedField } from "./fields";
import LayersPanel from "./LayersPanel";
import { FONT_OPTIONS } from "@/utils/sceneFonts";
import {
  PAGE_PRESETS,
  PLACEHOLDERS,
  SHAPE_KIND_LABELS,
  OBJECT_TYPE_LABELS,
  matchPagePreset,
  alignCanvasObject,
} from "./canvasConstants";
import { formatBytes } from "./imagePrep";

/** Scene size past which localStorage starts being a real risk. */
const STORAGE_WARN_BYTES = 1_500_000;

const ALIGN_OPTIONS = [
  { value: "left", label: "Left", icon: <AlignLeft size={14} />, title: "Align left" },
  { value: "center", label: "Center", icon: <AlignCenter size={14} />, title: "Align centre" },
  { value: "right", label: "Right", icon: <AlignRight size={14} />, title: "Align right" },
];

/* ── Design tab: page settings (nothing selected) ─────────────────────────── */

function PageSettings({ page, onUpdatePage, sceneByteSize }) {
  const preset = matchPagePreset(page.width, page.height);
  const overBudget = sceneByteSize > STORAGE_WARN_BYTES;

  return (
    <>
      <div className="cs-section">
        <div className="cs-section-title">Page setup</div>

        <SelectField
          label="Size"
          value={preset?.id || "custom"}
          onChange={(id) => {
            const found = PAGE_PRESETS.find((p) => p.id === id);
            if (found) onUpdatePage({ width: found.width, height: found.height });
          }}
          options={[
            ...PAGE_PRESETS.map((p) => ({
              value: p.id,
              label: `${p.label} · ${p.width}×${p.height}`,
            })),
            ...(preset ? [] : [{ value: "custom", label: "Custom" }]),
          ]}
        />

        <div className="cs-row">
          <NumberField
            label="Width"
            suffix="pt"
            value={page.width}
            min={120}
            max={2400}
            onChange={(v) => onUpdatePage({ width: v }, { coalesceKey: "page:width" })}
          />
          <NumberField
            label="Height"
            suffix="pt"
            value={page.height}
            min={120}
            max={2400}
            onChange={(v) => onUpdatePage({ height: v }, { coalesceKey: "page:height" })}
          />
        </div>

        <ColorField
          label="Background"
          value={page.bg || "#ffffff"}
          fallback="#ffffff"
          onChange={(v) => onUpdatePage({ bg: v }, { coalesceKey: "page:bg" })}
        />
      </div>

      <div className="cs-section">
        <div className="cs-section-title">Storage</div>
        <div className={`cs-meter${overBudget ? " cs-meter--warn" : ""}`}>
          {overBudget && <TriangleAlert size={14} />}
          <span>
            This design is {formatBytes(sceneByteSize)}.
            {overBudget
              ? " Large embedded images may fail to save — consider removing or replacing some."
              : ""}
          </span>
        </div>
      </div>

      <div className="cs-section">
        <div className="cs-section-title">Tips</div>
        <div className="cs-hint">
          Double-click any text to edit it on the canvas. Hold <strong>Ctrl</strong> and scroll
          to zoom, or hold <strong>Space</strong> to pan. Drag an object near another to snap
          it into alignment.
        </div>
      </div>
    </>
  );
}

/* ── Design tab: selected-object properties ───────────────────────────────── */

function ObjectProperties({ obj, onUpdate, onReplaceImage, page }) {
  const key = (prop) => ({ coalesceKey: `${obj.id}:${prop}` });
  const textareaRef = useRef(null);
  const [ratioLocked, setRatioLocked] = useState(true);

  /** Insert a placeholder at the caret, not blindly appended to the end. */
  const insertPlaceholder = (tag) => {
    const field = textareaRef.current;
    const current = obj.text || "";
    if (!field) {
      onUpdate({ text: `${current}${current ? " " : ""}${tag}` });
      return;
    }
    const start = field.selectionStart ?? current.length;
    const end = field.selectionEnd ?? current.length;
    const next = current.slice(0, start) + tag + current.slice(end);
    onUpdate({ text: next });
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  return (
    <>
      <div className="cs-section">
        <div className="cs-section-title">
          {obj.type === "shape"
            ? SHAPE_KIND_LABELS[obj.shapeType || "rect"]
            : OBJECT_TYPE_LABELS[obj.type] || "Object"}
        </div>

        {/* Borders are page-anchored; x/y would be meaningless. */}
        {!(obj.type === "shape" && obj.shapeType === "border") && (
          <>
            <div className="cs-row">
              <NumberField
                label="X"
                value={obj.x || 0}
                onChange={(v) => onUpdate({ x: v }, key("x"))}
              />
              <NumberField
                label="Y"
                value={obj.y || 0}
                onChange={(v) => onUpdate({ y: v }, key("y"))}
              />
            </div>
            <div className="cs-field">
              <label>Align to page</label>
              <div className="cs-row cs-row--compact">
                <button
                  type="button"
                  className="cs-btn cs-btn--sm"
                  onClick={() => onUpdate(alignCanvasObject(obj, page, "left"))}
                  title="Align to left edge of page"
                >
                  Left
                </button>
                <button
                  type="button"
                  className="cs-btn cs-btn--sm"
                  onClick={() => onUpdate(alignCanvasObject(obj, page, "center-h"))}
                  title="Center horizontally on page"
                >
                  Center H
                </button>
                <button
                  type="button"
                  className="cs-btn cs-btn--sm"
                  onClick={() => onUpdate(alignCanvasObject(obj, page, "right"))}
                  title="Align to right edge of page"
                >
                  Right
                </button>
              </div>
              <div className="cs-row cs-row--compact" style={{ marginTop: "4px" }}>
                <button
                  type="button"
                  className="cs-btn cs-btn--sm"
                  onClick={() => onUpdate(alignCanvasObject(obj, page, "top"))}
                  title="Align to top edge of page"
                >
                  Top
                </button>
                <button
                  type="button"
                  className="cs-btn cs-btn--sm"
                  onClick={() => onUpdate(alignCanvasObject(obj, page, "center-v"))}
                  title="Center vertically on page"
                >
                  Center V
                </button>
                <button
                  type="button"
                  className="cs-btn cs-btn--sm"
                  onClick={() => onUpdate(alignCanvasObject(obj, page, "bottom"))}
                  title="Align to bottom edge of page"
                >
                  Bottom
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Text ── */}
      {obj.type === "text" && (
        <>
          <div className="cs-section">
            <div className="cs-field">
              <label>Content</label>
              <textarea
                ref={textareaRef}
                rows={4}
                value={obj.text || ""}
                onChange={(e) => onUpdate({ text: e.target.value }, key("text"))}
              />
            </div>

            <div className="cs-field">
              <label>Insert variable</label>
              <div className="cs-chips">
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className="cs-chip"
                    onClick={() => insertPlaceholder(`{{${p.key}}}`)}
                    title={`Inserts {{${p.key}}}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="cs-section">
            <div className="cs-section-title">Typography</div>
            <SelectField
              label="Font"
              value={obj.fontFamily || "Helvetica"}
              onChange={(v) => onUpdate({ fontFamily: v })}
              options={FONT_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
            />
            <div className="cs-row">
              <NumberField
                label="Size"
                suffix="pt"
                value={obj.fontSize || 14}
                min={4}
                max={200}
                onChange={(v) => onUpdate({ fontSize: v }, key("fontSize"))}
              />
              <SelectField
                label="Weight"
                value={obj.fontWeight || "normal"}
                onChange={(v) => onUpdate({ fontWeight: v })}
                options={[
                  { value: "normal", label: "Regular" },
                  { value: "bold", label: "Bold" },
                ]}
              />
            </div>
            <div className="cs-row">
              <NumberField
                label="Box width"
                suffix="pt"
                value={obj.width || 0}
                min={0}
                max={2400}
                onChange={(v) => onUpdate({ width: v }, key("width"))}
              />
              <NumberField
                label="Line height"
                value={obj.lineHeight ?? 1.25}
                min={0.8}
                max={3}
                step={0.05}
                onChange={(v) => onUpdate({ lineHeight: v }, key("lineHeight"))}
              />
            </div>
            <SegmentedField
              label="Alignment"
              value={obj.align || "left"}
              onChange={(v) => onUpdate({ align: v })}
              options={ALIGN_OPTIONS}
            />
            <ColorField
              label="Colour"
              value={obj.fill || "#000000"}
              onChange={(v) => onUpdate({ fill: v }, key("fill"))}
            />
            <div className="cs-row">
              <NumberField
                label="Rotation"
                suffix="°"
                value={obj.rotation || 0}
                min={-360}
                max={360}
                onChange={(v) => onUpdate({ rotation: v }, key("rotation"))}
              />
            </div>
          </div>
        </>
      )}

      {/* ── Image ── */}
      {obj.type === "image" && (
        <div className="cs-section">
          <div className="cs-section-title">Image</div>
          <div className="cs-row">
            <NumberField
              label="Width"
              suffix="pt"
              value={obj.width || 100}
              min={5}
              max={2400}
              onChange={(v) => {
                if (ratioLocked && obj.width) {
                  const ratio = (obj.height || 1) / obj.width;
                  onUpdate({ width: v, height: Math.round(v * ratio) }, key("size"));
                } else {
                  onUpdate({ width: v }, key("width"));
                }
              }}
            />
            <NumberField
              label="Height"
              suffix="pt"
              value={obj.height || 100}
              min={5}
              max={2400}
              onChange={(v) => {
                if (ratioLocked && obj.height) {
                  const ratio = (obj.width || 1) / obj.height;
                  onUpdate({ height: v, width: Math.round(v * ratio) }, key("size"));
                } else {
                  onUpdate({ height: v }, key("height"));
                }
              }}
            />
          </div>

          <button
            type="button"
            className={`cs-btn${ratioLocked ? " cs-btn--active" : ""}`}
            onClick={() => setRatioLocked((v) => !v)}
            aria-pressed={ratioLocked}
          >
            {ratioLocked ? "Aspect ratio locked" : "Aspect ratio free"}
          </button>

          <RangeField
            label="Opacity"
            value={obj.opacity !== undefined ? obj.opacity : 1}
            min={0.05}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdate({ opacity: v }, key("opacity"))}
          />

          <NumberField
            label="Rotation"
            suffix="°"
            value={obj.rotation || 0}
            min={-360}
            max={360}
            onChange={(v) => onUpdate({ rotation: v }, key("rotation"))}
          />

          <button type="button" className="cs-btn" onClick={() => onReplaceImage(obj.id)}>
            <ImageIcon size={14} />
            Replace image
          </button>
        </div>
      )}

      {/* ── QR ── */}
      {obj.type === "qr" && (
        <div className="cs-section">
          <div className="cs-section-title">QR code</div>
          <div className="cs-field">
            <label>Encoded text or URL</label>
            <input
              type="text"
              value={obj.text || ""}
              onChange={(e) => onUpdate({ text: e.target.value }, key("text"))}
            />
          </div>
          <div className="cs-field">
            <label>Insert variable</label>
            <div className="cs-chips">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="cs-chip"
                  onClick={() =>
                    onUpdate({ text: `${obj.text || ""}{{${p.key}}}` }, key("text"))
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <NumberField
            label="Size"
            suffix="pt"
            value={obj.size || 80}
            min={20}
            max={600}
            onChange={(v) => onUpdate({ size: v }, key("size"))}
          />
          <div className="cs-row">
            <ColorField
              label="Foreground"
              value={obj.fill || "#000000"}
              onChange={(v) => onUpdate({ fill: v }, key("fill"))}
            />
            <ColorField
              label="Background"
              value={obj.bgColor || "#ffffff"}
              fallback="#ffffff"
              onChange={(v) => onUpdate({ bgColor: v }, key("bgColor"))}
            />
          </div>
        </div>
      )}

      {/* ── Shape ── */}
      {obj.type === "shape" && (
        <div className="cs-section">
          <div className="cs-section-title">Shape</div>
          <SelectField
            label="Type"
            value={obj.shapeType || "rect"}
            onChange={(v) => onUpdate({ shapeType: v })}
            options={Object.entries(SHAPE_KIND_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />

          {obj.shapeType === "border" ? (
            <>
              {/* These two drive every preset's frame but had no UI at all. */}
              <SelectField
                label="Border style"
                value={obj.borderStyle || "double"}
                onChange={(v) => onUpdate({ borderStyle: v })}
                options={[
                  { value: "single", label: "Single line" },
                  { value: "double", label: "Double line" },
                ]}
              />
              <NumberField
                label="Inset from page edge"
                suffix="pt"
                value={obj.margin || 20}
                min={0}
                max={200}
                onChange={(v) => onUpdate({ margin: v }, key("margin"))}
              />
            </>
          ) : (
            <div className="cs-row">
              <NumberField
                label="Width"
                suffix="pt"
                value={obj.width || 100}
                min={1}
                max={2400}
                onChange={(v) => onUpdate({ width: v }, key("width"))}
              />
              <NumberField
                label="Height"
                suffix="pt"
                value={obj.height || 100}
                min={obj.shapeType === "line" ? -2400 : 1}
                max={2400}
                onChange={(v) => onUpdate({ height: v }, key("height"))}
              />
            </div>
          )}

          {obj.shapeType !== "line" && (
            <ColorField
              label="Fill"
              value={obj.fill || ""}
              allowEmpty
              onChange={(v) => onUpdate({ fill: v }, key("fill"))}
            />
          )}
          <ColorField
            label="Stroke"
            value={obj.stroke || ""}
            allowEmpty
            onChange={(v) => onUpdate({ stroke: v }, key("stroke"))}
          />
          <NumberField
            label="Stroke width"
            suffix="pt"
            value={obj.strokeWidth ?? 1}
            min={0}
            max={40}
            onChange={(v) => onUpdate({ strokeWidth: v }, key("strokeWidth"))}
          />
        </div>
      )}

      {/* ── Table ── */}
      {obj.type === "table" && <TableProperties obj={obj} onUpdate={onUpdate} keyFor={key} />}
    </>
  );
}

/* ── Table editor ─────────────────────────────────────────────────────────── */

function TableProperties({ obj, onUpdate, keyFor }) {
  const headers = obj.headers || [];
  const rows = obj.rows || [];

  const setHeader = (idx, value) => {
    const next = [...headers];
    next[idx] = value;
    onUpdate({ headers: next }, keyFor(`h${idx}`));
  };

  const addColumn = () => {
    onUpdate({
      headers: [...headers, `Col ${headers.length + 1}`],
      rows: rows.map((r) => [...r, ""]),
    });
  };

  const removeColumn = (idx) => {
    onUpdate({
      headers: headers.filter((_, i) => i !== idx),
      rows: rows.map((r) => r.filter((_, i) => i !== idx)),
    });
  };

  const addRow = () => {
    onUpdate({ rows: [...rows, new Array(headers.length || 2).fill("")] });
  };

  const removeRow = (idx) => {
    onUpdate({ rows: rows.filter((_, i) => i !== idx) });
  };

  const setCell = (rIdx, cIdx, value) => {
    onUpdate(
      {
        rows: rows.map((r, i) =>
          i === rIdx ? r.map((c, j) => (j === cIdx ? value : c)) : r,
        ),
      },
      keyFor(`r${rIdx}c${cIdx}`),
    );
  };

  return (
    <>
      <div className="cs-section">
        <div className="cs-section-title">Table style</div>
        <div className="cs-row">
          <NumberField
            label="Width"
            suffix="pt"
            value={obj.width || 475}
            min={40}
            max={2400}
            onChange={(v) => onUpdate({ width: v }, keyFor("width"))}
          />
          <NumberField
            label="Font size"
            suffix="pt"
            value={obj.fontSize || 11}
            min={4}
            max={48}
            onChange={(v) => onUpdate({ fontSize: v }, keyFor("fontSize"))}
          />
        </div>
        <NumberField
          label="Cell padding"
          suffix="pt"
          value={obj.cellPadding ?? 8}
          min={0}
          max={40}
          onChange={(v) => onUpdate({ cellPadding: v }, keyFor("cellPadding"))}
        />
        <div className="cs-row">
          <ColorField
            label="Header fill"
            value={obj.headerBg || "#ffffff"}
            fallback="#ffffff"
            onChange={(v) => onUpdate({ headerBg: v }, keyFor("headerBg"))}
          />
          <ColorField
            label="Borders"
            value={obj.borderColor || "#000000"}
            fallback="#000000"
            onChange={(v) => onUpdate({ borderColor: v }, keyFor("borderColor"))}
          />
        </div>
      </div>

      <div className="cs-section">
        <div className="cs-section-title">
          <span>Columns ({headers.length})</span>
          <button type="button" className="cs-icon-btn" onClick={addColumn} title="Add column">
            <Plus size={14} />
          </button>
        </div>
        <div className="cs-table-grid">
          {headers.map((head, idx) => (
            <div className="cs-table-line" key={idx}>
              <span className="cs-table-tag">C{idx + 1}</span>
              <input
                type="text"
                value={head}
                onChange={(e) => setHeader(idx, e.target.value)}
                aria-label={`Column ${idx + 1} heading`}
              />
              {headers.length > 1 && (
                <button
                  type="button"
                  className="cs-icon-btn cs-icon-btn--danger"
                  onClick={() => removeColumn(idx)}
                  title="Remove column"
                  aria-label={`Remove column ${idx + 1}`}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="cs-section">
        <div className="cs-section-title">
          <span>Rows ({rows.length})</span>
          <button type="button" className="cs-icon-btn" onClick={addRow} title="Add row">
            <Plus size={14} />
          </button>
        </div>

        {rows.map((row, rIdx) => (
          <div className="cs-table-card" key={rIdx}>
            <div className="cs-table-card-head">
              <span>Row {rIdx + 1}</span>
              <button
                type="button"
                className="cs-icon-btn cs-icon-btn--danger"
                onClick={() => removeRow(rIdx)}
                title="Remove row"
                aria-label={`Remove row ${rIdx + 1}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="cs-table-grid">
              {row.map((cell, cIdx) => (
                <div className="cs-table-line" key={cIdx}>
                  <span className="cs-table-tag">C{cIdx + 1}</span>
                  <input
                    type="text"
                    value={cell || ""}
                    onChange={(e) => setCell(rIdx, cIdx, e.target.value)}
                    aria-label={`${headers[cIdx] || `Column ${cIdx + 1}`}, row ${rIdx + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Inspector shell ──────────────────────────────────────────────────────── */

export default function PropertyInspector({
  scene,
  selectedObject,
  selectedId,
  onSelectId,
  onUpdateSelected,
  onUpdateObject,
  onUpdatePage,
  onUpdateMergeData,
  onResetMergeData,
  onReorder,
  onReplaceImage,
  sceneByteSize,
  activeTab,
  onChangeTab,
}) {
  const tabs = [
    { id: "design", label: "Design", Icon: SlidersHorizontal },
    { id: "data", label: "Data", Icon: Database },
    { id: "layers", label: "Layers", Icon: Layers },
  ];

  return (
    <aside className="cs-inspector">
      <div className="cs-tabs" role="tablist">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`cs-tab${activeTab === id ? " cs-tab--active" : ""}`}
            onClick={() => onChangeTab(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="cs-tab-body">
        {activeTab === "design" &&
          (selectedObject ? (
            <ObjectProperties
              obj={selectedObject}
              onUpdate={onUpdateSelected}
              onReplaceImage={onReplaceImage}
              page={scene.page}
            />
          ) : (
            <PageSettings
              page={scene.page}
              onUpdatePage={onUpdatePage}
              sceneByteSize={sceneByteSize}
            />
          ))}

        {/* Always reachable — the old panel hid merge data behind "deselect
            everything first", which meant losing your place to change a name. */}
        {activeTab === "data" && (
          <div className="cs-section">
            <div className="cs-section-title">
              <span>Variables</span>
              <button
                type="button"
                className="cs-icon-btn"
                onClick={onResetMergeData}
                title="Fill from project metadata"
                aria-label="Fill from project metadata"
              >
                <RotateCcw size={13} />
              </button>
            </div>
            <div className="cs-hint">
              These values fill <code>{"{{tags}}"}</code> in the preview and the exported PDF.
            </div>
            {PLACEHOLDERS.map((p) => (
              <div className="cs-field" key={p.key}>
                <label htmlFor={`merge-${p.key}`}>{p.label}</label>
                <input
                  id={`merge-${p.key}`}
                  type="text"
                  value={scene.mergeData?.[p.key] ?? ""}
                  placeholder={p.sample}
                  onChange={(e) => onUpdateMergeData(p.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === "layers" && (
          <LayersPanel
            objects={scene.objects}
            selectedId={selectedId}
            onSelect={onSelectId}
            onToggleHidden={(id, hidden) => onUpdateObject(id, { hidden })}
            onToggleLocked={(id, locked) => onUpdateObject(id, { locked })}
            onReorder={onReorder}
          />
        )}
      </div>
    </aside>
  );
}
