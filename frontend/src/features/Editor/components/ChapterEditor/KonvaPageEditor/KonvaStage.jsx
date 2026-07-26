import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Text as KonvaText,
  Image as KonvaImage,
  Group,
  Line,
  Ellipse,
  Transformer,
} from "react-konva";
import QRCode from "qrcode";
import { replacePlaceholders } from "@/utils/pdfVectorRenderer";
import { resolveCanvasFont, DEFAULT_LINE_HEIGHT } from "@/utils/sceneFonts";
import { SNAP_THRESHOLD, PAGE_MARGIN } from "./canvasConstants";

/* ── Image node ───────────────────────────────────────────────────────────
   Registers its node with the shared ref registry so the Transformer can
   actually attach to it. Previously it kept a private ref, which meant images
   could be selected but never showed resize handles.                        */

function ImageItem({ shapeProps, registerNode, onSelect, onDragMove, onChange, listening }) {
  const [image, setImage] = useState(null);
  const nodeRef = useRef(null);

  useEffect(() => {
    if (!shapeProps.src) {
      setImage(null);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.src = shapeProps.src;
    return () => {
      cancelled = true;
    };
  }, [shapeProps.src]);

  const attach = useCallback(
    (node) => {
      nodeRef.current = node;
      registerNode(shapeProps.id, node);
    },
    [registerNode, shapeProps.id],
  );

  return (
    <KonvaImage
      ref={attach}
      image={image}
      x={shapeProps.x}
      y={shapeProps.y}
      width={shapeProps.width}
      height={shapeProps.height}
      rotation={shapeProps.rotation || 0}
      opacity={shapeProps.opacity !== undefined ? shapeProps.opacity : 1}
      draggable={listening}
      listening={listening}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={(e) =>
        onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) })
      }
      onTransformEnd={() => {
        const node = nodeRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: Math.max(10, Math.round(node.width() * scaleX)),
          height: Math.max(10, Math.round(node.height() * scaleY)),
          rotation: Math.round(node.rotation()),
        });
      }}
    />
  );
}

/* ── QR node ──────────────────────────────────────────────────────────────
   Same fix as images. Also honours fill/bgColor, which the PDF exporter has
   always read but no UI could set.                                          */

function QrItem({ shapeProps, registerNode, onSelect, onDragMove, onChange, mergeData, listening }) {
  const [qrImg, setQrImg] = useState(null);
  const nodeRef = useRef(null);

  const rawText = replacePlaceholders(shapeProps.text || "https://docforge.app", mergeData);
  const dark = shapeProps.fill || "#000000";
  const light = shapeProps.bgColor || "#ffffff";

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(rawText || " ", { margin: 1, color: { dark, light } })
      .then((url) => {
        const img = new window.Image();
        img.onload = () => {
          if (!cancelled) setQrImg(img);
        };
        img.src = url;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rawText, dark, light]);

  const attach = useCallback(
    (node) => {
      nodeRef.current = node;
      registerNode(shapeProps.id, node);
    },
    [registerNode, shapeProps.id],
  );

  const size = shapeProps.size || shapeProps.width || 80;

  return (
    <KonvaImage
      ref={attach}
      image={qrImg}
      x={shapeProps.x}
      y={shapeProps.y}
      width={size}
      height={size}
      draggable={listening}
      listening={listening}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={(e) =>
        onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) })
      }
      onTransformEnd={() => {
        const node = nodeRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          size: Math.max(20, Math.round(size * scaleX)),
        });
      }}
    />
  );
}

/* ── Table node ───────────────────────────────────────────────────────────
   Anchored at obj.x/obj.y with children at relative coordinates. The old
   version anchored the group at 0,0 and reset position after each drag, which
   left the Transformer box in the wrong place mid-drag.                      */

function TableItem({ shapeProps, registerNode, onSelect, onDragMove, onChange, mergeData, listening }) {
  const obj = shapeProps;
  const headers = obj.headers || [];
  const rows = obj.rows || [];
  const tableW = obj.width || 475;
  const headerBg = obj.headerBg || "#f3f4f6";
  const borderColor = obj.borderColor || "#d1d5db";
  const fontSize = obj.fontSize || 11;
  const cellPadding = obj.cellPadding || 8;
  const rowHeight = fontSize + cellPadding * 2;
  const numCols = Math.max(headers.length, rows[0]?.length || 1);
  const colWidth = tableW / numCols;

  const attach = useCallback((node) => registerNode(obj.id, node), [registerNode, obj.id]);

  // Cells get an explicit width + ellipsis so text clips at the column edge,
  // matching where the PDF exporter truncates it.
  const cellWidth = Math.max(4, colWidth - cellPadding * 2);

  return (
    <Group
      ref={attach}
      x={obj.x}
      y={obj.y}
      draggable={listening}
      listening={listening}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={(e) =>
        onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) })
      }
    >
      {headers.length > 0 && (
        <Group y={0}>
          <Rect
            width={tableW}
            height={rowHeight}
            fill={headerBg}
            stroke={borderColor}
            strokeWidth={1}
          />
          {headers.map((h, cIdx) => (
            <React.Fragment key={cIdx}>
              <KonvaText
                x={cIdx * colWidth + cellPadding}
                y={cellPadding}
                width={cellWidth}
                text={replacePlaceholders(String(h || ""), mergeData)}
                fontSize={fontSize}
                fontStyle="bold"
                fill="#111827"
                ellipsis
                wrap="none"
                listening={false}
              />
              {cIdx > 0 && (
                <Line
                  points={[cIdx * colWidth, 0, cIdx * colWidth, rowHeight]}
                  stroke={borderColor}
                  strokeWidth={1}
                  listening={false}
                />
              )}
            </React.Fragment>
          ))}
        </Group>
      )}

      {rows.map((row, rIdx) => {
        const rY = (headers.length > 0 ? rIdx + 1 : rIdx) * rowHeight;
        return (
          <Group key={rIdx} y={rY}>
            <Rect
              width={tableW}
              height={rowHeight}
              fill={rIdx % 2 === 1 ? "#f9fafb" : "#ffffff"}
              stroke={borderColor}
              strokeWidth={1}
            />
            {Array.from({ length: numCols }).map((_, cIdx) => (
              <React.Fragment key={cIdx}>
                <KonvaText
                  x={cIdx * colWidth + cellPadding}
                  y={cellPadding}
                  width={cellWidth}
                  text={replacePlaceholders(String(row[cIdx] || ""), mergeData)}
                  fontSize={fontSize}
                  fill="#374151"
                  ellipsis
                  wrap="none"
                  listening={false}
                />
                {cIdx > 0 && (
                  <Line
                    points={[cIdx * colWidth, 0, cIdx * colWidth, rowHeight]}
                    stroke={borderColor}
                    strokeWidth={1}
                    listening={false}
                  />
                )}
              </React.Fragment>
            ))}
          </Group>
        );
      })}
    </Group>
  );
}

/* ── Snap geometry ────────────────────────────────────────────────────────── */

/** Axis-aligned bounds of an object in page coordinates. */
function boundsOf(obj, pageW, pageH) {
  if (obj.type === "qr") {
    const s = obj.size || obj.width || 80;
    return { x: obj.x || 0, y: obj.y || 0, w: s, h: s };
  }
  if (obj.type === "table") {
    const rowH = (obj.fontSize || 11) + (obj.cellPadding || 8) * 2;
    const lines = (obj.headers?.length ? 1 : 0) + (obj.rows?.length || 0);
    return { x: obj.x || 0, y: obj.y || 0, w: obj.width || 475, h: rowH * lines };
  }
  if (obj.type === "shape" && obj.shapeType === "border") {
    return { x: 0, y: 0, w: pageW, h: pageH };
  }
  if (obj.type === "text") {
    const lineH = (obj.fontSize || 14) * (obj.lineHeight || DEFAULT_LINE_HEIGHT);
    const lineCount = String(obj.text || "").split("\n").length;
    return { x: obj.x || 0, y: obj.y || 0, w: obj.width || 0, h: lineH * lineCount };
  }
  return { x: obj.x || 0, y: obj.y || 0, w: obj.width || 0, h: obj.height || 0 };
}

/**
 * Candidate snap lines: page edges, page centre, the safe margin, and every
 * other object's edges and centres.
 */
function collectGuides(objects, excludeId, pageW, pageH) {
  const vertical = [0, PAGE_MARGIN, pageW / 2, pageW - PAGE_MARGIN, pageW];
  const horizontal = [0, PAGE_MARGIN, pageH / 2, pageH - PAGE_MARGIN, pageH];

  for (const o of objects) {
    if (o.id === excludeId || o.hidden) continue;
    if (o.type === "shape" && o.shapeType === "border") continue;
    const b = boundsOf(o, pageW, pageH);
    vertical.push(b.x, b.x + b.w / 2, b.x + b.w);
    horizontal.push(b.y, b.y + b.h / 2, b.y + b.h);
  }
  return { vertical, horizontal };
}

/**
 * Snap a dragged node's position to nearby guides.
 * Threshold is in screen px, so it stays a constant "feel" at any zoom.
 */
function computeSnap(box, guides, tolerance) {
  const edges = {
    v: [
      { at: box.x, offset: 0 },
      { at: box.x + box.w / 2, offset: box.w / 2 },
      { at: box.x + box.w, offset: box.w },
    ],
    h: [
      { at: box.y, offset: 0 },
      { at: box.y + box.h / 2, offset: box.h / 2 },
      { at: box.y + box.h, offset: box.h },
    ],
  };

  let bestV = null;
  let bestH = null;

  for (const edge of edges.v) {
    for (const g of guides.vertical) {
      const dist = Math.abs(g - edge.at);
      if (dist <= tolerance && (!bestV || dist < bestV.dist)) {
        bestV = { dist, line: g, x: g - edge.offset };
      }
    }
  }
  for (const edge of edges.h) {
    for (const g of guides.horizontal) {
      const dist = Math.abs(g - edge.at);
      if (dist <= tolerance && (!bestH || dist < bestH.dist)) {
        bestH = { dist, line: g, y: g - edge.offset };
      }
    }
  }

  return { v: bestV, h: bestH };
}

/* ── Stage ────────────────────────────────────────────────────────────────── */

export default function KonvaStage({
  scene,
  selectedId,
  onSelectId,
  onCommitObject,
  mergeData = {},
  zoom = 1,
  onZoomAt,
  editingId,
  onStartEditing,
  onFinishEditing,
}) {
  const trRef = useRef(null);
  const stageRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  /**
   * id -> Konva node. A registry keyed by id survives layer reordering; the
   * old single `selectedNodeRef` attached by sibling position and could end up
   * pointing at the wrong object after a reorder.
   */
  const nodeRegistry = useRef(new Map());
  const registerNode = useCallback((id, node) => {
    if (node) nodeRegistry.current.set(id, node);
    else nodeRegistry.current.delete(id);
  }, []);

  const [guides, setGuides] = useState({ v: null, h: null });
  const [isPanning, setIsPanning] = useState(false);
  const spaceHeld = useRef(false);

  const page = scene?.page || { width: 595, height: 842, bg: "#ffffff" };
  const pageW = page.width || 595;
  const pageH = page.height || 842;
  const objects = useMemo(() => scene?.objects || [], [scene]);

  const editingObject = useMemo(
    () => objects.find((o) => o.id === editingId) || null,
    [objects, editingId],
  );

  const selectedType = useMemo(
    () => objects.find((o) => o.id === selectedId)?.type || null,
    [objects, selectedId],
  );

  /* Attach the transformer to whichever node is selected. */
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;

    const node = selectedId && !editingId ? nodeRegistry.current.get(selectedId) : null;
    const selected = objects.find((o) => o.id === selectedId);

    // Borders span the whole page and locked objects shouldn't move — no handles.
    const transformable =
      node && selected && !selected.locked && !(selected.type === "shape" && selected.shapeType === "border");

    tr.nodes(transformable ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, objects, editingId]);

  /* Ctrl/Cmd + wheel zooms around the pointer; plain wheel scrolls. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      onZoomAt?.(e.deltaY < 0 ? 1.1 : 1 / 1.1, {
        clientX: e.clientX - rect.left + el.scrollLeft,
        clientY: e.clientY - rect.top + el.scrollTop,
        viewX: e.clientX - rect.left,
        viewY: e.clientY - rect.top,
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onZoomAt]);

  /* Space-to-pan. Ignored while a form field has focus so it doesn't eat spaces. */
  useEffect(() => {
    const isTyping = (el) =>
      el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

    const down = (e) => {
      if (e.code === "Space" && !isTyping(document.activeElement)) {
        spaceHeld.current = true;
        setIsPanning(true);
      }
    };
    const up = (e) => {
      if (e.code === "Space") {
        spaceHeld.current = false;
        setIsPanning(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* Drag-to-pan with space held or middle mouse button. */
  const panState = useRef(null);
  const [isPanDragging, setIsPanDragging] = useState(false);

  const handlePanStart = (e) => {
    const shouldPan = spaceHeld.current || e.button === 1;
    if (!shouldPan || !scrollRef.current) return;
    e.preventDefault();
    panState.current = {
      x: e.clientX,
      y: e.clientY,
      left: scrollRef.current.scrollLeft,
      top: scrollRef.current.scrollTop,
    };
    setIsPanDragging(true);
  };
  const handlePanMove = (e) => {
    const st = panState.current;
    if (!st || !scrollRef.current) return;
    scrollRef.current.scrollLeft = st.left - (e.clientX - st.x);
    scrollRef.current.scrollTop = st.top - (e.clientY - st.y);
  };
  const handlePanEnd = () => {
    panState.current = null;
    setIsPanDragging(false);
  };

  /* Deselect when clicking empty canvas or the page background. */
  const handleStageMouseDown = (e) => {
    if (spaceHeld.current) return;
    if (e.target === e.target.getStage() || e.target.name() === "page-bg") {
      onSelectId(null);
      onFinishEditing?.();
    }
  };

  /* Live snapping while dragging. */
  const handleDragMove = useCallback(
    (objId) => (e) => {
      const obj = objects.find((o) => o.id === objId);
      if (!obj) return;

      const node = e.target;
      const b = boundsOf(obj, pageW, pageH);
      const box = { x: node.x(), y: node.y(), w: b.w, h: b.h };
      const tolerance = SNAP_THRESHOLD / zoom;
      const snap = computeSnap(box, collectGuides(objects, objId, pageW, pageH), tolerance);

      if (snap.v) node.x(snap.v.x);
      if (snap.h) node.y(snap.h.y);
      setGuides({ v: snap.v?.line ?? null, h: snap.h?.line ?? null });
    },
    [objects, pageW, pageH, zoom],
  );

  const clearGuides = useCallback(() => setGuides({ v: null, h: null }), []);

  /* ── Inline text editing ──────────────────────────────────────────────── */

  const [draftText, setDraftText] = useState("");

  useEffect(() => {
    if (editingObject) {
      setDraftText(editingObject.text || "");
      // Wait for the overlay to mount before focusing it.
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.select();
        }
      });
    }
  }, [editingObject]);

  const commitDraft = useCallback(() => {
    if (editingObject && draftText !== editingObject.text) {
      onCommitObject(editingObject.id, { text: draftText });
    }
    onFinishEditing?.();
  }, [editingObject, draftText, onCommitObject, onFinishEditing]);

  const overlayStyle = useMemo(() => {
    if (!editingObject) return null;
    const fontSize = (editingObject.fontSize || 14) * zoom;
    const lineHeight = editingObject.lineHeight || DEFAULT_LINE_HEIGHT;
    const width = (editingObject.width || 200) * zoom;
    const lines = Math.max(1, String(draftText || "").split("\n").length);

    return {
      // Positioned against .cs-page-shadow, whose origin is the page's
      // top-left corner — so page coordinates only need the zoom factor.
      left: editingObject.x * zoom,
      top: editingObject.y * zoom,
      width,
      height: Math.max(fontSize * lineHeight * lines, fontSize * lineHeight) + 4,
      fontSize: `${fontSize}px`,
      fontFamily: resolveCanvasFont(editingObject.fontFamily),
      fontWeight: editingObject.fontWeight === "bold" ? 700 : 400,
      lineHeight,
      color: editingObject.fill || "#000000",
      textAlign: editingObject.align || "left",
    };
  }, [editingObject, zoom, draftText]);

  /* ── Render ───────────────────────────────────────────────────────────── */

  const stageW = Math.round(pageW * zoom);
  const stageH = Math.round(pageH * zoom);

  return (
    <div
      ref={scrollRef}
      className={`cs-canvas-wrap${isPanning ? " cs-canvas-wrap--panning" : ""}${
        isPanDragging ? " cs-canvas-wrap--panning-active" : ""
      }`}
      onMouseDown={handlePanStart}
      onMouseMove={handlePanMove}
      onMouseUp={handlePanEnd}
      onMouseLeave={handlePanEnd}
    >
      <div className="cs-canvas-inner">
        {/* The Stage itself is scaled, so the DOM element genuinely grows and
            the wrapper can scroll. A CSS transform left the container unaware
            the content had grown, clipping everything past the viewport. */}
        <div className="cs-page-shadow" style={{ width: stageW, height: stageH, position: "relative" }}>
          <Stage
            ref={stageRef}
            width={stageW}
            height={stageH}
            scaleX={zoom}
            scaleY={zoom}
            onMouseDown={handleStageMouseDown}
            onTouchStart={handleStageMouseDown}
          >
            <Layer>
              <Rect name="page-bg" x={0} y={0} width={pageW} height={pageH} fill={page.bg || "#ffffff"} />

              {objects.map((obj) => {
                if (obj.hidden) return null;

                const interactive = !obj.locked;
                const select = (e) => {
                  if (e?.cancelBubble !== undefined) e.cancelBubble = true;
                  if (!obj.locked) onSelectId(obj.id);
                };
                const patch = (props) => onCommitObject(obj.id, props);
                const dragMove = handleDragMove(obj.id);
                const dragEnd = (e) => {
                  clearGuides();
                  patch({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
                };

                if (obj.type === "text") {
                  // Hidden while its overlay editor is open, so the two don't
                  // double up on screen.
                  if (obj.id === editingId) return null;
                  return (
                    <KonvaText
                      key={obj.id}
                      ref={(node) => registerNode(obj.id, node)}
                      x={obj.x}
                      y={obj.y}
                      width={obj.width > 0 ? obj.width : undefined}
                      text={replacePlaceholders(obj.text || "", mergeData)}
                      fontSize={obj.fontSize || 14}
                      fontFamily={resolveCanvasFont(obj.fontFamily)}
                      fontStyle={obj.fontWeight === "bold" ? "bold" : "normal"}
                      lineHeight={obj.lineHeight || DEFAULT_LINE_HEIGHT}
                      fill={obj.fill || "#000000"}
                      align={obj.align || "left"}
                      rotation={obj.rotation || 0}
                      opacity={obj.opacity !== undefined ? obj.opacity : 1}
                      draggable={interactive}
                      listening={interactive}
                      onMouseDown={select}
                      onTap={select}
                      onDblClick={() => onStartEditing?.(obj.id)}
                      onDblTap={() => onStartEditing?.(obj.id)}
                      onDragMove={dragMove}
                      onDragEnd={dragEnd}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        const scaleX = node.scaleX();
                        node.scaleX(1);
                        node.scaleY(1);
                        // Width drives wrapping; height is derived from content,
                        // so only the horizontal scale is meaningful here.
                        patch({
                          x: Math.round(node.x()),
                          y: Math.round(node.y()),
                          width: Math.max(20, Math.round(node.width() * scaleX)),
                          rotation: Math.round(node.rotation()),
                        });
                      }}
                    />
                  );
                }

                if (obj.type === "image") {
                  return (
                    <ImageItem
                      key={obj.id}
                      shapeProps={obj}
                      registerNode={registerNode}
                      listening={interactive}
                      onSelect={select}
                      onDragMove={dragMove}
                      onChange={(props) => {
                        clearGuides();
                        patch(props);
                      }}
                    />
                  );
                }

                if (obj.type === "qr") {
                  return (
                    <QrItem
                      key={obj.id}
                      shapeProps={obj}
                      registerNode={registerNode}
                      listening={interactive}
                      mergeData={mergeData}
                      onSelect={select}
                      onDragMove={dragMove}
                      onChange={(props) => {
                        clearGuides();
                        patch(props);
                      }}
                    />
                  );
                }

                if (obj.type === "table") {
                  return (
                    <TableItem
                      key={obj.id}
                      shapeProps={obj}
                      registerNode={registerNode}
                      listening={interactive}
                      mergeData={mergeData}
                      onSelect={select}
                      onDragMove={dragMove}
                      onChange={(props) => {
                        clearGuides();
                        patch(props);
                      }}
                    />
                  );
                }

                if (obj.type === "shape") {
                  const kind = obj.shapeType || "rect";

                  if (kind === "rect") {
                    return (
                      <Rect
                        key={obj.id}
                        ref={(node) => registerNode(obj.id, node)}
                        x={obj.x}
                        y={obj.y}
                        width={obj.width}
                        height={obj.height}
                        fill={obj.fill || undefined}
                        stroke={obj.stroke || undefined}
                        strokeWidth={obj.stroke ? obj.strokeWidth || 1 : 0}
                        rotation={obj.rotation || 0}
                        opacity={obj.opacity !== undefined ? obj.opacity : 1}
                        draggable={interactive}
                        listening={interactive}
                        onMouseDown={select}
                        onTap={select}
                        onDragMove={dragMove}
                        onDragEnd={dragEnd}
                        onTransformEnd={(e) => {
                          const node = e.target;
                          const scaleX = node.scaleX();
                          const scaleY = node.scaleY();
                          node.scaleX(1);
                          node.scaleY(1);
                          patch({
                            x: Math.round(node.x()),
                            y: Math.round(node.y()),
                            width: Math.max(5, Math.round(node.width() * scaleX)),
                            height: Math.max(5, Math.round(node.height() * scaleY)),
                            rotation: Math.round(node.rotation()),
                          });
                        }}
                      />
                    );
                  }

                  if (kind === "circle") {
                    const rx = (obj.width || 0) / 2;
                    const ry = (obj.height || 0) / 2;
                    return (
                      <Ellipse
                        key={obj.id}
                        ref={(node) => registerNode(obj.id, node)}
                        x={obj.x + rx}
                        y={obj.y + ry}
                        radiusX={rx}
                        radiusY={ry}
                        fill={obj.fill || undefined}
                        stroke={obj.stroke || undefined}
                        strokeWidth={obj.stroke ? obj.strokeWidth || 1 : 0}
                        rotation={obj.rotation || 0}
                        opacity={obj.opacity !== undefined ? obj.opacity : 1}
                        draggable={interactive}
                        listening={interactive}
                        onMouseDown={select}
                        onTap={select}
                        onDragMove={(e) => {
                          // Ellipse x/y is its centre; snapping works in
                          // top-left space, so shift into and back out of it.
                          const node = e.target;
                          node.x(node.x() - rx);
                          node.y(node.y() - ry);
                          dragMove(e);
                          node.x(node.x() + rx);
                          node.y(node.y() + ry);
                        }}
                        onDragEnd={(e) => {
                          clearGuides();
                          patch({
                            x: Math.round(e.target.x() - rx),
                            y: Math.round(e.target.y() - ry),
                          });
                        }}
                        // The old implementation had no transform handler at
                        // all, so circles could never be resized.
                        onTransformEnd={(e) => {
                          const node = e.target;
                          const scaleX = node.scaleX();
                          const scaleY = node.scaleY();
                          node.scaleX(1);
                          node.scaleY(1);
                          const newW = Math.max(5, Math.round(rx * 2 * scaleX));
                          const newH = Math.max(5, Math.round(ry * 2 * scaleY));
                          patch({
                            x: Math.round(node.x() - newW / 2),
                            y: Math.round(node.y() - newH / 2),
                            width: newW,
                            height: newH,
                            rotation: Math.round(node.rotation()),
                          });
                        }}
                      />
                    );
                  }

                  if (kind === "line") {
                    return (
                      <Line
                        key={obj.id}
                        ref={(node) => registerNode(obj.id, node)}
                        x={obj.x}
                        y={obj.y}
                        points={[0, 0, obj.width || 100, obj.height || 0]}
                        stroke={obj.stroke || "#334155"}
                        strokeWidth={obj.strokeWidth || 2}
                        hitStrokeWidth={12}
                        rotation={obj.rotation || 0}
                        draggable={interactive}
                        listening={interactive}
                        onMouseDown={select}
                        onTap={select}
                        onDragMove={dragMove}
                        onDragEnd={dragEnd}
                        onTransformEnd={(e) => {
                          const node = e.target;
                          const scaleX = node.scaleX();
                          const scaleY = node.scaleY();
                          node.scaleX(1);
                          node.scaleY(1);
                          patch({
                            x: Math.round(node.x()),
                            y: Math.round(node.y()),
                            width: Math.max(5, Math.round((obj.width || 100) * scaleX)),
                            height: Math.round((obj.height || 0) * scaleY),
                            rotation: Math.round(node.rotation()),
                          });
                        }}
                      />
                    );
                  }

                  if (kind === "border") {
                    const margin = obj.margin || 20;
                    const color = obj.stroke || "#1e3a8a";
                    const strokeWidth = obj.strokeWidth || 2;
                    return (
                      <Group
                        key={obj.id}
                        ref={(node) => registerNode(obj.id, node)}
                        listening={interactive}
                        onMouseDown={select}
                        onTap={select}
                      >
                        <Rect
                          x={margin}
                          y={margin}
                          width={pageW - margin * 2}
                          height={pageH - margin * 2}
                          stroke={color}
                          strokeWidth={strokeWidth}
                        />
                        {obj.borderStyle === "double" && (
                          <Rect
                            x={margin + 5}
                            y={margin + 5}
                            width={pageW - (margin + 5) * 2}
                            height={pageH - (margin + 5) * 2}
                            stroke={color}
                            strokeWidth={1}
                          />
                        )}
                      </Group>
                    );
                  }
                }

                return null;
              })}

              {/* Snap guides */}
              {guides.v !== null && (
                <Line
                  points={[guides.v, 0, guides.v, pageH]}
                  stroke="#e11d8f"
                  strokeWidth={1 / zoom}
                  dash={[4 / zoom, 4 / zoom]}
                  listening={false}
                />
              )}
              {guides.h !== null && (
                <Line
                  points={[0, guides.h, pageW, guides.h]}
                  stroke="#e11d8f"
                  strokeWidth={1 / zoom}
                  dash={[4 / zoom, 4 / zoom]}
                  listening={false}
                />
              )}

              <Transformer
                ref={trRef}
                rotateEnabled
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                anchorSize={8}
                anchorCornerRadius={2}
                borderStroke="#2563eb"
                anchorStroke="#2563eb"
                anchorFill="#ffffff"
                // Text height follows its content, and QR codes must stay
                // square, so each gets only the handles that mean something.
                // The full-list default is spelled out because react-konva
                // won't reliably restore it when a prop reverts to undefined.
                enabledAnchors={
                  selectedType === "text"
                    ? ["middle-left", "middle-right"]
                    : selectedType === "qr"
                      ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                      : [
                          "top-left",
                          "top-center",
                          "top-right",
                          "middle-left",
                          "middle-right",
                          "bottom-left",
                          "bottom-center",
                          "bottom-right",
                        ]
                }
                keepRatio={selectedType === "qr"}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 10 || newBox.height < 10 ? oldBox : newBox
                }
              />
            </Layer>
          </Stage>

          {/* Inline text editor overlay */}
          {editingObject && overlayStyle && (
            <textarea
              ref={textareaRef}
              className="cs-text-overlay"
              style={overlayStyle}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") {
                  e.preventDefault();
                  onFinishEditing?.();
                } else if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitDraft();
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
