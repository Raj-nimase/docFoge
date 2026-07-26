/**
 * Font + metric constants shared by the on-screen Konva canvas and the
 * pdf-lib exporter.
 *
 * These two renderers must agree or the preview lies about the PDF. Keeping
 * the mapping in one place is what stops them drifting apart: the canvas
 * resolves a family to a CSS stack, the exporter resolves the same family to
 * a StandardFont, and both read DEFAULT_LINE_HEIGHT from here.
 */

/** Multiplier applied to fontSize to get line spacing. */
export const DEFAULT_LINE_HEIGHT = 1.25;

/**
 * The only families we offer, because these are the ones pdf-lib can embed
 * without shipping a font file. `value` is what gets stored on the object.
 */
export const FONT_OPTIONS = [
  {
    value: "Helvetica",
    label: "Helvetica · Sans",
    stack: "Helvetica, Arial, 'Helvetica Neue', sans-serif",
  },
  {
    value: "Times-Roman",
    label: "Times Roman · Serif",
    stack: "'Times New Roman', Times, serif",
  },
  {
    value: "Courier",
    label: "Courier · Mono",
    stack: "'Courier New', Courier, monospace",
  },
];

const STACK_BY_VALUE = new Map(FONT_OPTIONS.map((f) => [f.value, f.stack]));

/**
 * Classify a stored fontFamily into one of our three families.
 *
 * Order matters: "sans-serif" contains "serif", so sans has to be ruled out
 * before the serif test runs.
 */
export function classifyFontFamily(family) {
  if (!family) return "Helvetica";
  if (STACK_BY_VALUE.has(family)) return family;

  const lower = String(family).toLowerCase();
  if (lower.includes("sans")) return "Helvetica";
  if (lower.includes("courier") || lower.includes("mono")) return "Courier";
  if (lower.includes("times") || lower.includes("serif")) return "Times-Roman";
  return "Helvetica";
}

/**
 * Stored fontFamily -> CSS font stack for Konva.
 *
 * Without this the canvas gets handed "Times-Roman", which no browser has, and
 * silently falls back to sans while the PDF renders true Times.
 */
export function resolveCanvasFont(family) {
  return STACK_BY_VALUE.get(classifyFontFamily(family));
}

export function isBoldWeight(fontWeight) {
  return fontWeight === "bold" || fontWeight === "700" || fontWeight === 700;
}
