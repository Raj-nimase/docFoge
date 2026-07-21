import { API_BASE_URL } from "@/services/api";
import { MathMLToLaTeX } from "mathml-to-latex";
import { extractLatex } from "./mathUtils";
import { splitHeadingAndParagraph } from "./listParser";

const API_BASE = API_BASE_URL;

/**
 * Transforms clipboard HTML to replace <math> nodes with TipTap math spans,
 * strip heading prefixes, remove <hr> / divider paragraphs, and convert
 * inline CSS styles (font-weight, font-style, text-decoration) into semantic tags.
 */
export function transformMathHtml(html) {
  if (!html) return html;

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // ── Convert inline CSS styles into semantic tags ───────────────────────
    const styledNodes = doc.querySelectorAll("[style]");
    styledNodes.forEach((node) => {
      const style = node.getAttribute("style") || "";

      const isBold = /font-weight\s*:\s*(bold|bolder|[6-9]\d{2})/i.test(style);
      const isItalic = /font-style\s*:\s*(italic|oblique)/i.test(style);
      const isUnderline = /text-decoration\s*:\s*[^;]*underline/i.test(style);
      const isStrikethrough = /text-decoration\s*:\s*[^;]*line-through/i.test(style);

      if (isBold && !node.closest("strong, b")) {
        const strong = doc.createElement("strong");
        while (node.firstChild) strong.appendChild(node.firstChild);
        node.appendChild(strong);
      }

      if (isItalic && !node.closest("em, i")) {
        const em = doc.createElement("em");
        while (node.firstChild) em.appendChild(node.firstChild);
        node.appendChild(em);
      }

      if (isUnderline && !node.closest("u")) {
        const u = doc.createElement("u");
        while (node.firstChild) u.appendChild(node.firstChild);
        node.appendChild(u);
      }

      if (isStrikethrough && !node.closest("s, del, strike")) {
        const s = doc.createElement("s");
        while (node.firstChild) s.appendChild(node.firstChild);
        node.appendChild(s);
      }
    });

    const hasMath = html.includes("<math") || html.includes("katex");

    // ── Single TreeWalker: collect all interesting nodes ─────────────────
    const mathNodes = [];
    const headingNodes = [];
    const katexNodes = [];
    const toRemove = []; // <hr> and divider <p> elements

    const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);

    let node;
    while ((node = walker.nextNode())) {
      const tag = node.tagName;

      // MathML elements keep a lowercase tagName ("math") because DOMParser
      // assigns them the MathML namespace — match case-insensitively.
      if (tag.toUpperCase() === "MATH") {
        mathNodes.push(node);
      } else if (/^H[1-6]$/.test(tag)) {
        headingNodes.push(node);
      } else if (tag === "HR") {
        toRemove.push(node);
      } else if (tag === "P" && /^[-*_]{3,}$/.test(node.textContent.trim())) {
        toRemove.push(node);
      } else if (node.classList?.contains("katex-html")) {
        katexNodes.push(node);
      }
    }

    // ── Process headings (math-heading rescue + list-item demotion) ──────
    for (const headingEl of headingNodes) {
      if (!headingEl.isConnected) continue;
      const text = headingEl.textContent.trim();
      if (!text) continue;

      // ChatGPT renders an un-rendered display-math block's setext underline
      // as a heading: "<h1>[<br>\mathrm{Attention}(Q,K,V)</h1>" followed by
      // "<p>\mathrm{softmax}…<br>]</p>". Rebuild the equation as display math
      // instead of keeping raw LaTeX as a document heading.
      const startsFence = text.startsWith("[");
      const hasLatexCmd = /\\[a-zA-Z]{2,}/.test(text);
      const next = headingEl.nextElementSibling;
      const nextClosesFence =
        startsFence &&
        next &&
        next.tagName.toUpperCase() === "P" &&
        /\]\s*$/.test(next.textContent);
      if (hasLatexCmd || (startsFence && (/[\\^_{}]/.test(text) || nextClosesFence))) {
        headingEl.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
        const lhs = headingEl.textContent.trim().replace(/^\[\s*/, "");
        // The setext underline the heading came from encodes an operator:
        // H1 ("===") means "=", H2 ("---") means "-".
        const op = headingEl.tagName.toUpperCase() === "H2" ? "-" : "=";
        let rhs = "";
        if (startsFence && next && next.tagName.toUpperCase() === "P") {
          next.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
          const nextText = next.textContent.trim();
          if (/\]$/.test(nextText)) {
            rhs = nextText.replace(/\]$/, "").trim();
            next.remove();
          }
        }
        const latex = (rhs ? `${lhs} ${op} ${rhs}` : lhs)
          .replace(/\s+/g, " ")
          .trim();
        const p = doc.createElement("p");
        const span = doc.createElement("span");
        span.setAttribute("data-latex", extractLatex(latex));
        span.setAttribute("data-display", "true");
        p.appendChild(span);
        headingEl.replaceWith(p);
        continue;
      }

      // If a heading tag is wrapping a list marker like "a) " or "i. ", demote to paragraph
      if (/^([a-zA-Z]|(?:i|ii|iii|iv|v|vi|vii|viii|ix|x))[.)]\s+/i.test(text)) {
        const p = doc.createElement("p");
        p.innerHTML = `<strong>${headingEl.innerHTML}</strong>`;
        headingEl.parentNode.replaceChild(p, headingEl);
      }
    }

    // ── Process MathML ──────────────────────────────────────────────────
    if (hasMath) {
      // KaTeX HTML: replace the entire .katex-display/.katex wrapper with a
      // single <span data-latex> so no visual-duplicate markup leaks through.
      doc.querySelectorAll(".katex-display, .katex").forEach((el) => {
        if (!el.isConnected) return; // already replaced via a parent element
        const ann = el.querySelector('annotation[encoding="application/x-tex"]');
        if (ann) {
          // .katex-display wrappers (and MathML display="block") are block
          // equations — mark them so TipTap renders each on its own line,
          // matching the markdown-paste (Format 2) output.
          const isDisplay =
            el.classList.contains("katex-display") ||
            !!el.querySelector('math[display="block"]');
          const span = doc.createElement("span");
          span.setAttribute(
            "data-latex",
            extractLatex(ann.textContent.trim()).replace(/\s+/g, " "),
          );
          if (isDisplay) span.setAttribute("data-display", "true");
          el.replaceWith(span);
        }
      });

      // Non-KaTeX MathML (Word / Google Docs): replace remaining <math> nodes
      for (const mathNode of mathNodes) {
        if (!mathNode.isConnected) continue;
        try {
          const annotation = mathNode.querySelector(
            'annotation[encoding="application/x-tex"]',
          );
          const latex = annotation?.textContent
            ? annotation.textContent
            : MathMLToLaTeX.convert(mathNode.outerHTML);
          const span = doc.createElement("span");
          span.setAttribute(
            "data-latex",
            extractLatex(latex).replace(/\s+/g, " ").trim(),
          );
          if (mathNode.getAttribute("display") === "block") {
            span.setAttribute("data-display", "true");
          }
          mathNode.parentNode.replaceChild(span, mathNode);
        } catch (e) {
          console.error("MathML convert error:", e);
        }
      }

      // Safety-net: remove any .katex-html nodes that weren't caught above
      for (const node of katexNodes) {
        if (node.isConnected) node.remove();
      }

      // Wrap each display-math span in its own <p>. The math node is inline
      // in the TipTap schema, so bare sibling spans would otherwise be merged
      // into a single paragraph (all formulas on one line). Wrapping each one
      // matches the markdown-paste output where every display equation gets
      // its own paragraph.
      doc.querySelectorAll('span[data-display="true"]').forEach((span) => {
        const parent = span.parentElement;
        if (!parent) return;
        const parentTag = parent.tagName;
        const isAlone =
          parentTag === "P" &&
          parent.childNodes.length === 1 &&
          parent.firstChild === span;
        if (isAlone) return; // already alone in its own paragraph
        const p = doc.createElement("p");
        span.replaceWith(p);
        p.appendChild(span);
      });
    }

    // ── Remove <hr> and divider <p> ─────────────────────────────────────
    for (const node of toRemove) node.remove();

    // ── Sanitize <pre> blocks from ChatGPT / Sider.ai clipboard ─────────
    // ChatGPT/Sider.ai clipboard HTML wraps code blocks in <pre> containing
    // header divs (language labels, copy buttons) and leading newlines.
    // Clean them so <pre> contains only the inner <code> content stripped of
    // leading and trailing empty lines.
    doc.querySelectorAll("pre").forEach((pre) => {
      const codeEl = pre.querySelector("code");
      const codeText = codeEl ? codeEl.textContent : pre.textContent;
      const lines = codeText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
      while (lines.length > 0 && lines[0].trim() === "") {
        lines.shift();
      }
      while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
        lines.pop();
      }
      const cleanText = lines.join("\n");
      const newCode = doc.createElement("code");
      const langClass = codeEl?.className || pre.className || "";
      if (langClass) newCode.className = langClass;
      newCode.textContent = cleanText;
      pre.innerHTML = "";
      pre.appendChild(newCode);
    });

    // ── Collapse stray whitespace between/inside tags ───────────────────
    // ChatGPT's clipboard HTML puts raw newlines around list-item text
    // ("<li>\nPseudocode\n</li>") and between sibling tags. ProseMirror's
    // clipboard parser preserves that whitespace, which renders as blank
    // lines around every list item. Normalise it here so the output is
    // identical to cleanly-generated HTML. <pre>/<code> are left untouched.
    const BLOCK_TAGS =
      /^(P|DIV|UL|OL|LI|H[1-6]|TABLE|THEAD|TBODY|TR|TD|TH|PRE|BLOCKQUOTE|HR|BR|SECTION|ARTICLE|FIGURE|FIGCAPTION)$/;
    const isBlockEl = (n) =>
      !!n && n.nodeType === 1 && BLOCK_TAGS.test(n.tagName.toUpperCase());
    const textWalker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let textNode;
    while ((textNode = textWalker.nextNode())) textNodes.push(textNode);
    for (const t of textNodes) {
      if (t.parentElement?.closest("pre, code")) continue;
      const atBlockStart = !t.previousSibling || isBlockEl(t.previousSibling);
      const atBlockEnd = !t.nextSibling || isBlockEl(t.nextSibling);
      if (!t.textContent.trim()) {
        // Whitespace-only node: drop it at block boundaries, otherwise keep
        // a single space so "<strong>A</strong> <em>B</em>" stays separated.
        if (atBlockStart || atBlockEnd) t.remove();
        else t.textContent = " ";
        continue;
      }
      let collapsed = t.textContent.replace(/\s+/g, " ");
      if (atBlockStart) collapsed = collapsed.replace(/^\s+/, "");
      if (atBlockEnd) collapsed = collapsed.replace(/\s+$/, "");
      if (collapsed !== t.textContent) t.textContent = collapsed;
    }

    const finalHtml = doc.body
      ? doc.body.innerHTML
      : doc.documentElement.outerHTML;

    // Send debug info to backend (fire and forget)
    fetch(`${API_BASE}/debug`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: `ORIGINAL:\n${html}\n\nTRANSFORMED:\n${finalHtml}`,
      }),
    }).catch(() => {});

    return finalHtml;
  } catch (err) {
    console.error("Failed to transform math HTML:", err);
  }

  return html;
}

export function extractMarkdownFromHtml(html, fallbackPlainText) {
  if (!html) return fallbackPlainText;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, meta, link").forEach(el => el.remove());

    let markdown = "";
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        markdown += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        if (tag === 'br') {
          markdown += "\n";
          return;
        }
        const style = node.getAttribute("style") || "";
        const isBold = tag === 'b' || tag === 'strong' || /font-weight\s*:\s*(bold|bolder|[6-9]\d{2})/i.test(style);
        const isItalic = tag === 'i' || tag === 'em' || /font-style\s*:\s*(italic|oblique)/i.test(style);
        
        let prefix = "";
        let suffix = "";
        if (isBold && isItalic) { prefix = "***"; suffix = "***"; }
        else if (isBold) { prefix = "**"; suffix = "**"; }
        else if (isItalic) { prefix = "*"; suffix = "*"; }
        
        if (/^h[1-6]$/.test(tag)) {
          const textContent = node.textContent.trim();
          if (/^(\[|\\\[|\$\$)/.test(textContent)) {
            markdown += "\n\n";
          } else {
            const level = parseInt(tag[1]);
            markdown += "\n\n" + "#".repeat(level) + " ";
          }
        }

        markdown += prefix;
        for (const child of node.childNodes) {
          walk(child);
        }
        markdown += suffix;
        
        if (/^(p|div|li|h[1-6]|tr)$/.test(tag)) {
          markdown += "\n";
        }
      }
    }
    
    walk(doc.body);
    
    if (markdown.trim().length < fallbackPlainText.trim().length * 0.5) {
      return fallbackPlainText;
    }
    
    let cleaned = markdown.replace(/\*\*(\s*)\*\*/g, '$1').replace(/\*(\s*)\*/g, '$1');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    return cleaned || fallbackPlainText;
  } catch (e) {
    return fallbackPlainText;
  }
}
