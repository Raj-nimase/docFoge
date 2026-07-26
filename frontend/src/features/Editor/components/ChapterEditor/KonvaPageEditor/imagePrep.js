/**
 * Downscale and re-encode user-picked images before they enter the scene.
 *
 * Scene JSON is serialised into localStorage on every edit, and a raw phone
 * photo is 3-5 MB of base64 — two of those and the whole project fails to
 * save. The store already carries a migration that strips base64 out of Tiptap
 * docs for this exact reason; scene JSON isn't covered by it, so we shrink at
 * the door instead.
 *
 * NOTE: this bounds per-image cost but not total scene size. The real fix is
 * holding image bytes in IndexedDB with the scene storing only keys — a larger
 * change, deliberately out of scope here.
 */

/** Longest edge, in px, that a stored image is allowed to have. */
const MAX_EDGE = 1400;

/** JPEG quality used when re-encoding opaque images. */
const JPEG_QUALITY = 0.85;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file isn't a readable image."));
    img.src = src;
  });
}

/**
 * @returns {Promise<{src: string, width: number, height: number}>}
 *   A data URL plus the natural aspect ratio, so the caller can size the object
 *   correctly instead of forcing it into a square.
 */
export async function prepareImageFile(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const rawUrl = await readAsDataUrl(file);
  const img = await loadImage(rawUrl);

  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  if (!naturalW || !naturalH) throw new Error("That image has no readable dimensions.");

  const scale = Math.min(1, MAX_EDGE / Math.max(naturalW, naturalH));
  const targetW = Math.max(1, Math.round(naturalW * scale));
  const targetH = Math.max(1, Math.round(naturalH * scale));

  // PNG and SVG may carry transparency that JPEG would flatten to black.
  const keepAlpha = file.type === "image/png" || file.type === "image/svg+xml";

  // Already small and in a format the PDF exporter embeds directly.
  const exporterSupported = file.type === "image/png" || file.type === "image/jpeg";
  if (scale === 1 && exporterSupported && rawUrl.length < 400_000) {
    return { src: rawUrl, width: naturalW, height: naturalH };
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { src: rawUrl, width: naturalW, height: naturalH };

  if (!keepAlpha) {
    // JPEG has no alpha; without this, any transparent source turns black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const src = keepAlpha
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", JPEG_QUALITY);

  return { src, width: naturalW, height: naturalH };
}

/** Human-readable byte count for the storage indicator. */
export function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
