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

  // 1. Process Front Matter (include non-auto items like Abstract and Acknowledgement, skip Certificate and auto items)
  for (const fm of frontMatter) {
    if (fm.auto || fm.id === "certificate" || fm.label?.toLowerCase() === "certificate") continue;

    // Add H1 Heading for Front Matter Section
    mergedContent.push({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: (fm.label || fm.title || "Section").toUpperCase() }],
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
 * Splits a single unified Tiptap doc tree back into frontMatter and chapters arrays for storage & LaTeX generation.
 */
export function splitSingleDocToProject(singleDoc, existingFrontMatter = [], existingChapters = []) {
  if (!singleDoc || !singleDoc.content || !Array.isArray(singleDoc.content)) {
    return { frontMatter: existingFrontMatter, chapters: existingChapters };
  }

  const updatedFm = existingFrontMatter.map((fm) => ({
    ...fm,
    content: (fm.auto || fm.id === "certificate" || fm.label?.toLowerCase() === "certificate")
      ? fm.content
      : { type: "doc", content: [] },
  }));

  const newChapters = [];
  let currentTarget = null;
  let chIndex = 0;

  for (const node of singleDoc.content) {
    if (node.type === "heading" && node.attrs?.level === 1) {
      const text = (node.content ? node.content.map(c => c.text || '').join('') : '').trim();
      const normText = text.toLowerCase();

      // Check if heading matches any non-auto frontMatter item (except certificate)
      const matchedFm = updatedFm.find((fm) => {
        if (fm.auto || fm.id === "certificate" || fm.label?.toLowerCase() === "certificate") return false;
        const label = (fm.label || fm.title || "").toLowerCase();
        return label && (normText === label || normText.includes(label));
      });

      if (matchedFm) {
        currentTarget = { type: "fm", obj: matchedFm };
      } else {
        // Chapter heading
        chIndex++;
        const cleanTitle = stripHeadingPrefix(text.replace(/^CHAPTER\s+\d+[:\s\-]*/i, ""));
        const existingCh = existingChapters[chIndex - 1];

        const newCh = {
          id: existingCh ? existingCh.id : `ch_${Date.now()}_${chIndex}`,
          title: cleanTitle || `Chapter ${chIndex}`,
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

  return {
    frontMatter: updatedFm,
    chapters: newChapters.length > 0 ? newChapters : existingChapters,
  };
}

export function splitSingleDocToChapters(singleDoc, existingChapters = []) {
  const result = splitSingleDocToProject(singleDoc, [], existingChapters);
  return result.chapters;
}
