const API_BASE = 'https://docfoge.onrender.com/api';

// Unicode → LaTeX symbol map
const UNICODE_MAP = {
  'π': '\\pi ',
  'α': '\\alpha ',
  'β': '\\beta ',
  'θ': '\\theta ',
  'σ': '\\sigma ',
  'μ': '\\mu ',
  '√': '\\sqrt ',
  '∞': '\\infty ',
  '±': '\\pm ',
  '×': '\\times ',
  '÷': '\\div ',
  '≤': '\\leq ',
  '≥': '\\geq ',
  '≠': '\\neq ',
  '²': '^2',
  '³': '^3',
  '∂': '\\partial ',
  '∇': '\\nabla ',
  'λ': '\\lambda ',
  'γ': '\\gamma ',
  'δ': '\\delta ',
  'ε': '\\epsilon ',
  'φ': '\\phi ',
  'ψ': '\\psi ',
  'ω': '\\omega ',
};

/**
 * Extracts clean LaTeX from a single formula string.
 * Only called on content already known to be a formula.
 */
export function extractLatex(formulaText) {
  let cleaned = formulaText.trim();

  // Map unicode symbols to LaTeX commands
  for (const [unicode, latex] of Object.entries(UNICODE_MAP)) {
    cleaned = cleaned.replaceAll(unicode, latex);
  }

  return cleaned;
}

/**
 * Checks if a SINGLE LINE looks like a standalone math formula.
 * MUST be conservative — headings, bullets, and prose should NOT match.
 */
export function isSingleFormula(line) {
  const trimmed = line.trim();

  // Skip empty lines
  if (!trimmed) return false;

  // Skip lines that look like markdown headings, bullets, or prose
  if (/^#{1,6}\s/.test(trimmed)) return false;      // ## Heading
  if (/^[-*]\s/.test(trimmed)) return false;          // - bullet
  if (/^---+$/.test(trimmed)) return false;           // --- divider
  if (trimmed.split(/\s+/).length > 15) return false; // prose sentences

  // It IS a formula if it's wrapped in $...$
  if (/^\$[\s\S]+?\$$/.test(trimmed)) return true;

  // It IS a formula if it's wrapped in \(...\) or \[...\]
  if (/^\\\[(\[][\s\S]+?\\\[)\]]$/.test(trimmed)) return true;

  // It IS a formula if it's a short expression with LaTeX commands
  // (e.g. "x = \dfrac{-b}{2a}") but NOT a sentence that happens to
  // contain a backslash
  if (/\\[a-zA-Z]+\{/.test(trimmed) && trimmed.length < 200) return true;

  // It IS a formula if it contains explicit math unicode and is short
  if (/[π√∫²³±×÷≤≥≠∞]/.test(trimmed) && trimmed.length < 100) return true;

  return false;
}

/**
 * PDF math garble often has random spaces between chars, mixed case, no LaTeX.
 */
export function isPdfGarble(text) {
  const hasNoLatex     = !/\\[a-zA-Z]/.test(text);
  const hasSpacedChars = /[a-zA-Z] [a-zA-Z] [a-zA-Z]/.test(text);
  const hasMathSymbols = /[=\+\-\/\(\)]/.test(text);
  return hasNoLatex && hasSpacedChars && hasMathSymbols;
}

import { MathMLToLaTeX } from 'mathml-to-latex';

/**
 * Transforms clipboard HTML to replace <math> nodes with TipTap math spans.
 * This hooks into ProseMirror's transformPastedHTML so it doesn't break normal text pasting.
 */
export function transformMathHtml(html) {
  if (!html) return html;

  const hasMath = html.includes('<math') || html.includes('katex');
  const hasHeading = /<h[1-6][>\s]/i.test(html);
  if (!hasMath && !hasHeading) return html;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Process HTML headings to prevent giant headings and strip number prefixes
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(headingEl => {
      let text = headingEl.textContent.trim();
      if (!text) return;

      // 1. Strip section prefixes like "3.1 " or "2.4.1 "
      const prefixMatch = text.match(/^(\d+(?:\.\d+)+)[^\S\n]+(.*)/);
      if (prefixMatch) {
        text = prefixMatch[2].trim();
      }

      // 2. Split heading and paragraph if it's too long
      const { heading, paragraph } = splitHeadingAndParagraph(text);
      headingEl.textContent = heading;

      if (paragraph.trim()) {
        const p = doc.createElement('p');
        p.textContent = paragraph;
        
        // Insert the paragraph right after the heading element
        if (headingEl.nextSibling) {
          headingEl.parentNode.insertBefore(p, headingEl.nextSibling);
        } else {
          headingEl.parentNode.appendChild(p);
        }
      }
    });
    
    // Process MathML
    if (hasMath) {
      const mathNodes = doc.querySelectorAll('math');
      mathNodes.forEach(mathNode => {
        try {
          let latex = '';
          // KaTeX and some other renderers embed the raw LaTeX inside an annotation tag
          const annotation = mathNode.querySelector('annotation[encoding="application/x-tex"]');
          if (annotation && annotation.textContent) {
            latex = annotation.textContent;
          } else {
            // Fallback for Word/Docs standard MathML
            latex = MathMLToLaTeX.convert(mathNode.outerHTML);
          }

          const cleanLatex = extractLatex(latex);
          const span = doc.createElement('span');
          span.setAttribute('data-latex', cleanLatex);
          mathNode.parentNode.replaceChild(span, mathNode);
        } catch (e) {
          console.error('MathML convert error:', e);
        }
      });

      // Remove KaTeX garbage
      const katexHtmlNodes = doc.querySelectorAll('.katex-html');
      katexHtmlNodes.forEach(node => node.remove());
    }

    const finalHtml = doc.body ? doc.body.innerHTML : doc.documentElement.outerHTML;

    // Send debug info to backend (fire and forget)
    fetch(`${API_BASE}/debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: `ORIGINAL:\n${html}\n\nTRANSFORMED:\n${finalHtml}` })
    }).catch(() => {});

    return finalHtml;

  } catch (err) {
    console.error('Failed to transform math HTML:', err);
  }
  
  return html;
}

export function normalizeListText(text) {
  let normalized = text;
  
  // 1. Add newlines and indent before inline bullets (e.g. " • ") to ensure they nest properly
  normalized = normalized.replace(/([^\n])[^\S\n]+([•◦▪*\-])[^\S\n]+/g, '$1\n    $2 ');
  
  // 2. Add newlines before inline numbered items (e.g. " 2.Working")
  normalized = normalized.replace(/([^\n])[^\S\n]+(\d+\.)\s*([a-zA-Z])/g, '$1\n$2 $3');

  // 3. Normalize the very start of the string if it's a number without space (e.g. "1.Specifications")
  normalized = normalized.replace(/^([^\S\n]*)(\d+\.)\s*([a-zA-Z])/gm, '$1$2 $3');
  
  // 4. Add newlines before section headings (e.g. " 2.4 Modern")
  normalized = normalized.replace(/([^\n])[^\S\n]+(\d+(?:\.\d+)+)[^\S\n]+([A-Z])/g, '$1\n$2 $3');
  
  return normalized;
}

function splitHeadingAndParagraph(text) {
  const stopWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'with', 'of', 'in', 'as']);
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return { heading: text, paragraph: '' };

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

  const heading = words.slice(0, splitIdx).join(' ');
  const paragraph = words.slice(splitIdx).join(' ');
  return { heading, paragraph };
}

export function textToHtmlList(text) {
  const normalizedText = normalizeListText(text);
  const lines = normalizedText.split('\n');
  let html = '';
  
  // Stack tracks open lists: { type: 'ul' | 'ol', indent: number }
  const stack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }

    const indentMatch = line.match(/^([^\S\n]*)/);
    const indent = indentMatch[1].replace(/\t/g, '    ').length;
    
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
      // Close all open lists when encountering a section heading
      while (stack.length > 0) {
        html += `</li></${stack.pop().type}>`;
      }
      
      const sectionNum = sectionMatch[1]; // e.g., "2.3" or "2.3.1"
      const sectionText = sectionMatch[2];
      const dots = (sectionNum.match(/\./g) || []).length;
      
      // h2 for 1 dot (X.Y), h3 for 2 dots (X.Y.Z)
      const level = Math.min(6, dots + 1); 
      
      const { heading, paragraph } = splitHeadingAndParagraph(sectionText);
      console.log('[DEBUG] Split heading successfully:', { heading, paragraph, level });
      html += `<h${level}>${heading}</h${level}>`;
      
      if (paragraph.trim()) {
        html += `<p>${paragraph.trim()}</p>`;
      }
      continue;
    }

    if (bulletMatch || numberMatch) {
      const type = bulletMatch ? 'ul' : 'ol';
      const content = bulletMatch ? bulletMatch[2] : numberMatch[2];
      
      // Close deeper lists
      while (stack.length > 0 && indent < stack[stack.length - 1].indent) {
        html += `</li></${stack.pop().type}>`;
      }
      
      if (stack.length === 0 || indent > stack[stack.length - 1].indent) {
        // Open new list
        stack.push({ type, indent });
        html += `<${type}>`;
      } else if (stack.length > 0 && indent === stack[stack.length - 1].indent) {
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
  const lines = normalizedText.split('\n');
  return lines.some(line => {
    return /^[^\S\n]*[•◦▪*\-][^\S\n]+/.test(line) || 
           /^[^\S\n]*\d+\.[^\S\n]+/.test(line) || 
           /^[^\S\n]*\d+\.[a-zA-Z]/.test(line) ||
           /^[^\S\n]*\d+(?:\.\d+)+[^\S\n]+/.test(line);
  });
}

export function handleRichPaste(view, event, editor) {
  const plainText = event.clipboardData?.getData('text/plain') || '';
  const htmlText = event.clipboardData?.getData('text/html') || '';

  // Priority 3: Garbled LaTeX or short unicode formulas from web/Claude
  // Only intercept if the ENTIRE paste looks like a single formula.
  // Mixed text should be handled by default TipTap paste rules.
  if (isSingleFormula(plainText)) {
    event.preventDefault();
    let formula = plainText.trim();
    const dollarMatch = formula.match(/^\$([\s\S]+?)\$$/);
    if (dollarMatch) {
      formula = dollarMatch[1].trim();
    }
    const cleanLatex = extractLatex(formula);

    const { state, dispatch } = view;
    const mathNode = state.schema.nodes.math?.create({ latex: cleanLatex });
    if (mathNode) {
      dispatch(state.tr.replaceSelectionWith(mathNode));
      return true;
    }
  }

  // Priority 4: Plain text with bullet points or numbered lists (PDF copy/paste)
  // Many PDF viewers (like Chrome) inject flat <p> or <span> tags without actual list structure into text/html.
  // If the HTML lacks actual semantic list tags, but the plain text looks like a list, 
  // we intercept and use our smart list parser!
  const hasSemanticHtmlList = /<(ul|ol|li)[>\s]/i.test(htmlText);
  const isSquashedList = !plainText.includes('\n') && looksLikeList(plainText);

  if (isSquashedList || ((!htmlText || !hasSemanticHtmlList) && plainText && looksLikeList(plainText))) {
    event.preventDefault();
    const html = textToHtmlList(plainText);
    editor.commands.insertContent(html);
    return true;
  }

  return false;
}
