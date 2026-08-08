// Import-document parsing utilities extracted from DashboardHomePage.jsx
// Converts uploaded document text or HTML (from Mammoth .docx extraction)
// into TipTap-compatible chapter structures.
import { parseMarkdownMathToHtml } from '@/hooks/useMathPaste/markdownParser';

/**
 * Recursively extract inline text nodes and formatting marks (bold, italic, underline, strike, code, link)
 */
function extractInlineNodes(node, inheritedMarks = []) {
  const nodes = [];

  if (!node) return nodes;

  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.nodeValue) {
        const textNode = { type: 'text', text: child.nodeValue };
        if (inheritedMarks.length > 0) {
          textNode.marks = inheritedMarks;
        }
        nodes.push(textNode);
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();

      if (tag === 'span' && child.hasAttribute('data-latex')) {
        nodes.push({
          type: 'math',
          attrs: { latex: child.getAttribute('data-latex') || '', display: false }
        });
        return;
      }

      if (tag === 'img') {
        nodes.push({
          type: 'image',
          attrs: {
            src: child.getAttribute('src') || '',
            alt: child.getAttribute('alt') || ''
          }
        });
        return;
      }

      if (tag === 'br') {
        nodes.push({ type: 'text', text: '\n' });
        return;
      }

      // Check inline mark tags
      let mark = null;
      if (tag === 'strong' || tag === 'b') {
        mark = { type: 'bold' };
      } else if (tag === 'em' || tag === 'i') {
        mark = { type: 'italic' };
      } else if (tag === 'u' || tag === 'ins') {
        mark = { type: 'underline' };
      } else if (tag === 's' || tag === 'del' || tag === 'strike') {
        mark = { type: 'strike' };
      } else if (tag === 'code') {
        mark = { type: 'code' };
      } else if (tag === 'a' && child.hasAttribute('href')) {
        mark = { type: 'link', attrs: { href: child.getAttribute('href') || '' } };
      }

      const nextMarks = mark
        ? [...inheritedMarks.filter(m => m.type !== mark.type), mark]
        : inheritedMarks;

      const childrenNodes = extractInlineNodes(child, nextMarks);
      nodes.push(...childrenNodes);
    }
  });

  return nodes;
}

export function htmlToTipTapNode(el) {
  if (!el || !el.tagName) return null;
  const tag = el.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    const level = parseInt(tag.slice(1), 10);
    const inlineContent = extractInlineNodes(el);
    return {
      type: 'heading',
      attrs: { level },
      content: inlineContent.length > 0 ? inlineContent : []
    };
  }

  if (tag === 'p') {
    const inlineNodes = extractInlineNodes(el);
    return {
      type: 'paragraph',
      content: inlineNodes.length > 0 ? inlineNodes : []
    };
  }

  if (tag === 'ul') {
    const items = Array.from(el.children).map(htmlToTipTapNode).filter(Boolean);
    return { type: 'bulletList', content: items };
  }

  if (tag === 'ol') {
    const startAttr = el.getAttribute('start');
    const start = startAttr ? parseInt(startAttr, 10) : undefined;
    const items = Array.from(el.children).map(htmlToTipTapNode).filter(Boolean);
    return { type: 'orderedList', attrs: start ? { start } : {}, content: items };
  }

  if (tag === 'li') {
    const childBlocks = Array.from(el.children)
      .filter(child => ['p', 'ul', 'ol', 'table', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(child.tagName.toLowerCase()))
      .map(htmlToTipTapNode)
      .filter(Boolean);

    const inlineNodes = extractInlineNodes(el);
    const content = childBlocks.length > 0
      ? childBlocks
      : [{ type: 'paragraph', content: inlineNodes.length > 0 ? inlineNodes : [] }];

    return { type: 'listItem', content };
  }

  if (tag === 'img') {
    return {
      type: 'image',
      attrs: {
        src: el.getAttribute('src') || '',
        alt: el.getAttribute('alt') || ''
      }
    };
  }

  if (tag === 'table') {
    const rows = Array.from(el.querySelectorAll('tr')).map(tr => ({
      type: 'tableRow',
      content: Array.from(tr.children).map(cell => ({
        type: cell.tagName.toLowerCase() === 'th' ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph', content: extractInlineNodes(cell) }]
      }))
    }));
    return { type: 'table', content: rows };
  }

  if (tag === 'blockquote') {
    const childBlocks = Array.from(el.children).map(htmlToTipTapNode).filter(Boolean);
    return {
      type: 'blockquote',
      content: childBlocks.length > 0 ? childBlocks : [{ type: 'paragraph', content: extractInlineNodes(el) }]
    };
  }

  // Fallback for container or unknown wrapper elements
  const inlineNodes = extractInlineNodes(el);
  if (inlineNodes.length > 0) {
    return { type: 'paragraph', content: inlineNodes };
  }
  return null;
}

function convertMarkdownToTipTapNodes(markdownText) {
  if (!markdownText) return [];
  const htmlStr = parseMarkdownMathToHtml(markdownText);
  const container = document.createElement('div');
  container.innerHTML = htmlStr;
  const nodes = Array.from(container.children).map(htmlToTipTapNode).filter(Boolean);
  return nodes.length > 0 ? nodes : [{ type: 'paragraph', content: [] }];
}

/**
 * Parse HTML string (from Mammoth convertToHtml) into Tiptap JSON chapter structures and front matter.
 */
export function parseImportedHtmlIntoChapters(contentString, defaultTitle = 'Document Content') {
  if (!contentString) return { frontMatterData: {}, chapters: [] };

  // Determine if content is HTML
  const isHtml = /<[a-z][\s\S]*>/i.test(contentString);

  if (!isHtml) {
    const textChapters = parseImportedTextIntoChapters(contentString);
    return { frontMatterData: {}, chapters: textChapters };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(contentString, 'text/html');
  const topElements = Array.from(doc.body.children);

  if (topElements.length === 0) {
    const textChapters = parseImportedTextIntoChapters(doc.body.textContent || contentString);
    return { frontMatterData: {}, chapters: textChapters };
  }

  // Find all heading elements
  const headings = topElements.filter(el => /^h[1-6]$/i.test(el.tagName));

  // Check if explicit numbered chapters exist (e.g. "1. Introduction", "Chapter 1", "1. ")
  const hasNumberedChapters = headings.some(el => {
    const text = el.textContent.trim();
    return /^(chapter\s+\d+|\d+\.\s+[a-z]|\d+\s+[a-z])/i.test(text) && !/^\d+\.\d+/.test(text);
  });

  const isChapterHeading = (el) => {
    const tag = el.tagName.toLowerCase();
    const text = el.textContent.trim();
    if (!text) return false;

    // Multi-level numbers like "3.1", "3.2.1", "1.2" are subsections, NEVER chapters
    if (/^\d+\.\d+/.test(text)) return false;

    // Front matter keywords are NOT chapters
    const lower = text.toLowerCase();
    if (['abstract', 'table of contents', 'toc', 'title page', 'acknowledgement', 'acknowledgments', 'contents'].includes(lower)) {
      return false;
    }

    if (hasNumberedChapters) {
      // If numbered chapters exist, only numbered headings (or h1 matching chapter format) start a new chapter
      if (/^(chapter\s+\d+|\d+\.\s+[a-z]|\d+\s+[a-z])/i.test(text)) return true;
      if (tag === 'h1' && /^\d+/.test(text)) return true;
      return false;
    } else {
      // If no numbered chapters exist, any h1 (or h2 if no h1) triggers a new chapter
      const hasH1 = topElements.some(e => e.tagName.toLowerCase() === 'h1');
      if (hasH1) return tag === 'h1';
      return tag === 'h2';
    }
  };

  const isCoverPageHeading = (text) => {
    if (!text) return false;
    const clean = text.replace(/^chapter\s+\d+:?\s*/i, '').replace(/^\d+[\.\s]+\s*/, '').trim().toLowerCase();
    const cleanDef = defaultTitle.replace(/[-_]/g, ' ').trim().toLowerCase();
    const cleanRawDef = defaultTitle.trim().toLowerCase();

    if (clean === cleanDef || clean === cleanRawDef) return true;
    if (['title page', 'technical report', 'project report', 'cover page', 'report'].includes(clean)) return true;
    return false;
  };

  const chapters = [];
  const frontMatterData = {
    abstract: null,
    acknowledgement: null,
  };

  let currentTitle = null;
  let currentNodes = [];
  let currentFmKey = null;
  let currentFmNodes = [];
  let introNodesBeforeFirstChapter = [];

  const flushCurrent = () => {
    if (currentFmKey) {
      if (currentFmNodes.length > 0) {
        frontMatterData[currentFmKey] = {
          type: 'doc',
          content: [...currentFmNodes]
        };
      }
      currentFmNodes = [];
      currentFmKey = null;
    } else if (currentTitle) {
      // Check if currentTitle is a Cover Page / Title Block heading
      if (isCoverPageHeading(currentTitle)) {
        if (currentNodes.length > 0) {
          introNodesBeforeFirstChapter.push(...currentNodes);
        }
      } else if (currentNodes.length > 0) {
        // Strip leading "CHAPTER 1: " or "1. " so DocForge & LaTeX generate uniform chapter numbering
        const cleanTitle = currentTitle
          .replace(/^chapter\s+\d+:?\s*/i, '')
          .replace(/^\d+[\.\s]+\s*/, '')
          .replace(/^#+\s+/, '')
          .trim() || 'Chapter';

        chapters.push({
          title: cleanTitle,
          content: {
            type: 'doc',
            content: [...currentNodes]
          }
        });
      }
      currentNodes = [];
      currentTitle = null;
    } else if (currentNodes.length > 0) {
      // Header/intro text before the first chapter heading
      introNodesBeforeFirstChapter.push(...currentNodes);
      currentNodes = [];
    }
  };

  topElements.forEach((el) => {
    const text = el.textContent.trim();
    const lower = text.toLowerCase();

    // 1. Front Matter Extraction
    if (lower === 'abstract' || lower.startsWith('abstract:')) {
      flushCurrent();
      currentFmKey = 'abstract';
      return;
    }

    if (lower === 'acknowledgement' || lower === 'acknowledgments') {
      flushCurrent();
      currentFmKey = 'acknowledgement';
      return;
    }

    // Skip static Table of Contents
    if (lower === 'table of contents' || lower === 'contents' || lower === 'toc') {
      flushCurrent();
      return;
    }

    // 2. Real Chapter Heading Split
    if (isChapterHeading(el)) {
      flushCurrent();
      currentTitle = text;
      return;
    }

    // 3. Node Collection
    const node = htmlToTipTapNode(el);
    if (node) {
      if (currentFmKey) {
        currentFmNodes.push(node);
      } else {
        currentNodes.push(node);
      }
    }
  });

  flushCurrent();

  // Prepend intro nodes to Chapter 1 if they existed before Chapter 1 heading
  if (introNodesBeforeFirstChapter.length > 0 && chapters.length > 0) {
    chapters[0].content.content = [...introNodesBeforeFirstChapter, ...chapters[0].content.content];
  } else if (chapters.length === 0) {
    // Fallback if no chapters parsed
    const fallbackNodes = introNodesBeforeFirstChapter.length > 0
      ? introNodesBeforeFirstChapter
      : Array.from(topElements).map(htmlToTipTapNode).filter(Boolean);

    chapters.push({
      title: defaultTitle,
      content: {
        type: 'doc',
        content: fallbackNodes.length > 0 ? fallbackNodes : [{ type: 'paragraph', content: [] }]
      }
    });
  }

  return { frontMatterData, chapters };
}

export function parseImportedTextIntoChapters(text) {
  if (!text) return [];

  const lines = text.split('\n');
  const chapters = [];
  let currentChapterTitle = 'Introduction';
  let currentLines = [];

  const isHeading = (line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length > 80) return false;

    // Multi-level numbering (e.g. 3.1 Stator, 2.1.3 Details) are subsections, NOT chapters
    if (/^\d+\.\d+/.test(trimmed)) return false;

    if (/^#+\s+/.test(trimmed)) return true;

    // 1. All uppercase short headings (e.g. ABSTRACT, INTRODUCTION)
    const isShortUpper = trimmed === trimmed.toUpperCase() && trimmed.length < 50 && /[A-Z]/.test(trimmed);
    if (isShortUpper) return true;

    // 2. Chapter headings (e.g. Chapter 1, CHAPTER II)
    if (/^chapter\s+\d+/i.test(trimmed) || /^chapter\s+[ivxldcm]+/i.test(trimmed)) return true;

    // 3. Single-level numbering with Title Case (e.g. 1. Introduction, 2. Background)
    if (/^\d+[.)]\s+[A-Z][A-Za-z]*(\s+[A-Z][A-Za-z]*)*$/.test(trimmed)) return true;

    // 4. Common section names
    const commonSectionNames = [
      'abstract', 'introduction', 'overview', 'background', 'literature review',
      'methodology', 'methods', 'implementation', 'results', 'evaluation',
      'discussion', 'conclusion', 'conclusions', 'future work', 'references', 'appendix'
    ];
    if (commonSectionNames.includes(trimmed.toLowerCase())) return true;

    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isHeading(trimmed)) {
      const hasTextContent = currentLines.some(l => l.trim() !== '');
      if (hasTextContent || chapters.length > 0) {
        const chunkText = currentLines.join('\n');
        chapters.push({
          title: currentChapterTitle.replace(/^#+\s+/, ''),
          content: {
            type: 'doc',
            content: convertMarkdownToTipTapNodes(chunkText)
          }
        });
      }
      currentChapterTitle = trimmed;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  const hasTextContent = currentLines.some(l => l.trim() !== '');
  if (hasTextContent || chapters.length === 0) {
    const chunkText = currentLines.join('\n');
    chapters.push({
      title: currentChapterTitle.replace(/^#+\s+/, ''),
      content: {
        type: 'doc',
        content: convertMarkdownToTipTapNodes(chunkText)
      }
    });
  }

  return chapters;
}
