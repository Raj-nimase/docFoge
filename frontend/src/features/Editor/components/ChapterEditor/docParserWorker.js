function stripHeadingPrefixWorker(text) {
  let cleaned = (text || "").trim();
  cleaned = cleaned.replace(/^\s*\d+(?:\.\d+)*(?:\.\s+|\s+)/, "");
  cleaned = cleaned.replace(/^\s*[a-zA-Z][.)]\s+/, "");
  cleaned = cleaned.replace(/^\s*(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[.)]\s+/i, "");
  return cleaned.trim();
}

function isContentEmptyWorker(contentArray) {
  if (!contentArray || contentArray.length === 0) return true;
  return contentArray.every((node) => {
    if (node.type === "paragraph") {
      if (!node.content || node.content.length === 0) return true;
      const text = node.content.map((c) => c.text || "").join("").trim();
      return text === "";
    }
    return false;
  });
}

function findMatchingChapterWorker(cleanTitle, existingChapters = [], usedIds = new Set()) {
  if (!cleanTitle || !existingChapters || existingChapters.length === 0) return null;
  const normClean = cleanTitle.toLowerCase();

  for (const ch of existingChapters) {
    if (usedIds.has(ch.id)) continue;
    const chClean = stripHeadingPrefixWorker(ch.title || "").toLowerCase();
    if (chClean && chClean === normClean) return ch;
  }

  for (const ch of existingChapters) {
    if (usedIds.has(ch.id)) continue;
    const chClean = stripHeadingPrefixWorker(ch.title || "").toLowerCase();
    if (chClean && (normClean.includes(chClean) || chClean.includes(normClean))) return ch;
  }

  return null;
}

self.onmessage = (e) => {
  const { singleDoc, existingFrontMatter = [], existingChapters = [] } = e.data;
  if (!singleDoc || !singleDoc.content || !Array.isArray(singleDoc.content)) {
    self.postMessage({ frontMatter: existingFrontMatter, chapters: existingChapters });
    return;
  }

  const updatedFm = existingFrontMatter.map((fm) => ({
    ...fm,
    content: (fm.auto || fm.id === "certificate" || fm.label?.toLowerCase() === "certificate")
      ? fm.content
      : { type: "doc", content: [] },
  }));

  const newChapters = [];
  const usedChapterIds = new Set();
  let currentTarget = null;
  let chIndex = 0;

  for (const node of singleDoc.content) {
    const text = (node.content ? node.content.map((c) => c.text || "").join("") : "").trim();
    const normText = text.toLowerCase();

    // Check if node matches any non-auto frontMatter item (e.g. Abstract or Acknowledgement)
    const isPotentialFm = (node.type === "heading") || (node.type === "paragraph" && (normText === "abstract" || normText === "acknowledgement" || normText.startsWith("abstract:") || normText.startsWith("acknowledgement:")));

    const matchedFm = isPotentialFm ? updatedFm.find((fm) => {
      if (fm.auto || fm.id === "certificate" || fm.label?.toLowerCase() === "certificate") return false;
      const label = (fm.label || fm.title || "").toLowerCase();
      return label && (normText === label || normText.startsWith(label) || normText.includes(label));
    }) : null;

    if (matchedFm) {
      currentTarget = { type: "fm", obj: matchedFm };
    } else if (node.type === "heading" && node.attrs?.level === 1) {
      const cleanTitle = stripHeadingPrefixWorker(text.replace(/^CHAPTER\s+\d+[:\s\-]*/i, ""));

      // If current target is an empty chapter, update its title instead of creating a duplicate empty chapter
      if (
        currentTarget &&
        currentTarget.type === "ch" &&
        isContentEmptyWorker(currentTarget.obj.content.content)
      ) {
        if (cleanTitle) {
          currentTarget.obj.title = cleanTitle;
        }
        currentTarget.obj.content.content = [];
      } else {
        chIndex++;
        let matchedCh = findMatchingChapterWorker(cleanTitle, existingChapters, usedChapterIds);
        if (!matchedCh && existingChapters[chIndex - 1] && !usedChapterIds.has(existingChapters[chIndex - 1].id)) {
          matchedCh = existingChapters[chIndex - 1];
        }

        const targetId = matchedCh ? matchedCh.id : `ch_${Date.now()}_${chIndex}`;
        usedChapterIds.add(targetId);

        const newCh = {
          id: targetId,
          title: cleanTitle || matchedCh?.title || `Chapter ${chIndex}`,
          content: {
            type: "doc",
            content: [],
          },
        };
        newChapters.push(newCh);
        currentTarget = { type: "ch", obj: newCh };
      }
    } else {
      if (currentTarget) {
        if (
          currentTarget.type === "ch" &&
          isContentEmptyWorker(currentTarget.obj.content.content) &&
          node.type === "paragraph" &&
          node.content &&
          Array.isArray(node.content)
        ) {
          const paraText = node.content.map((c) => c.text || "").join("").trim();
          if (/^CHAPTER\s+\d+[:\s\-]*/i.test(paraText)) {
            const cleanTitle = stripHeadingPrefixWorker(paraText.replace(/^CHAPTER\s+\d+[:\s\-]*/i, ""));
            if (cleanTitle) {
              currentTarget.obj.title = cleanTitle;
            }
            continue;
          }
        }

        if (currentTarget.type === "fm") {
          currentTarget.obj.content.content.push(node);
        } else if (currentTarget.type === "ch") {
          currentTarget.obj.content.content.push(node);
        }
      } else {
        if (newChapters.length === 0) {
          chIndex++;
          const existingCh = existingChapters[0];
          const newCh = {
            id: existingCh ? existingCh.id : `ch_${Date.now()}_1`,
            title: existingCh ? existingCh.title : "Introduction",
            content: { type: "doc", content: [] },
          };
          newChapters.push(newCh);
          currentTarget = { type: "ch", obj: newCh };
        }
        currentTarget.obj.content.content.push(node);
      }
    }
  }

  if (newChapters.length === 0) {
    const fallbackId = existingChapters[0]?.id || `ch_${Date.now()}_1`;
    newChapters.push({
      id: fallbackId,
      title: existingChapters[0]?.title || "Chapter 1",
      content: { type: "doc", content: [] },
    });
  }

  self.postMessage({
    frontMatter: updatedFm,
    chapters: newChapters,
  });
};
