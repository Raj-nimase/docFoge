// Unicode → LaTeX symbol map
const UNICODE_MAP: Record<string, string> = {
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
export function extractLatex(formulaText: string) {
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
export function isSingleFormula(line: string) {
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
export function isPdfGarble(text: string) {
  const hasNoLatex     = !/\\[a-zA-Z]/.test(text);
  const hasSpacedChars = /[a-zA-Z] [a-zA-Z] [a-zA-Z]/.test(text);
  const hasMathSymbols = /[=\+\-\/\(\)]/.test(text);
  return hasNoLatex && hasSpacedChars && hasMathSymbols;
}

import { MathMLToLaTeX } from 'mathml-to-latex';

/**
 * Transforms clipboard HTML to replace <math> nodes with TipTap math spans,
 * strip heading prefixes, and remove <hr> / divider paragraphs.
 */
export function transformMathHtml(html: string) {
  if (!html) return html;

  // ── Cheap text-level gate ─────────────────────────────────────────────
  const hasMath    = html.includes('<math') || html.includes('katex');
  const hasHeading = /<h[1-6][>\s]/i.test(html);
  const hasHr      = html.includes('<hr');
  if (!hasMath && !hasHeading && !hasHr) return html;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // ── Single TreeWalker: collect all interesting nodes ─────────────────
    const mathNodes: Element[] = [];
    const headingNodes: Element[] = [];
    const katexNodes: Element[] = [];
    const toRemove: Element[] = [];  // <hr> and divider <p> elements

    const walker = document.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_ELEMENT,
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const el = node as Element;
      const tag = el.tagName;

      if (tag === 'MATH') {
        mathNodes.push(el);
      } else if (/^H[1-6]$/.test(tag)) {
        headingNodes.push(el);
      } else if (tag === 'HR') {
        toRemove.push(el);
      } else if (tag === 'P' && /^[-*_]{3,}$/.test(el.textContent?.trim() || '')) {
        toRemove.push(el);
      } else if (el.classList?.contains('katex-html')) {
        katexNodes.push(el);
      }
    }

    // ── Process headings ────────────────────────────────────────────────
    for (const headingEl of headingNodes) {
      const text = headingEl.textContent?.trim() || '';
      if (!text) continue;

      if (/^([a-zA-Z]|(?:i|ii|iii|iv|v|vi|vii|viii|ix|x))[.)]\s+/i.test(text)) {
        const p = doc.createElement('p');
        p.innerHTML = `<strong>${headingEl.innerHTML}</strong>`;
        headingEl.parentNode?.replaceChild(p, headingEl);
        continue;
      }

      const prefixMatch = text.match(/^(\d+(?:\.\d+)+)[^\S\n]+(.*)/);
      let headingText = text;
      if (prefixMatch) {
        headingText = prefixMatch[2].trim();
      }

      // Split heading and paragraph if it's too long
      const { heading, paragraph } = splitHeadingAndParagraph(headingText);
      headingEl.textContent = heading;

      if (paragraph.trim()) {
        const p = doc.createElement('p');
        p.textContent = paragraph;

        if (headingEl.nextSibling) {
          headingEl.parentNode?.insertBefore(p, headingEl.nextSibling);
        } else {
          headingEl.parentNode?.appendChild(p);
        }
      }
    }

    // ── Process MathML ──────────────────────────────────────────────────
    if (hasMath) {
      for (const mathNode of mathNodes) {
        try {
          let latex = '';
          const annotation = mathNode.querySelector('annotation[encoding="application/x-tex"]');
          if (annotation && annotation.textContent) {
            latex = annotation.textContent;
          } else {
            latex = MathMLToLaTeX.convert(mathNode.outerHTML);
          }

          const cleanLatex = extractLatex(latex);
          const span = doc.createElement('span');
          span.setAttribute('data-latex', cleanLatex);
          mathNode.parentNode?.replaceChild(span, mathNode);
        } catch (e) {
          console.error('MathML convert error:', e);
        }
      }

      for (const node of katexNodes) node.remove();
    }

    // ── Remove <hr> and divider <p> ─────────────────────────────────────
    for (const node of toRemove) node.remove();

    const finalHtml = doc.body ? doc.body.innerHTML : doc.documentElement.outerHTML;
    return finalHtml;

  } catch (err) {
    console.error('transformMathHtml error:', err);
    return html;
  }
}

function splitHeadingAndParagraph(text: string) {
  const words = text.split(/\s+/);
  if (words.length <= 15) {
    return { heading: text, paragraph: '' };
  }
  return {
    heading: words.slice(0, 15).join(' ') + '...',
    paragraph: words.slice(15).join(' ')
  };
}

export function handleRichPaste(view: any, event: ClipboardEvent, editor: any): boolean {
  if (!event.clipboardData) return false;

  const html = event.clipboardData.getData('text/html');
  const text = event.clipboardData.getData('text/plain');

  if (html) {
    const transformed = transformMathHtml(html);
    if (transformed !== html) {
      editor.commands.insertContent(transformed);
      return true;
    }
  }

  if (text && isSingleFormula(text)) {
    const latex = extractLatex(text);
    editor.commands.insertContent({
      type: 'math',
      attrs: { latex, display: true }
    });
    return true;
  }

  return false;
}
