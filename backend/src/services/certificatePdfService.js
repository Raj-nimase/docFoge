const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb, StandardFonts, degrees } = require("pdf-lib");
const QRCode = require("qrcode");

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

function replacePlaceholders(text, data = {}) {
  if (typeof text !== "string") return "";
  let result = text;
  result = result.replace(/\[PROJECT TITLE\]/gi, data.title || "Project Title");
  result = result.replace(/\[CANDIDATE NAME\]/gi, data.authors || "Candidate Name");
  result = result.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (match, p1) => {
    return data[p1] !== undefined ? data[p1] : match;
  });
  return result;
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
 * Render pure vector PDF for fixed layout / certificate document using pdf-lib (No Puppeteer)
 */
async function renderCertificateVectorPdf(certData, metadata = {}, outputPath) {
  try {
    const pdfDoc = await PDFDocument.create();
    
    // Default page space (A4: 595 x 842 pt)
    const pageW = certData?.page?.width || certData?.layout?.paperW || 595;
    const pageH = certData?.page?.height || certData?.layout?.paperH || 842;
    const page = pdfDoc.addPage([pageW, pageH]);

    // Page Background
    const pageBg = certData?.page?.bg || "#ffffff";
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageW,
      height: pageH,
      color: hexToPdfRgb(pageBg, rgb(1, 1, 1)),
    });

    const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // Render structured JSON objects if present
    if (certData.objects && Array.isArray(certData.objects)) {
      for (const obj of certData.objects) {
        if (!obj || obj.hidden) continue;

        const objX = Number(obj.x || 0);
        const objY = Number(obj.y || 0);
        const objW = Number(obj.width || 0);
        const objH = Number(obj.height || 0);

        if (obj.type === "text") {
          const rawText = replacePlaceholders(obj.text || "", metadata);
          if (!rawText) continue;
          const fontSize = Number(obj.fontSize || 14);
          const font = (obj.fontWeight === "bold" || obj.fontWeight === "700") ? fontHelveticaBold : fontHelvetica;
          const textColor = hexToPdfRgb(obj.fill, rgb(0, 0, 0));
          const lines = wrapText(rawText, font, fontSize, objW);
          const lineHeight = fontSize * (obj.lineHeight || 1.25);
          let currentPdfY = pageH - objY - fontSize;

          for (const line of lines) {
            const lineWidth = font.widthOfTextAtSize(line, fontSize);
            let lineX = objX;
            if (obj.align === "center") {
              lineX = objX + (objW > 0 ? (objW - lineWidth) / 2 : 0);
            } else if (obj.align === "right") {
              lineX = objX + (objW > 0 ? objW - lineWidth : 0);
            }
            page.drawText(line, {
              x: Math.max(0, lineX),
              y: currentPdfY,
              size: fontSize,
              font: font,
              color: textColor,
            });
            currentPdfY -= lineHeight;
          }
        } else if (obj.type === "image" && obj.src) {
          try {
            let img;
            if (obj.src.startsWith("data:image/png;base64,")) {
              const base64Data = obj.src.replace("data:image/png;base64,", "");
              img = await pdfDoc.embedPng(Buffer.from(base64Data, "base64"));
            } else if (obj.src.startsWith("data:image/jpeg;base64,") || obj.src.startsWith("data:image/jpg;base64,")) {
              const base64Data = obj.src.replace(/^data:image\/jpe?g;base64,/, "");
              img = await pdfDoc.embedJpg(Buffer.from(base64Data, "base64"));
            }
            if (img) {
              page.drawImage(img, {
                x: objX,
                y: pageH - objY - objH,
                width: objW,
                height: objH,
              });
            }
          } catch (e) {
            console.warn("Failed to embed image in backend PDF:", e.message);
          }
        } else if (obj.type === "qr") {
          const qrText = replacePlaceholders(obj.text || "https://docforge.app", metadata);
          const qrSize = Number(obj.size || objW || 80);
          try {
            const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1 });
            const base64Data = qrDataUrl.replace("data:image/png;base64,", "");
            const qrImg = await pdfDoc.embedPng(Buffer.from(base64Data, "base64"));
            page.drawImage(qrImg, {
              x: objX,
              y: pageH - objY - qrSize,
              width: qrSize,
              height: qrSize,
            });
          } catch (e) {
            console.warn("Failed to embed QR in backend PDF:", e.message);
          }
        } else if (obj.type === "shape") {
          const shapeKind = obj.shapeType || "rect";
          const strokeColor = obj.stroke ? hexToPdfRgb(obj.stroke) : undefined;
          const fillColor = obj.fill ? hexToPdfRgb(obj.fill) : undefined;
          const borderWidth = Number(obj.strokeWidth || 1);

          if (shapeKind === "rect") {
            page.drawRectangle({
              x: objX,
              y: pageH - objY - objH,
              width: objW,
              height: objH,
              color: fillColor,
              borderColor: strokeColor,
              borderWidth: strokeColor ? borderWidth : 0,
            });
          } else if (shapeKind === "border") {
            const margin = Number(obj.margin || 20);
            page.drawRectangle({
              x: margin,
              y: margin,
              width: pageW - margin * 2,
              height: pageH - margin * 2,
              borderColor: strokeColor || hexToPdfRgb("#1e3a8a"),
              borderWidth: 2,
            });
          }
        } else if (obj.type === "table") {
          const headers = obj.headers || [];
          const rows = obj.rows || [];
          const tableW = objW || pageW - 100;
          const headerBg = hexToPdfRgb(obj.headerBg || "#ffffff");
          const borderColor = hexToPdfRgb(obj.borderColor || "#000000");
          const fontSize = Number(obj.fontSize || 11);
          const cellPadding = Number(obj.cellPadding || 8);
          const lineHeightVal = fontSize * 1.25;

          const numCols = Math.max(headers.length, rows[0]?.length || 1);
          const colWidth = tableW / numCols;
          const cellTextWidth = Math.max(0, colWidth - cellPadding * 2);
          let currentY = objY;

          if (headers.length > 0) {
            const headerLines = headers.map((h) =>
              wrapText(replacePlaceholders(String(h || ""), metadata), fontHelveticaBold, fontSize, cellTextWidth)
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
                  font: fontHelveticaBold,
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

          for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            const rowLines = Array.from({ length: numCols }).map((_, c) =>
              wrapText(replacePlaceholders(String(row[c] || ""), metadata), fontHelvetica, fontSize, cellTextWidth)
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
                  font: fontHelvetica,
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
        }
      }
    } else {
      // Legacy Certificate Form Fallback Drawing
      const borderStyle = certData.borderStyle || "double";
      if (borderStyle !== "none") {
        const m = 20;
        page.drawRectangle({
          x: m,
          y: m,
          width: pageW - m * 2,
          height: pageH - m * 2,
          borderColor: hexToPdfRgb("#1e3a8a"),
          borderWidth: 2,
        });
        if (borderStyle === "double") {
          const im = 25;
          page.drawRectangle({
            x: im,
            y: im,
            width: pageW - im * 2,
            height: pageH - im * 2,
            borderColor: hexToPdfRgb("#1e3a8a"),
            borderWidth: 1,
          });
        }
      }

      // Title
      const titleText = replacePlaceholders(certData.title || "CERTIFICATE", metadata);
      const titleWidth = fontHelveticaBold.widthOfTextAtSize(titleText, 22);
      page.drawText(titleText, {
        x: (pageW - titleWidth) / 2,
        y: pageH - 120,
        size: 22,
        font: fontHelveticaBold,
        color: hexToPdfRgb("#1e3a8a"),
      });

      // Institution
      const instText = replacePlaceholders(certData.institution || "INSTITUTION NAME", metadata);
      const instWidth = fontHelvetica.widthOfTextAtSize(instText, 14);
      page.drawText(instText, {
        x: (pageW - instWidth) / 2,
        y: pageH - 150,
        size: 14,
        font: fontHelvetica,
        color: hexToPdfRgb("#374151"),
      });

      // Body
      const bodyText = replacePlaceholders(certData.body || "", metadata);
      if (bodyText) {
        const bodyWidth = fontTimes.widthOfTextAtSize(bodyText.substring(0, 50), 12);
        page.drawText(bodyText, {
          x: 60,
          y: pageH - 220,
          size: 12,
          font: fontTimes,
          color: hexToPdfRgb("#1f2937"),
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    return outputPath;
  } catch (err) {
    console.error("Vector PDF Certificate Generation Error:", err);
    throw err;
  }
}

module.exports = { renderCertificateVectorPdf };
