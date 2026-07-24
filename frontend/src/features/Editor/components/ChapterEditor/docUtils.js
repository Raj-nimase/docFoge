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
 * Merges frontMatter and chapters from a project into a single Tiptap doc structure.
 */
export function mergeChaptersToSingleDoc(frontMatter = [], chapters = []) {
  const mergedContent = [];

  // 1. Process Front Matter (e.g. Title Page, Abstract)
  for (const fm of frontMatter) {
    if (fm.auto) continue; // Skip auto-generated frontMatter like title_page or toc
    
    // Add H1 Heading for Front Matter Section
    mergedContent.push({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: fm.label || fm.title || "Section" }],
    });

    if (fm.content && fm.content.content && Array.isArray(fm.content.content)) {
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
      attrs: { level: 1 },
      content: [{ type: "text", text: `CHAPTER ${chNum}: ${cleanTitle}` }],
    });

    if (ch.content && ch.content.content && Array.isArray(ch.content.content)) {
      // Append all nodes from chapter content, skipping duplicate initial H1 if present
      const nodes = ch.content.content;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (i === 0 && node.type === "heading" && node.attrs?.level === 1) {
          const text = node.content?.[0]?.text || "";
          if (text.toUpperCase().includes(`CHAPTER ${chNum}`) || text.toUpperCase() === cleanTitle.toUpperCase()) {
            continue; // Skip duplicate H1
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

/**
 * Splits a single unified Tiptap doc tree back into chapters array for storage & LaTeX generation.
 */
export function splitSingleDocToChapters(singleDoc, existingChapters = []) {
  if (!singleDoc || !singleDoc.content || !Array.isArray(singleDoc.content)) {
    return existingChapters;
  }

  const newChapters = [];
  let currentChapter = null;
  let chIndex = 0;

  for (const node of singleDoc.content) {
    if (node.type === "heading" && node.attrs?.level === 1) {
      // Start a new Chapter
      chIndex++;
      const text = node.content?.[0]?.text || `Chapter ${chIndex}`;
      const cleanTitle = stripHeadingPrefix(text.replace(/^CHAPTER\s+\d+[:\s\-]*/i, ""));
      const existingCh = existingChapters[chIndex - 1];

      currentChapter = {
        id: existingCh ? existingCh.id : `ch_${Date.now()}_${chIndex}`,
        title: cleanTitle || `Chapter ${chIndex}`,
        content: {
          type: "doc",
          content: [node], // Keep H1 heading in chapter content
        },
      };
      newChapters.push(currentChapter);
    } else {
      if (!currentChapter) {
        // Fallback: create first chapter if content appears before any H1
        chIndex++;
        const existingCh = existingChapters[0];
        currentChapter = {
          id: existingCh ? existingCh.id : `ch_${Date.now()}_1`,
          title: existingCh ? existingCh.title : "Introduction",
          content: {
            type: "doc",
            content: [],
          },
        };
        newChapters.push(currentChapter);
      }
      currentChapter.content.content.push(node);
    }
  }

  return newChapters.length > 0 ? newChapters : existingChapters;
}
