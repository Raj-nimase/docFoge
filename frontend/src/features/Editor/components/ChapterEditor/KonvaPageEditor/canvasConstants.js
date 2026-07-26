/**
 * Editor-side constants for the certificate canvas: page presets, the merge
 * placeholder registry, and the factory for newly inserted objects.
 *
 * Render-critical font metrics live in @/utils/sceneFonts because the PDF
 * exporter needs them too.
 */

export const PAGE_PRESETS = [
  { id: "a4-portrait", label: "A4 Portrait", width: 595, height: 842 },
  { id: "a4-landscape", label: "A4 Landscape", width: 842, height: 595 },
  { id: "letter-portrait", label: "Letter Portrait", width: 612, height: 792 },
  { id: "letter-landscape", label: "Letter Landscape", width: 792, height: 612 },
  { id: "id-card", label: "ID Card", width: 420, height: 260 },
];

export function matchPagePreset(width, height) {
  return PAGE_PRESETS.find((p) => p.width === width && p.height === height) || null;
}

/**
 * Merge variables offered in the Data tab and the placeholder picker.
 *
 * `label` is what the user sees — the raw keys (student_name) are an
 * implementation detail of the {{tag}} syntax, not something to make people read.
 */
export const PLACEHOLDERS = [
  { key: "student_name", label: "Student Name", sample: "Alexander Wright" },
  { key: "college_name", label: "College Name", sample: "GOVERNMENT ENGINEERING COLLEGE" },
  { key: "department_name", label: "Department", sample: "COMPUTER SCIENCE & ENGINEERING" },
  { key: "roll_number", label: "Roll Number", sample: "2025-CS-101" },
  { key: "project_title", label: "Project Title", sample: "AI POWERED DOCUMENT FORGE SYSTEM" },
  { key: "academic_year", label: "Academic Year", sample: "2025 - 2026" },
  { key: "percentage", label: "Percentage", sample: "94.5" },
  { key: "grade", label: "Grade", sample: "A+" },
];

export const DEFAULT_MERGE_DATA = Object.fromEntries(
  PLACEHOLDERS.map((p) => [p.key, p.sample]),
);

export const OBJECT_TYPE_LABELS = {
  text: "Text",
  image: "Image",
  qr: "QR Code",
  table: "Table",
  shape: "Shape",
};

export const SHAPE_KIND_LABELS = {
  rect: "Rectangle",
  circle: "Circle",
  line: "Line",
  border: "Document Border",
};

/** Zoom bounds. The old 0.4–1.8 range made A4 detail work impossible. */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3];

/** Distance in screen px within which a dragged edge snaps to a guide. */
export const SNAP_THRESHOLD = 6;

/** Safe-area inset drawn as a guide and used for snapping. */
export const PAGE_MARGIN = 40;

/**
 * Human-readable name for an object, for the layers list.
 * Falls back to a trimmed preview of the object's own content.
 */
export function describeObject(obj) {
  if (!obj) return "Object";
  if (obj.name) return obj.name;

  if (obj.type === "text") {
    const flat = String(obj.text || "").replace(/\s+/g, " ").trim();
    if (!flat) return "Empty text";
    return flat.length > 28 ? `${flat.slice(0, 28)}…` : flat;
  }
  if (obj.type === "shape") return SHAPE_KIND_LABELS[obj.shapeType || "rect"] || "Shape";
  if (obj.type === "qr") return "QR Code";
  if (obj.type === "table") {
    const cols = (obj.headers || []).length;
    const rows = (obj.rows || []).length;
    return `Table ${cols}×${rows}`;
  }
  if (obj.type === "image") return "Image";
  return OBJECT_TYPE_LABELS[obj.type] || "Object";
}

let cascadeIndex = 0;

function nextId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Offset each insertion so consecutive additions don't stack invisibly on top
 * of each other. Wraps after 8 so objects stay on-page.
 */
function cascade(base) {
  const step = cascadeIndex % 8;
  cascadeIndex += 1;
  return { x: base.x + step * 16, y: base.y + step * 16 };
}

/**
 * Build a new scene object of the given type, centred-ish on the page.
 */
export function createObject(type, opts = {}) {
  const { page = { width: 595, height: 842 }, shapeType = "rect", src } = opts;

  switch (type) {
    case "text": {
      const width = Math.min(280, page.width - 80);
      return {
        id: nextId("text"),
        type: "text",
        ...cascade({ x: Math.round((page.width - width) / 2), y: 120 }),
        width,
        text: "Double-click to edit",
        fontFamily: "Helvetica",
        fontSize: 18,
        fontWeight: "bold",
        fill: "#111827",
        align: "center",
        lineHeight: 1.25,
        opacity: 1,
      };
    }

    case "image":
      return {
        id: nextId("img"),
        type: "image",
        ...cascade({ x: Math.round(page.width / 2 - 60), y: 150 }),
        width: 120,
        height: 120,
        src,
        opacity: 1,
      };

    case "qr":
      return {
        id: nextId("qr"),
        type: "qr",
        ...cascade({ x: 60, y: page.height - 150 }),
        size: 80,
        text: "https://verify.edu/cert/{{roll_number}}",
        fill: "#000000",
        bgColor: "#ffffff",
      };

    case "table": {
      const width = Math.min(475, page.width - 80);
      return {
        id: nextId("table"),
        type: "table",
        ...cascade({ x: Math.round((page.width - width) / 2), y: 300 }),
        width,
        headers: ["Subject", "Credits", "Grade"],
        rows: [
          ["Software Engineering", "4", "A+"],
          ["Database Systems", "4", "O"],
        ],
        headerBg: "#eff6ff",
        borderColor: "#93c5fd",
        fontSize: 11,
        cellPadding: 8,
      };
    }

    case "shape": {
      if (shapeType === "border") {
        return {
          id: nextId("border"),
          type: "shape",
          shapeType: "border",
          borderStyle: "double",
          stroke: "#1e3a8a",
          strokeWidth: 2,
          margin: 24,
          x: 0,
          y: 0,
          width: page.width,
          height: page.height,
        };
      }
      if (shapeType === "line") {
        const width = Math.min(320, page.width - 80);
        return {
          id: nextId("line"),
          type: "shape",
          shapeType: "line",
          ...cascade({ x: Math.round((page.width - width) / 2), y: 200 }),
          width,
          height: 0,
          fill: "",
          stroke: "#334155",
          strokeWidth: 2,
        };
      }
      return {
        id: nextId("shape"),
        type: "shape",
        shapeType,
        ...cascade({ x: Math.round(page.width / 2 - 75), y: 180 }),
        width: 150,
        height: 100,
        fill: "#e0f2fe",
        stroke: "#0284c7",
        strokeWidth: 2,
        opacity: 1,
      };
    }

    default:
      return null;
  }
}

/** Deep-ish clone of an object with a fresh id, offset so the copy is visible. */
export function duplicateObject(obj, offset = 12) {
  return {
    ...JSON.parse(JSON.stringify(obj)),
    id: nextId(obj.type || "obj"),
    x: (obj.x || 0) + offset,
    y: (obj.y || 0) + offset,
  };
}
