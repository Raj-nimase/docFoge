/**
 * Splits squashed PDF text (where paragraphs, section headings like "3.2 Attention",
 * and lead-in labels like "Decoder:" are concatenated together without line breaks)
 * into properly separated blocks.
 */
export function separatePdfParagraphsAndHeadings(text) {
  if (!text) return text;

  let cleaned = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 1. Insert blank lines before section headers squashed after sentence endings or space
  // e.g. "...less than i. 3.2 Attention An attention..." -> "...less than i.\n\n3.2 Attention\n\nAn attention..."
  cleaned = cleaned.replace(
    /([.:!?]|\b)\s+((?:Section\s+)?\d+(?:\.\d+)+[.)]?\s+[A-Z][A-Za-z0-9\s\-/]{1,60})(?=\s+[A-Z])/g,
    "$1\n\n$2\n\n"
  );

  // 2. Insert blank lines before single-number section headings if squashed
  // e.g. "...dmodel = 512. 3 Methodology In this..." -> "...dmodel = 512.\n\n3 Methodology\n\nIn this..."
  cleaned = cleaned.replace(
    /([.:!?])\s+(\d+[.)]\s+[A-Z][A-Za-z0-9\s\-/]{1,40})(?=\s+[A-Z])/g,
    "$1\n\n$2\n\n"
  );

  // 3. Insert blank lines before paragraph lead-in labels if squashed after a sentence ending
  // e.g. "...dmodel = 512. Decoder: The decoder is..." -> "...dmodel = 512.\n\nDecoder: The decoder is..."
  cleaned = cleaned.replace(
    /([.:!?])\s+([A-Z][A-Za-z0-9\s\-/]{1,30}:\s+[A-Z])/g,
    "$1\n\n$2"
  );

  return cleaned;
}

export function reconstructPdfParagraphs(text) {
  if (!text) return "";
  const separated = separatePdfParagraphsAndHeadings(text);
  const rawLines = separated.split("\n");

  const blocks = [];
  let currentPara = [];

  const isListStart = (trimmedLine) => {
    // Test raw line — don't strip bold markers first, since * is also a bullet char.
    // The regex requires whitespace after the bullet, so **bold won't false-match.
    return /^([•◦▪*\-+]|(\d+|[a-zA-Z]|[iIvVxX]+)[.)])\s+/.test(trimmedLine);
  };

  const isHeadingOrDivider = (trimmedLine) => {
    const plain = trimmedLine.replace(/^[*_]{1,3}/, "").replace(/[*_]{1,3}$/, "").trim();
    if (/^[-*_]{3,}$/.test(plain)) return true; // hr
    if (/^#{1,6}\s/.test(plain)) return true; // heading
    if (/^[\[\]$$]/.test(plain) || /^\\\[/.test(plain) || /^\\\]/.test(plain)) return true; // math fence (open or close)
    if (plain.includes("|") && /^\s*\|?[\s:|\\-]*-[\s:|\\-]*\|?\s*$/.test(plain)) return true; // table
    if (/^(?:Section\s+)?\d+(?:\.\d+)*[.)]?\s+[A-Z]/i.test(plain) && plain.length < 80) return true; // section headers like 3.2 Attention or 3.2.1 Scaled Dot-Product
    if (/^[A-Z0-9\s\-\.\:]{3,50}$/.test(plain) && plain.length < 60 && !/[a-z]/.test(plain)) return true; // all-caps titles like ABSTRACT
    return false;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentPara.length > 0) {
        blocks.push(currentPara.join(" "));
        currentPara = [];
      }
      continue;
    }

    if (isHeadingOrDivider(trimmed)) {
      if (currentPara.length > 0) {
        blocks.push(currentPara.join(" "));
        currentPara = [];
      }
      blocks.push(trimmed);
    } else if (isListStart(trimmed)) {
      if (currentPara.length > 0) {
        blocks.push(currentPara.join(" "));
      }
      currentPara = [trimmed];
    } else {
      if (currentPara.length > 0) {
        const prev = currentPara[currentPara.length - 1];
        const isShortTitleLine = trimmed.length < 60 && /^[A-Z0-9][^.:;!?]*$/.test(trimmed);
        if (isShortTitleLine && /[.:!?]$/.test(prev)) {
          blocks.push(currentPara.join(" "));
          currentPara = [trimmed];
          continue;
        }
      }
      currentPara.push(trimmed);
    }
  }

  if (currentPara.length > 0) {
    blocks.push(currentPara.join(" "));
  }

  return blocks.join("\n\n");
}
