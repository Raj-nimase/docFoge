import {
  extractLatex,
  isSingleFormula,
  convUnicodeMath,
  sanitizeLatex,
  stripUnknownChars,
  normalizeLatexPaste,
} from "./mathUtils";
import { transformMathHtml, extractMarkdownFromHtml } from "./htmlParser";
import { reconstructPdfParagraphs } from "./pdfParser";
import { textToHtmlList, looksLikeList } from "./listParser";
import {
  parseMarkdownMathToHtml,
  looksLikeMarkdownMath,
} from "./markdownParser";

import { DOMParser as PMDOMParser } from "prosemirror-model";

function insertHtmlContent(view, editor, html) {
  if (editor?.commands?.insertContent) {
    // insertContent defaults to preserveWhitespace: 'full', which turns the
    // raw newlines inside pasted HTML (e.g. "<li>\nPseudocode\n</li>") into
    // extra blank lines. Collapse whitespace like a normal HTML parse instead.
    editor.commands.insertContent(html, {
      parseOptions: { preserveWhitespace: false },
    });
    return;
  }
  const container = document.createElement("div");
  container.innerHTML = html;
  // parseSlice preserves whitespace by default — collapse it so newlines
  // between tags ("<li>\nText\n</li>") don't become extra blank lines.
  const slice = PMDOMParser.fromSchema(view.state.schema).parseSlice(
    container,
    { preserveWhitespace: false },
  );
  const tr = view.state.tr.replaceSelection(slice);
  view.dispatch(tr);
}

export function handleRichPaste(view, event, editor) {
  const rawText = (event.clipboardData?.getData("text/plain") || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const htmlText = event.clipboardData?.getData("text/html") || "";

  if (!rawText && !htmlText) return false;

  // Pre-process: convert setext-style headings (text\n===) to ATX-style (# text)
  // This must happen BEFORE normalizeLatexPaste to prevent === lines from being
  // joined with math content. Only converts when the text line is NOT math/LaTeX.
  const convertSetextHeadings = (text) => {
    return text.replace(
      /^([^\n]+)\n(={3,}|-{3,})$/gm,
      (match, textLine, underline) => {
        const trimmedText = textLine.trim();
        // Don't convert if the text line looks like math/LaTeX
        if (/\\[a-zA-Z]/.test(trimmedText) || /[\^_]/.test(trimmedText) ||
            /[√∑∏∫∞±≤≥≠×÷∈∂]/.test(trimmedText) || /^(Coverage|DRE|MSE|AccessTime|P\(A\|B\)|SEEK|ROTATION|TRANSFER)/i.test(trimmedText)) {
          // For math lines, convert setext underline to = or -
          return `${trimmedText} ${underline[0] === "=" ? "=" : "-"}`;
        }
        const prefix = underline[0] === "=" ? "#" : "##";
        return `${prefix} ${trimmedText}`;
      }
    );
  };

  const preProcessedText = convertSetextHeadings(rawText);

  // Normalize multi-line raw LaTeX pastes into a single unified formula string first
  const plainText = normalizeLatexPaste(preProcessedText);

  const htmlHasRealMath = /<math[\s>]|class=["']?[^"']*katex/i.test(htmlText);

  // Case 1: Clipboard contains MathML or KaTeX math in HTML
  if (htmlText && htmlHasRealMath) {
    event.preventDefault();
    const transformedHtml = transformMathHtml(htmlText);
    insertHtmlContent(view, editor, transformedHtml);
    return true;
  }

  // Case 2: Plain text contains math formulas ($, \[, $$, math fences, LaTeX commands)
  if (looksLikeMarkdownMath(plainText)) {
    event.preventDefault();
    const cleanPlainText = plainText.includes("\n")
      ? plainText
      : reconstructPdfParagraphs(plainText);
    const resultHtml = parseMarkdownMathToHtml(cleanPlainText);
    insertHtmlContent(view, editor, resultHtml);
    return true;
  }

  // Case 3: Single standalone formula string
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

  // Case 4: Squashed list from PDF text paste
  const hasSemanticHtmlList = /<(ul|ol|li)[>\s]/i.test(htmlText);
  const isSquashedList = !plainText.includes("\n") && looksLikeList(plainText);

  if (
    isSquashedList ||
    ((!htmlText || !hasSemanticHtmlList) &&
      plainText &&
      looksLikeList(plainText) &&
      !htmlText.includes("<p>"))
  ) {
    event.preventDefault();
    const html = textToHtmlList(plainText);
    insertHtmlContent(view, editor, html);
    return true;
  }

  // Fallback: Let TipTap handle standard HTML / Markdown / plain-text pastes natively
  return false;
}

export {
  extractLatex,
  isSingleFormula,
  transformMathHtml,
  sanitizeLatex,
  convUnicodeMath,
  stripUnknownChars,
};
