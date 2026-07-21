export function normalizeListText(text) {
  let normalized = text;

  // 1. Add newlines and indent before inline bullets (e.g. " • ") to ensure they nest properly
  normalized = normalized.replace(
    /([^\n])[^\S\n]+([•◦▪*\-])[^\S\n]+/g,
    "$1\n    $2 ",
  );

  // 2. Add newlines before inline numbered items (e.g. " 2.Working")
  normalized = normalized.replace(
    /([^\n])[^\S\n]+(\d+\.)\s*([a-zA-Z])/g,
    "$1\n$2 $3",
  );

  // 3. Normalize the very start of the string if it's a number without space (e.g. "1.Specifications")
  normalized = normalized.replace(
    /^([^\S\n]*)(\d+\.)\s*([a-zA-Z])/gm,
    "$1$2 $3",
  );

  // 4. Add newlines before section headings (e.g. " 2.4 Modern")
  normalized = normalized.replace(
    /([^\n])[^\S\n]+(\d+(?:\.\d+)+)[^\S\n]+([A-Z])/g,
    "$1\n$2 $3",
  );

  return normalized;
}

export function splitHeadingAndParagraph(text) {
  const stopWords = new Set([
    "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "with", "of", "in", "as",
  ]);
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return { heading: text, paragraph: "" };

  let splitIdx = words.length;
  for (let i = 0; i < words.length - 1; i++) {
    const word = words[i];
    const nextWord = words[i + 1];

    const isCap = /^[A-Z]/.test(word);
    const nextIsLower = /^[a-z]/.test(nextWord);
    const nextIsStop = stopWords.has(nextWord.toLowerCase());

    if (isCap && nextIsLower && !nextIsStop) {
      splitIdx = i;
      break;
    }
  }

  if (splitIdx === 0 || splitIdx > 8) {
    splitIdx = Math.min(4, words.length);
  }

  const heading = words.slice(0, splitIdx).join(" ");
  const paragraph = words.slice(splitIdx).join(" ");
  return { heading, paragraph };
}

export function textToHtmlList(text) {
  const normalizedText = normalizeListText(text);
  const lines = normalizedText.split("\n");
  let html = "";

  // Stack tracks open lists: { type: 'ul' | 'ol', indent: number }
  const stack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }

    const indentMatch = line.match(/^([^\S\n]*)/);
    const indent = indentMatch[1].replace(/\t/g, "    ").length;

    const bulletMatch = line.match(/^[^\S\n]*([•◦▪*\-])[^\S\n]+(.*)/);
    let numberMatch = line.match(/^[^\S\n]*(\d+)\.[^\S\n]+(.*)/);
    const sectionMatch = line.match(/^[^\S\n]*(\d+(?:\.\d+)+)[^\S\n]+(.*)/);

    if (!numberMatch) {
      const noSpaceMatch = line.match(/^[^\S\n]*(\d+)\.([a-zA-Z].*)/);
      if (noSpaceMatch) {
        numberMatch = [noSpaceMatch[0], noSpaceMatch[1], noSpaceMatch[2]];
      }
    }

    if (sectionMatch) {
      numberMatch = [sectionMatch[0], sectionMatch[1], sectionMatch[2]];
    }

    if (bulletMatch || numberMatch) {
      const type = bulletMatch ? "ul" : "ol";
      const content = bulletMatch ? bulletMatch[2] : numberMatch[2];

      // Close deeper lists
      while (stack.length > 0 && indent < stack[stack.length - 1].indent) {
        html += `</li></${stack.pop().type}>`;
      }

      if (stack.length === 0 || indent > stack[stack.length - 1].indent) {
        // Open new list
        stack.push({ type, indent });
        html += `<${type}>`;
      } else if (
        stack.length > 0 &&
        indent === stack[stack.length - 1].indent
      ) {
        if (stack[stack.length - 1].type !== type) {
          // Different type at same level: close old list, open new
          html += `</li></${stack.pop().type}>`;
          stack.push({ type, indent });
          html += `<${type}>`;
        } else {
          // Same list, close the previous item
          html += `</li>`;
        }
      }

      // Open new item, but don't close </li> yet to allow nesting
      html += `<li><p>${content}</p>`;
    } else {
      // Not a list item, close all open lists
      while (stack.length > 0) {
        html += `</li></${stack.pop().type}>`;
      }
      html += `<p>${line.trim()}</p>`;
    }
  }

  // Close any remaining lists
  while (stack.length > 0) {
    html += `</li></${stack.pop().type}>`;
  }

  return html;
}

export function looksLikeList(text) {
  const normalizedText = normalizeListText(text);
  const lines = normalizedText.split("\n");
  return lines.some((line) => {
    return (
      /^[^\S\n]*[•◦▪*\-][^\S\n]+/.test(line) ||
      /^[^\S\n]*\d+[.)][^\S\n]+/.test(line) ||
      /^[^\S\n]*\d+\.[a-zA-Z]/.test(line) ||
      /^[^\S\n]*\d+(?:\.\d+)+[^\S\n]+/.test(line) ||
      /^[^\S\n]*[a-zA-Z][.)][^\S\n]+/.test(line)
    );
  });
}
