/**
 * docUtils.js — Utilities for merging multi-chapter project data into a single
 * Tiptap document tree and splitting a single Tiptap document tree back into chapters.
 */

function stripHeadingPrefix(text) {
  let cleaned = (text || "").trim();
  cleaned = cleaned.replace(/^\s*\d+(?:\.\d+)*(?:\.\s+|\s+)/, "");
  cleaned = cleaned.replace(/^\s*[a-zA-Z][.)]\s+/, "");
  cleaned = cleaned.replace(/^\s*(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[.)]\s+/i, "");
  return cleaned.trim();
}

/**
 * Splits doc nodes into sections separated by headings of the given level.
 */
export function splitDocByHeadings(doc, headingLevel = 1) {
  const content = doc?.content;
  if (!Array.isArray(content)) return [];

  const sections = [];
  let currentSection = { heading: null, nodes: [] };

  for (const node of content) {
    if (node?.type === "heading" && node?.attrs?.level === headingLevel) {
      if (currentSection.heading || currentSection.nodes.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { heading: node, nodes: [node] };
    } else {
      currentSection.nodes.push(node);
    }
  }

  if (currentSection.heading || currentSection.nodes.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Merges frontMatter and chapters from a project into a single Tiptap doc structure.
 */
export function mergeChaptersToSingleDoc(frontMatter = [], chapters = []) {
  const mergedContent = [];

  // 1. Process Front Matter (include non-auto items like Abstract and Acknowledgement, skip Certificate and auto items)
  for (const fm of frontMatter) {
    if (fm.auto || fm.id === "certificate" || fm.label?.toLowerCase() === "certificate") continue;

    // Add H1 Heading for Front Matter Section
    mergedContent.push({
      type: "heading",
      attrs: { level: 1, isFrontMatter: true, isChapter: false },
      content: [{ type: "text", text: (fm.label || fm.title || "Section").toUpperCase() }],
    });

    if (Array.isArray(fm.content?.content)) {
      mergedContent.push(...fm.content.content);
    } else {
      mergedContent.push({
        type: "paragraph",
        content: [],
      });
    }
  }

  // 2. Process Chapters
  chapters.forEach((ch, idx) => {
    const chNum = idx + 1;
    const rawTitle = ch.title || `Chapter ${chNum}`;
    const cleanTitle = stripHeadingPrefix(rawTitle);

    // Add Level 1 Heading for Chapter Title
    mergedContent.push({
      type: "heading",
      attrs: { level: 1, isChapter: true, isFrontMatter: false },
      content: [{ type: "text", text: `CHAPTER ${chNum}: ${cleanTitle}` }],
    });

    if (Array.isArray(ch.content?.content)) {
      const nodes = ch.content.content;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (i === 0 && node.type === "heading") {
          const nodeText = (node.content?.map((c) => c?.text || "").join("") || "").trim();
          const cleanNodeText = stripHeadingPrefix(nodeText).toUpperCase();
          const normCleanTitle = cleanTitle.toUpperCase();
          const normRawTitle = rawTitle.toUpperCase();

          if (
            nodeText.toUpperCase().includes(`CHAPTER ${chNum}`) ||
            cleanNodeText === normCleanTitle ||
            cleanNodeText === normRawTitle ||
            (normCleanTitle && (cleanNodeText.includes(normCleanTitle) || normCleanTitle.includes(cleanNodeText)))
          ) {
            continue; // Skip duplicate H1/H2 heading at start of chapter
          }
        }
        mergedContent.push(node);
      }
    } else {
      mergedContent.push({
        type: "paragraph",
        content: [],
      });
    }
  });

  if (mergedContent.length === 0) {
    mergedContent.push({
      type: "paragraph",
      content: [],
    });
  }

  return {
    type: "doc",
    content: mergedContent,
  };
}

function isContentEmpty(contentArray) {
  if (!contentArray?.length) return true;
  return contentArray.every((node) => {
    if (node.type === "paragraph") {
      if (!node.content?.length) return true;
      const text = node.content.map((c) => c?.text || "").join("").trim();
      return text === "";
    }
    return false;
  });
}

function findMatchingChapter(cleanTitle, existingChapters, usedIds) {
  if (!cleanTitle || !existingChapters?.length) return null;
  const normClean = cleanTitle.toLowerCase();

  // 1. Exact match on clean title
  for (const ch of existingChapters) {
    if (usedIds.has(ch.id)) continue;
    const chClean = stripHeadingPrefix(ch.title || "").toLowerCase();
    if (chClean && chClean === normClean) {
      return ch;
    }
  }

  // 2. Substring match
  for (const ch of existingChapters) {
    if (usedIds.has(ch.id)) continue;
    const chClean = stripHeadingPrefix(ch.title || "").toLowerCase();
    if (chClean && (normClean.includes(chClean) || chClean.includes(normClean))) {
      return ch;
    }
  }

  return null;
}

/**
 * Splits a single unified Tiptap doc tree back into frontMatter and chapters arrays for storage & LaTeX generation.
 */
export function splitSingleDocToProject(singleDoc, existingFrontMatter = [], existingChapters = []) {
  if (!Array.isArray(singleDoc?.content)) {
    return { frontMatter: existingFrontMatter, chapters: existingChapters };
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

  const sections = splitDocByHeadings(singleDoc, 1);

  for (const section of sections) {
    for (const node of section.nodes) {
      const text = (node.content?.map((c) => c?.text || "").join("") || "").trim();
      const normText = text.toLowerCase();

      // Check if node matches any non-auto frontMatter item (e.g. Abstract or Acknowledgement)
      const isPotentialFm =
        node.type === "heading" ||
        (node.type === "paragraph" &&
          (normText === "abstract" ||
            normText === "acknowledgement" ||
            normText.startsWith("abstract:") ||
            normText.startsWith("acknowledgement:")));

      const matchedFm = isPotentialFm
        ? updatedFm.find((fm) => {
            if (fm.auto || fm.id === "certificate" || fm.label?.toLowerCase() === "certificate") return false;
            const label = (fm.label || fm.title || "").toLowerCase();
            return label && (normText === label || normText.startsWith(label) || normText.includes(label));
          })
        : null;

      if (matchedFm) {
        currentTarget = { type: "fm", obj: matchedFm };
      } else if (node.type === "heading" && node.attrs?.level === 1) {
        const cleanTitle = stripHeadingPrefix(text.replace(/^CHAPTER\s+\d+[:\s\-]*/i, ""));

        // If current target is an empty chapter, update its title instead of creating a duplicate empty chapter
        if (
          currentTarget?.type === "ch" &&
          isContentEmpty(currentTarget.obj.content?.content)
        ) {
          if (cleanTitle) {
            currentTarget.obj.title = cleanTitle;
          }
          currentTarget.obj.content.content = [];
        } else {
          // Chapter heading for a new chapter
          chIndex++;

          // Match existing chapter by title or position
          let matchedCh = findMatchingChapter(cleanTitle, existingChapters, usedChapterIds);
          if (!matchedCh && existingChapters?.[chIndex - 1] && !usedChapterIds.has(existingChapters[chIndex - 1].id)) {
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
          // Also handle plain text paragraph starting with "CHAPTER X: Title" in an empty chapter
          if (
            currentTarget.type === "ch" &&
            isContentEmpty(currentTarget.obj.content?.content) &&
            node.type === "paragraph" &&
            Array.isArray(node.content)
          ) {
            const paraText = node.content.map((c) => c?.text || "").join("").trim();
            if (/^CHAPTER\s+\d+[:\s\-]*/i.test(paraText)) {
              const cleanTitle = stripHeadingPrefix(paraText.replace(/^CHAPTER\s+\d+[:\s\-]*/i, ""));
              if (cleanTitle) {
                currentTarget.obj.title = cleanTitle;
              }
              continue; // Skip adding redundant title paragraph
            }
          }

          if (currentTarget.type === "fm") {
            currentTarget.obj.content.content.push(node);
          } else if (currentTarget.type === "ch") {
            currentTarget.obj.content.content.push(node);
          }
        } else {
          // Fallback before any H1
          if (existingChapters.length > 0) {
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
    }
  }

  // Fallback if all chapters were deleted from document text
  if (newChapters.length === 0) {
    const fallbackId = existingChapters[0]?.id || `ch_${Date.now()}_1`;
    newChapters.push({
      id: fallbackId,
      title: existingChapters[0]?.title || "Chapter 1",
      content: { type: "doc", content: [] },
    });
  }

  return {
    frontMatter: updatedFm,
    chapters: newChapters,
  };
}

export function splitSingleDocToChapters(singleDoc, existingChapters = []) {
  const result = splitSingleDocToProject(singleDoc, [], existingChapters);
  return result.chapters;
}


