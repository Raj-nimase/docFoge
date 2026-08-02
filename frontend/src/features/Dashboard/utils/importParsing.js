// Import-document parsing utilities extracted from DashboardHomePage.jsx
// (pure move — no logic changes). Converts uploaded document text into
// TipTap-compatible chapter structures.
import { parseMarkdownMathToHtml } from '@/hooks/useMathPaste/markdownParser';

function parseInlineTextAndMath(el) {

  const nodes = [];
  el.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.nodeValue) {
        nodes.push({ type: 'text', text: child.nodeValue });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'span' && child.hasAttribute('data-latex')) {
        nodes.push({
          type: 'math',
          attrs: { latex: child.getAttribute('data-latex') || '', display: false }
        });
      } else if (tag === 'img') {
        nodes.push({
          type: 'image',
          attrs: { src: child.getAttribute('src') || '', alt: child.getAttribute('alt') || '' }
        });
      } else if (tag === 'strong' || tag === 'b') {
        nodes.push({ type: 'text', text: child.textContent || '', marks: [{ type: 'bold' }] });
      } else if (tag === 'em' || tag === 'i') {
        nodes.push({ type: 'text', text: child.textContent || '', marks: [{ type: 'italic' }] });
      } else if (tag === 'code') {
        nodes.push({ type: 'text', text: child.textContent || '', marks: [{ type: 'code' }] });
      } else {
        if (child.textContent) {
          nodes.push({ type: 'text', text: child.textContent });
        }
      }
    }
  });
  return nodes;
}

function htmlToTipTapNode(el) {
  if (!el || !el.tagName) return null;
  const tag = el.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    const level = parseInt(tag.slice(1), 10);
    return {
      type: 'heading',
      attrs: { level },
      content: parseInlineTextAndMath(el)
    };
  }

  if (tag === 'p') {
    const inlineNodes = parseInlineTextAndMath(el);
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
    const items = Array.from(el.children).map(htmlToTipTapNode).filter(Boolean);
    return { type: 'orderedList', content: items };
  }

  if (tag === 'li') {
    const childNodes = Array.from(el.children).map(htmlToTipTapNode).filter(Boolean);
    const inlineNodes = parseInlineTextAndMath(el);
    const content = childNodes.length > 0 ? childNodes : [{ type: 'paragraph', content: inlineNodes }];
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
        content: [{ type: 'paragraph', content: parseInlineTextAndMath(cell) }]
      }))
    }));
    return { type: 'table', content: rows };
  }

  const inlineNodes = parseInlineTextAndMath(el);
  return { type: 'paragraph', content: inlineNodes };
}

function convertMarkdownToTipTapNodes(markdownText) {
  if (!markdownText) return [];
  const htmlStr = parseMarkdownMathToHtml(markdownText);
  const container = document.createElement('div');
  container.innerHTML = htmlStr;
  const nodes = Array.from(container.children).map(htmlToTipTapNode).filter(Boolean);
  return nodes.length > 0 ? nodes : [{ type: 'paragraph', content: [] }];
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

    if (/^#+\s+/.test(trimmed)) return true;

    // 1. All uppercase short headings (e.g. ABSTRACT, INTRODUCTION)
    const isShortUpper = trimmed === trimmed.toUpperCase() && trimmed.length < 50 && /[A-Z]/.test(trimmed);
    if (isShortUpper) return true;

    // 2. Chapter headings (e.g. Chapter 1, CHAPTER II)
    if (/^chapter\s+\d+/i.test(trimmed) || /^chapter\s+[ivxldcm]+/i.test(trimmed)) return true;

    // 3. Multi-level numbering (e.g. 1.1 Background, 2.1.3 Details)
    if (/^\d+\.\d+(\.\d+)*\.?\s+[A-Za-z]/.test(trimmed)) return true;

    // 4. Single-level numbering with Title Case
    if (/^\d+[.)]\s+[A-Z][A-Za-z]*(\s+[A-Z][A-Za-z]*)*$/.test(trimmed)) return true;

    // 5. Common section names
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
