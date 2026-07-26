import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import QRCode from "qrcode";
import { DEFAULT_LINE_HEIGHT, classifyFontFamily, isBoldWeight } from "./sceneFonts";

/**
 * Convert Hex Color String (e.g. "#1e3a8a" or "#f00") to pdf-lib rgb object
 */
function hexToPdfRgb(hexStr, defaultRgb = rgb(0, 0, 0)) {
  if (!hexStr || typeof hexStr !== "string") return defaultRgb;
  let hex = hexStr.trim().replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return defaultRgb;
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return defaultRgb;
  return rgb(r, g, b);
}

/**
 * Helper to replace {{placeholder}} tags with key-value data
 */
export function replacePlaceholders(text, data = {}) {
  if (typeof text !== "string") return "";
  return text.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (match, p1) => {
    return data[p1] !== undefined ? data[p1] : match;
  });
}

/**
 * Break a single token that is wider than the box.
 * Without this a long unbroken string (a URL, a run-on title) overflows the
 * text box instead of wrapping.
 */
function breakLongWord(word, font, fontSize, maxWidth) {
  const pieces = [];
  let chunk = "";

  for (const char of word) {
    const test = chunk + char;
    if (chunk && font.widthOfTextAtSize(test, fontSize) > maxWidth) {
      pieces.push(chunk);
      chunk = char;
    } else {
      chunk = test;
    }
  }
  if (chunk) pieces.push(chunk);
  return pieces;
}

function wrapText(text, font, fontSize, maxWidth) {
  if (!text) return [];
  if (!maxWidth || maxWidth <= 0) return text.split("\n");

  const paragraphs = text.split("\n");
  const wrappedLines = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      wrappedLines.push("");
      continue;
    }

    const words = paragraph.split(" ");
    let currentLine = "";

    for (const word of words) {
      // A word that can't fit on a line of its own has to be split by
      // character, or it would run past the edge of its box.
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        if (currentLine) wrappedLines.push(currentLine);
        const pieces = breakLongWord(word, font, fontSize, maxWidth);
        wrappedLines.push(...pieces.slice(0, -1));
        currentLine = pieces[pieces.length - 1] || "";
        continue;
      }

      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth <= maxWidth || !currentLine) {
        currentLine = testLine;
      } else {
        wrappedLines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      wrappedLines.push(currentLine);
    }
  }

  return wrappedLines;
}

/**
 * Truncate to fit a width, appending an ellipsis.
 * Mirrors the Konva table cells' `ellipsis` behaviour so a long cell value
 * clips in the same place on canvas and in the PDF.
 */
function truncateToWidth(text, font, fontSize, maxWidth) {
  if (!text || maxWidth <= 0) return "";
  if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) return text;

  const ellipsis = "…";
  const ellipsisWidth = font.widthOfTextAtSize(ellipsis, fontSize);
  const budget = maxWidth - ellipsisWidth;
  if (budget <= 0) return "";

  let out = "";
  for (const char of text) {
    if (font.widthOfTextAtSize(out + char, fontSize) > budget) break;
    out += char;
  }
  return out ? `${out}${ellipsis}` : "";
}

/**
 * Generates a pure vector PDF binary (Uint8Array) from JSON scene data using pdf-lib
 * 
 * @param {Object} sceneData - JSON scene representation: { page: { width, height, bg }, objects: [...] }
 * @param {Object} mergeData - Key-value map for {{placeholder}} fields
 * @returns {Promise<Uint8Array>} PDF document bytes
 */
export async function generateVectorPdfFromScene(sceneData, mergeData = {}) {
  const pdfDoc = await PDFDocument.create();

  // Page dimensions (default A4: 595 x 842 pt)
  const pageW = sceneData?.page?.width || 595;
  const pageH = sceneData?.page?.height || 842;
  const page = pdfDoc.addPage([pageW, pageH]);

  // Draw Page Background
  const pageBg = sceneData?.page?.bg || "#ffffff";
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageW,
    height: pageH,
    color: hexToPdfRgb(pageBg, rgb(1, 1, 1)),
  });

  // Load standard fonts
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontCourierBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  // Family classification is shared with the canvas renderer (see sceneFonts),
  // so the preview and the PDF can't disagree about which face is in use.
  const getFont = (fontFamily = "Helvetica", fontWeight = "normal") => {
    const isBold = isBoldWeight(fontWeight);
    switch (classifyFontFamily(fontFamily)) {
      case "Times-Roman":
        return isBold ? fontTimesBold : fontTimes;
      case "Courier":
        return isBold ? fontCourierBold : fontCourier;
      default:
        return isBold ? fontHelveticaBold : fontHelvetica;
    }
  };

  const objects = sceneData?.objects || [];

  for (const obj of objects) {
    if (!obj || obj.hidden) continue;

    const objX = Number(obj.x || 0);
    const objY = Number(obj.y || 0);
    const objW = Number(obj.width || 0);
    const objH = Number(obj.height || 0);

    switch (obj.type) {
      // ─── TEXT OBJECT ──────────────────────────────────────────────────
      case "text": {
        const rawText = replacePlaceholders(obj.text || "", mergeData);
        if (!rawText) break;

        const fontSize = Number(obj.fontSize || 14);
        const font = getFont(obj.fontFamily, obj.fontWeight);
        const textColor = hexToPdfRgb(obj.fill, rgb(0, 0, 0));
        const align = obj.align || "left";

        const lines = wrapText(rawText, font, fontSize, objW);
        const lineHeight = fontSize * (obj.lineHeight || DEFAULT_LINE_HEIGHT);

        // Convert canvas Y (top-left origin) to PDF Y (bottom-left origin)
        // PDF Y for text is the baseline of the first line
        let currentPdfY = pageH - objY - fontSize;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineWidth = font.widthOfTextAtSize(line, fontSize);
          let lineX = objX;

          if (align === "center") {
            lineX = objX + (objW > 0 ? (objW - lineWidth) / 2 : 0);
          } else if (align === "right") {
            lineX = objX + (objW > 0 ? objW - lineWidth : 0);
          }

          page.drawText(line, {
            x: Math.max(0, lineX),
            y: currentPdfY,
            size: fontSize,
            font: font,
            color: textColor,
            opacity: obj.opacity !== undefined ? Number(obj.opacity) : 1,
            ...(obj.rotation ? { rotate: degrees(-obj.rotation) } : {}),
          });

          currentPdfY -= lineHeight;
        }
        break;
      }

      // ─── IMAGE OBJECT ─────────────────────────────────────────────────
      case "image": {
        if (!obj.src) break;
        try {
          let embeddedImage;
          const src = obj.src;

          if (src.startsWith("data:image/png;base64,")) {
            const base64Data = src.replace("data:image/png;base64,", "");
            embeddedImage = await pdfDoc.embedPng(Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)));
          } else if (src.startsWith("data:image/jpeg;base64,") || src.startsWith("data:image/jpg;base64,")) {
            const base64Data = src.replace(/^data:image\/jpe?g;base64,/, "");
            embeddedImage = await pdfDoc.embedJpg(Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)));
          } else if (src.startsWith("http://") || src.startsWith("https://")) {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            if (src.toLowerCase().endsWith(".png")) {
              embeddedImage = await pdfDoc.embedPng(bytes);
            } else {
              embeddedImage = await pdfDoc.embedJpg(bytes);
            }
          }

          if (embeddedImage) {
            const pdfY = pageH - objY - objH;
            page.drawImage(embeddedImage, {
              x: objX,
              y: pdfY,
              width: objW,
              height: objH,
              opacity: obj.opacity !== undefined ? Number(obj.opacity) : 1,
              ...(obj.rotation ? { rotate: degrees(-obj.rotation) } : {}),
            });
          }
        } catch (imgErr) {
          console.warn("Failed to embed image in PDF:", imgErr.message);
        }
        break;
      }

      // ─── QR CODE OBJECT ───────────────────────────────────────────────
      case "qr": {
        const qrRawText = replacePlaceholders(obj.text || "https://docforge.app", mergeData);
        const qrSize = Number(obj.size || objW || 80);
        try {
          const qrDataUrl = await QRCode.toDataURL(qrRawText, {
            margin: 1,
            color: {
              dark: obj.fill || "#000000",
              light: obj.bgColor || "#ffffff",
            },
          });
          const base64Data = qrDataUrl.replace("data:image/png;base64,", "");
          const qrImage = await pdfDoc.embedPng(Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)));
          const pdfY = pageH - objY - qrSize;
          page.drawImage(qrImage, {
            x: objX,
            y: pdfY,
            width: qrSize,
            height: qrSize,
          });
        } catch (qrErr) {
          console.warn("Failed to render QR Code in PDF:", qrErr.message);
        }
        break;
      }

      // ─── SHAPE OBJECT ─────────────────────────────────────────────────
      case "shape": {
        const shapeKind = obj.shapeType || "rect";
        const strokeColor = obj.stroke ? hexToPdfRgb(obj.stroke) : undefined;
        const fillColor = obj.fill ? hexToPdfRgb(obj.fill) : undefined;
        const borderWidth = Number(obj.strokeWidth || 1);

        if (shapeKind === "rect") {
          const pdfY = pageH - objY - objH;
          page.drawRectangle({
            x: objX,
            y: pdfY,
            width: objW,
            height: objH,
            color: fillColor,
            borderColor: strokeColor,
            borderWidth: strokeColor ? borderWidth : 0,
            opacity: obj.opacity !== undefined ? Number(obj.opacity) : 1,
          });
        } else if (shapeKind === "circle") {
          const rx = objW / 2;
          const ry = objH / 2;
          const centerX = objX + rx;
          const centerY = pageH - (objY + ry);
          page.drawEllipse({
            x: centerX,
            y: centerY,
            xScale: rx,
            yScale: ry,
            color: fillColor,
            borderColor: strokeColor,
            borderWidth: strokeColor ? borderWidth : 0,
          });
        } else if (shapeKind === "line") {
          const x1 = objX;
          const y1 = pageH - objY;
          const x2 = objX + objW;
          const y2 = pageH - (objY + objH);
          page.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            thickness: borderWidth,
            color: strokeColor || hexToPdfRgb("#000000"),
          });
        } else if (shapeKind === "border") {
          // Classic Document Border Frame
          const margin = Number(obj.margin || 20);
          const borderStyle = obj.borderStyle || "double";
          const color = strokeColor || hexToPdfRgb("#1e3a8a");

          if (borderStyle === "single" || borderStyle === "double") {
            page.drawRectangle({
              x: margin,
              y: margin,
              width: pageW - margin * 2,
              height: pageH - margin * 2,
              borderColor: color,
              // Honour the object's own stroke width; the canvas does.
              borderWidth: borderWidth,
            });
          }
          if (borderStyle === "double") {
            const innerMargin = margin + 5;
            page.drawRectangle({
              x: innerMargin,
              y: innerMargin,
              width: pageW - innerMargin * 2,
              height: pageH - innerMargin * 2,
              borderColor: color,
              borderWidth: 1,
            });
          }
        }
        break;
      }

      // ─── TABLE OBJECT ─────────────────────────────────────────────────
      case "table": {
        const headers = obj.headers || [];
        const rows = obj.rows || [];
        const tableW = objW || pageW - 100;
        const headerBg = hexToPdfRgb(obj.headerBg || "#ffffff");
        const borderColor = hexToPdfRgb(obj.borderColor || "#000000");
        const font = getFont(obj.fontFamily, "normal");
        const fontBold = getFont(obj.fontFamily, "bold");
        const fontSize = Number(obj.fontSize || 11);
        const cellPadding = Number(obj.cellPadding || 8);
        const lineHeightVal = fontSize * 1.25;

        const numCols = Math.max(headers.length, rows[0]?.length || 1);
        const colWidth = tableW / numCols;
        const cellTextWidth = Math.max(0, colWidth - cellPadding * 2);

        let currentY = objY;

        // Draw Table Header
        if (headers.length > 0) {
          const headerLines = headers.map((h) =>
            wrapText(replacePlaceholders(String(h || ""), mergeData), fontBold, fontSize, cellTextWidth)
          );
          const maxHeaderLines = Math.max(1, ...headerLines.map((l) => l.length));
          const headerRowHeight = maxHeaderLines * lineHeightVal + cellPadding * 2;
          const headerPdfY = pageH - currentY - headerRowHeight;

          page.drawRectangle({
            x: objX,
            y: headerPdfY,
            width: tableW,
            height: headerRowHeight,
            color: headerBg,
            borderColor: borderColor,
            borderWidth: 1,
          });

          for (let c = 0; c < headers.length; c++) {
            const cellX = objX + c * colWidth + cellPadding;
            const lines = headerLines[c];

            for (let l = 0; l < lines.length; l++) {
              const lineY = headerPdfY + headerRowHeight - cellPadding - fontSize - l * lineHeightVal;
              page.drawText(lines[l], {
                x: cellX,
                y: lineY,
                size: fontSize,
                font: fontBold,
                color: hexToPdfRgb("#111827"),
              });
            }

            if (c > 0) {
              page.drawLine({
                start: { x: objX + c * colWidth, y: headerPdfY },
                end: { x: objX + c * colWidth, y: headerPdfY + headerRowHeight },
                thickness: 1,
                color: borderColor,
              });
            }
          }
          currentY += headerRowHeight;
        }

        // Draw Table Rows
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          const rowLines = Array.from({ length: numCols }).map((_, c) =>
            wrapText(replacePlaceholders(String(row[c] || ""), mergeData), font, fontSize, cellTextWidth)
          );
          const maxRowLines = Math.max(1, ...rowLines.map((l) => l.length));
          const rowHeight = maxRowLines * lineHeightVal + cellPadding * 2;
          const rowPdfY = pageH - currentY - rowHeight;

          page.drawRectangle({
            x: objX,
            y: rowPdfY,
            width: tableW,
            height: rowHeight,
            color: r % 2 === 1 ? hexToPdfRgb("#f9fafb") : hexToPdfRgb("#ffffff"),
            borderColor: borderColor,
            borderWidth: 1,
          });

          for (let c = 0; c < numCols; c++) {
            const cellX = objX + c * colWidth + cellPadding;
            const lines = rowLines[c];

            for (let l = 0; l < lines.length; l++) {
              const lineY = rowPdfY + rowHeight - cellPadding - fontSize - l * lineHeightVal;
              page.drawText(lines[l], {
                x: cellX,
                y: lineY,
                size: fontSize,
                font: font,
                color: hexToPdfRgb("#374151"),
              });
            }

            if (c > 0) {
              page.drawLine({
                start: { x: objX + c * colWidth, y: rowPdfY },
                end: { x: objX + c * colWidth, y: rowPdfY + rowHeight },
                thickness: 1,
                color: borderColor,
              });
            }
          }
          currentY += rowHeight;
        }

        break;
      }

      default:
        break;
    }
  }

  return await pdfDoc.save();
}
