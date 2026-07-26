import { API_BASE_URL } from "../../services/api/index.js";
import { MathMLToLaTeX } from "mathml-to-latex";
import { extractLatex, convUnicodeMath } from "./mathUtils.js";
import { splitHeadingAndParagraph } from "./listParser.js";

const API_BASE = API_BASE_URL;

function getChildElement(node, targetTag) {
  if (!node || !node.childNodes) return null;
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1) {
      const tag = child.nodeName.toLowerCase().replace(/^.*:/, "");
      if (tag === targetTag) return child;
    }
  }
  return null;
}

function ommlToLatex(node) {
  if (!node) return "";

  if (node.nodeType === 3 /* TEXT_NODE */) {
    let t = node.textContent || "";
    return convUnicodeMath(t);
  }

  if (node.nodeType !== 1 /* ELEMENT_NODE */) {
    return "";
  }

  const tag = node.nodeName.toLowerCase().replace(/^.*:/, "");

  switch (tag) {
    case "omathpara":
    case "omath": {
      return Array.from(node.childNodes).map(ommlToLatex).join("");
    }

    case "f": {
      const numNode = getChildElement(node, "num");
      const denNode = getChildElement(node, "den");
      const numTex = numNode ? ommlToLatex(numNode) : "";
      const denTex = denNode ? ommlToLatex(denNode) : "";
      return `\\frac{${numTex}}{${denTex}}`;
    }

    case "num":
    case "den":
    case "e":
    case "sub":
    case "sup":
    case "fname": {
      return Array.from(node.childNodes).map(ommlToLatex).join("");
    }

    case "ssub": {
      const eNode = getChildElement(node, "e");
      const subNode = getChildElement(node, "sub");
      const eTex = eNode ? ommlToLatex(eNode) : "";
      const subTex = subNode ? ommlToLatex(subNode) : "";
      return `{${eTex}}_{${subTex}}`;
    }

    case "ssup": {
      const eNode = getChildElement(node, "e");
      const supNode = getChildElement(node, "sup");
      const eTex = eNode ? ommlToLatex(eNode) : "";
      const supTex = supNode ? ommlToLatex(supNode) : "";
      return `{${eTex}}^{${supTex}}`;
    }

    case "ssubsup": {
      const eNode = getChildElement(node, "e");
      const subNode = getChildElement(node, "sub");
      const supNode = getChildElement(node, "sup");
      const eTex = eNode ? ommlToLatex(eNode) : "";
      const subTex = subNode ? ommlToLatex(subNode) : "";
      const supTex = supNode ? ommlToLatex(supNode) : "";
      return `{${eTex}}_{${subTex}}^{${supTex}}`;
    }

    case "rad": {
      const eNode = getChildElement(node, "e");
      const degNode = getChildElement(node, "deg");
      const eTex = eNode ? ommlToLatex(eNode) : "";
      const degTex = degNode ? ommlToLatex(degNode) : "";
      return degTex ? `\\sqrt[${degTex}]{${eTex}}` : `\\sqrt{${eTex}}`;
    }

    case "d": {
      const eNode = getChildElement(node, "e");
      const eTex = eNode ? ommlToLatex(eNode) : "";
      return `\\left( ${eTex} \\right)`;
    }

    case "nary": {
      const subNode = getChildElement(node, "sub");
      const supNode = getChildElement(node, "sup");
      const eNode = getChildElement(node, "e");
      const subTex = subNode ? ommlToLatex(subNode) : "";
      const supTex = supNode ? ommlToLatex(supNode) : "";
      const eTex = eNode ? ommlToLatex(eNode) : "";
      return `\\sum_{${subTex}}^{${supTex}} {${eTex}}`;
    }

    case "t": {
      let tText = node.textContent || "";
      return convUnicodeMath(tText);
    }

    default: {
      return Array.from(node.childNodes).map(ommlToLatex).join("");
    }
  }
}

function convertOmmlInHtml(rawHtml) {
  if (!rawHtml) return "";

  let processedHtml = rawHtml.replace(
    /<!--\[if\s+gte\s+msEquation[\s\S]*?-->([\s\S]*?)<!--<!\[endif\]-->|<!--\[if\s+gte\s+msEquation[\s\S]*?<!\[endif\]-->/gi,
    (match) => {
      const cleanXml = match
        .replace(/<!--\[if[^\]]*\]>/gi, "")
        .replace(/<!\[endif\]-->/gi, "")
        .replace(/<!\[if[^\]]*\]>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .trim();

      if (!cleanXml) return "";

      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(
          `<root xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${cleanXml}</root>`,
          "text/xml",
        );
        const oMath =
          doc.getElementsByTagName("m:oMathPara")[0] ||
          doc.getElementsByTagName("m:oMath")[0] ||
          doc.getElementsByTagName("oMathPara")[0] ||
          doc.getElementsByTagName("oMath")[0] ||
          doc.documentElement;

        if (oMath) {
          const latex = ommlToLatex(oMath).replace(/\s+/g, " ").trim();
          if (latex) {
            return `<p><span data-latex="${extractLatex(latex)}" data-display="true"></span></p>`;
          }
        }
      } catch (e) {
        console.error("Failed to parse OMML equation:", e);
      }
      return "";
    },
  );

  processedHtml = processedHtml.replace(
    /<!--\[if\s+!msEquation\]-->[\s\S]*?<!--<!\[endif\]-->|<!\[if\s+!msEquation\]>[\s\S]*?<!\[endif\]>/gi,
    "",
  );

  return processedHtml;
}

function cleanMsOfficeHtml(rawHtml) {
  if (!rawHtml) return "";
  let cleaned = convertOmmlInHtml(rawHtml);
  cleaned = cleaned.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "");
  cleaned = cleaned
    .replace(/<o:p\b[^>]*>[\s\S]*?<\/o:p>/gi, "")
    .replace(/<xml\b[^>]*>[\s\S]*?<\/xml>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*>/gi, "");
  return cleaned;
}

function transformWordListParagraphs(doc) {
  doc.querySelectorAll("[style*='mso-list:Ignore'], span.mso-list-ignore").forEach((el) => {
    el.remove();
  });

  const allBlocks = Array.from(doc.querySelectorAll("p, div, p.MsoListParagraph"));
  const listItems = [];

  allBlocks.forEach((el) => {
    if (!el.isConnected) return;
    const className = el.className || "";
    const style = el.getAttribute("style") || "";
    const text = el.textContent.trim();
    if (!text) return;

    const isMsoList = /MsoListParagraph/i.test(className) || /mso-list\s*:/i.test(style);
    const hasBulletSymbol = /^[\u25CF\u2022\u25CB\u25A1\u25A0\u2013\u2014\u2212\uF0B7\u00B7\uF0A7*•-]\s*/.test(text);
    const hasNumberMarker = /^(\d+|[a-zA-Z]|[iIvVxX]+)[.)]\s+/.test(text);

    // Skip math expressions that start with - (e.g. -\sum, -\frac, -\int, -\nabla, -\alpha)
    // or contain LaTeX display math / closing bracket ]
    const isMathExpr = /^\s*-\\[a-zA-Z]/.test(text) || (/\\[a-zA-Z]{2,}/.test(text) && (text.includes("]") || text.includes("[")));
    if (isMathExpr && !isMsoList) return;

    if (isMsoList || hasBulletSymbol || hasNumberMarker) {
      let type = "ul";
      if (hasNumberMarker && !hasBulletSymbol && !isMsoList) {
        type = "ol";
      }
      listItems.push({ el, type });
    }
  });

  let i = 0;
  while (i < listItems.length) {
    const group = [listItems[i]];
    let j = i + 1;
    while (j < listItems.length) {
      const prevEl = listItems[j - 1].el;
      const currEl = listItems[j].el;
      if (prevEl.nextElementSibling === currEl || prevEl.nextSibling === currEl) {
        group.push(listItems[j]);
        j++;
      } else {
        break;
      }
    }

    if (group.length > 0) {
      const firstEl = group[0].el;
      const listType = group[0].type;
      const listEl = doc.createElement(listType);

      group.forEach(({ el }) => {
        const li = doc.createElement("li");
        let htmlContent = el.innerHTML.trim();
        htmlContent = htmlContent.replace(/^([\u25CF\u2022\u25CB\u25A1\u25A0\u2013\u2014\u2212\uF0B7\u00B7\uF0A7*•-]\s*)+/i, "");
        li.innerHTML = htmlContent || el.textContent;
        listEl.appendChild(li);
      });

      firstEl.parentNode.insertBefore(listEl, firstEl);
      group.forEach(({ el }) => el.remove());
    }

    i = j;
  }
}

function transformWordHeadings(doc) {
  doc.querySelectorAll("p[class*='MsoHeading'], p[class*='Heading'], p[style*='mso-outline-level']").forEach((p) => {
    if (!p.isConnected) return;
    const cls = p.className || "";
    const style = p.getAttribute("style") || "";
    let level = 1;
    const outlineMatch = style.match(/mso-outline-level\s*:\s*(\d+)/i);
    if (outlineMatch) {
      level = Math.min(parseInt(outlineMatch[1], 10), 3);
    } else if (/Heading\s*2|MsoHeading2/i.test(cls)) level = 2;
    else if (/Heading\s*3|MsoHeading3/i.test(cls)) level = 3;

    const h = doc.createElement(`h${level}`);
    h.innerHTML = p.innerHTML;
    p.parentNode.replaceChild(h, p);
  });

  const paragraphs = Array.from(doc.querySelectorAll("p"));
  paragraphs.forEach((p) => {
    if (!p.isConnected) return;
    if (p.closest("ul, ol, li, pre, code")) return;

    const text = p.textContent.trim();
    if (!text || text.length > 80) return;

    const h1Match = /^(\d+)\.\s+([A-Z].*)$/.test(text);
    const h2Match = /^(\d+\.\d+)\s+([A-Z].*)$/.test(text);

    if (h1Match) {
      const h1 = doc.createElement("h1");
      h1.innerHTML = p.innerHTML;
      p.parentNode.replaceChild(h1, p);
    } else if (h2Match) {
      const h2 = doc.createElement("h2");
      h2.innerHTML = p.innerHTML;
      p.parentNode.replaceChild(h2, p);
    }
  });
}

function scanTextForMathTokens(str) {
  const tokens = [];
  let i = 0;
  let buf = "";

  const pushText = () => {
    if (buf) {
      tokens.push({ type: "text", value: buf });
      buf = "";
    }
  };

  while (i < str.length) {
    const c = str[i];
    const n = str[i + 1];

    if (c === "\\" && (n === "$" || n === "\\" || n === "%" || n === "#" || n === "_")) {
      buf += str[i] + str[i + 1];
      i += 2;
      continue;
    }

    if (c === "\\" && n === "[") {
      const e = str.indexOf("\\]", i + 2);
      if (e !== -1) {
        pushText();
        tokens.push({
          type: "math",
          value: str.slice(i + 2, e).trim(),
          display: true,
        });
        i = e + 2;
        continue;
      }
    }

    if (c === "\\" && n === "(") {
      const e = str.indexOf("\\)", i + 2);
      if (e !== -1) {
        pushText();
        tokens.push({
          type: "math",
          value: str.slice(i + 2, e).trim(),
          display: false,
        });
        i = e + 2;
        continue;
      }
    }

    if (c === "$") {
      const dbl = n === "$";
      const delim = dbl ? "$$" : "$";
      const startIdx = i + delim.length;
      const e = str.indexOf(delim, startIdx);

      if (e !== -1) {
        const content = str.slice(startIdx, e).trim();
        const isCurrency = !dbl && /^\d+(?:\.\d+)?\s*(?:and|or|,|\.|\$)?$/.test(content);
        if (content && !isCurrency) {
          pushText();
          tokens.push({
            type: "math",
            value: content,
            display: dbl,
          });
          i = e + delim.length;
          continue;
        }
      }
    }

    buf += c;
    i++;
  }

  pushText();
  return tokens;
}

function wrapDisplaySpansInParagraphs(doc) {
  const displaySpans = Array.from(doc.querySelectorAll('span[data-display="true"]'));
  for (const span of displaySpans) {
    if (!span.isConnected) continue;

    const parent = span.parentElement;
    if (!parent) continue;

    const parentTag = parent.tagName.toUpperCase();
    const isAloneInP =
      parentTag === "P" &&
      parent.childNodes.length === 1 &&
      parent.firstChild === span;

    if (isAloneInP) continue;

    // Create a standalone <p> element containing only this display math span
    const standaloneP = doc.createElement("p");
    standaloneP.appendChild(span.cloneNode(true));

    if (parentTag === "P") {
      // Insert standaloneP before parent paragraph, then remove original span
      parent.parentNode.insertBefore(standaloneP, parent);
      span.remove();
    } else {
      // Replace span with standaloneP inside parent container
      span.replaceWith(standaloneP);
    }
  }

  // Remove any empty paragraphs left behind by span removals
  doc.querySelectorAll("p, div").forEach((el) => {
    if (el.children.length === 0 && (!el.textContent || !el.textContent.trim())) {
      el.remove();
    }
  });
}

function convertMarkdownMathInHtml(doc) {
  // Process block elements (<p>, <div>, <li>, <td>, <th>, <h1>-<h6>) containing math fences ($$, \[, \(, $)
  const blockElements = Array.from(
    doc.querySelectorAll("p, div, li, td, th, h1, h2, h3, h4, h5, h6"),
  );

  for (const el of blockElements) {
    if (!el.isConnected) continue;
    if (el.closest("pre, code")) continue;
    if (el.querySelector("[data-latex]")) continue;

    // Convert <br> tags inside display math elements into newlines
    // Check for $$, \[, or bare [ bracket fences
    const rawText = el.textContent;
    if (rawText && (rawText.includes("$$") || rawText.includes("\\[") || /^\s*\[/.test(rawText))) {
      el.querySelectorAll("br").forEach((br) => {
        const prev = br.previousSibling;
        if (prev && prev.nodeType === 3) {
          const text = prev.textContent;
          if (/(?<!\\)\\$/.test(text.trimEnd())) {
            prev.textContent = text.replace(/(?<!\\)\\(\s*)$/, "\\\\$1");
          }
        }
        br.replaceWith("\n");
      });
    }

    let fullText = el.textContent;
    if (!fullText) continue;

    // Normalize bare [ ] display math fences to $$ $$
    // Only when the ENTIRE block element content is [content] and content is not
    // a markdown link or numbered list item
    const bracketFenceMatch = fullText.trim().match(/^\[\s*([\s\S]+?)\s*\]$/);
    if (bracketFenceMatch) {
      const inner = bracketFenceMatch[1].trim();
      if (inner && !/^\d+[.)]/.test(inner) && !inner.includes("](")) {
        fullText = `$$ ${inner} $$`;
      }
    }

    const hasDisplayFence = fullText.includes("$$") || fullText.includes("\\[");
    const hasInlineFence = fullText.includes("$") || fullText.includes("\\(");

    if (!hasDisplayFence && !hasInlineFence) continue;

    // Evaluate math using el.textContent so formulas fragmented across child elements (like <em> or <span>) stay intact
    const tokens = scanTextForMathTokens(fullText);
    if (
      !tokens ||
      tokens.length === 0 ||
      (tokens.length === 1 && tokens[0].type === "text")
    ) {
      continue;
    }

    const hasDisplayToken = tokens.some((t) => t.type === "math" && t.display);

    if (hasDisplayToken && (el.tagName === "P" || el.tagName === "DIV")) {
      const parent = el.parentNode;
      if (!parent) continue;

      for (const token of tokens) {
        if (token.type === "text") {
          const txt = token.value.trim();
          if (txt) {
            const p = doc.createElement("p");
            p.textContent = txt;
            parent.insertBefore(p, el);
          }
        } else if (token.type === "math") {
          const p = doc.createElement("p");
          const span = doc.createElement("span");
          span.setAttribute("data-latex", extractLatex(token.value));
          if (token.display) {
            span.setAttribute("data-display", "true");
          }
          p.appendChild(span);
          parent.insertBefore(p, el);
        }
      }
      el.remove();
    } else {
      const frag = doc.createDocumentFragment();
      for (const token of tokens) {
        if (token.type === "text") {
          frag.appendChild(doc.createTextNode(token.value));
        } else if (token.type === "math") {
          const span = doc.createElement("span");
          span.setAttribute("data-latex", extractLatex(token.value));
          if (token.display) {
            span.setAttribute("data-display", "true");
          }
          frag.appendChild(span);
        }
      }
      el.innerHTML = "";
      el.appendChild(frag);
    }
  }

  // ── Bare parenthesized LaTeX: (\beta_0), (\varepsilon), (R^2), ((R^2)) ──
  // Walk text nodes and replace patterns like (\beta_0) or ((R^2)) with
  // inline math spans.  These have no $, \(, or \[ delimiter so the
  // earlier scanTextForMathTokens pass cannot see them.
  convertBareParenMathInTextNodes(doc);

  // Ensure display math spans get wrapped in clean top-level paragraph blocks
  wrapDisplaySpansInParagraphs(doc);
}

/**
 * Detect bare parenthesized LaTeX in text nodes and convert to math spans.
 * Matches patterns like:
 *   (\beta_0)  (\varepsilon)  (R^2)  ((R^2))  (y)  (x)  (\hat{y})
 * Only fires when the parenthesized content looks like LaTeX (contains
 * backslash-commands, carets, underscores, or is a single-letter variable).
 */
function convertBareParenMathInTextNodes(doc) {
  // Regex: match ((...)) or (\cmd...) or (expr with ^_) inside parens
  // Group 1: double-paren inner, Group 2: single-paren inner
  const PAREN_MATH_RE = /\(\(([^()]+)\)\)|\(([^()]*\\[a-zA-Z][^()]*)\)|\(([A-Za-z](?:\^[\w{}]+|_[\w{}]+|_\{[^}]+\}|\^\{[^}]+\})+)\)|\(([A-Za-z])\)(?=\s*[:=])/g;

  const textWalker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let tNode;
  while ((tNode = textWalker.nextNode())) textNodes.push(tNode);

  for (const node of textNodes) {
    if (!node.isConnected) continue;
    if (node.parentElement?.closest("pre, code, [data-latex]")) continue;

    const text = node.textContent;
    if (!text) continue;

    // Quick check: must contain ( and either \ or ^ or _ or a single letter in parens
    if (!text.includes("(")) continue;
    if (!/\\[a-zA-Z]|[\^_]|\([a-zA-Z]\)\s*[:=]/.test(text)) continue;

    PAREN_MATH_RE.lastIndex = 0;
    const parts = [];
    let lastIdx = 0;
    let match;

    while ((match = PAREN_MATH_RE.exec(text)) !== null) {
      // Push text before this match
      if (match.index > lastIdx) {
        parts.push({ type: "text", value: text.slice(lastIdx, match.index) });
      }

      const doubleParen = match[1]; // ((R^2))
      const latexCmd = match[2];   // (\beta_0)
      const exprSup = match[3];    // (R^2)
      const singleVar = match[4];  // (y): or (x)=

      if (doubleParen) {
        // ((R^2)) → show as ( math )
        parts.push({ type: "text", value: "(" });
        parts.push({ type: "math", value: doubleParen.trim() });
        parts.push({ type: "text", value: ")" });
      } else {
        const inner = (latexCmd || exprSup || singleVar || "").trim();
        // For single-letter vars and simple expressions, wrap with parens around the math
        parts.push({ type: "text", value: "(" });
        parts.push({ type: "math", value: inner });
        parts.push({ type: "text", value: ")" });
      }

      lastIdx = match.index + match[0].length;
    }

    if (parts.length === 0) continue;

    // Push remaining text
    if (lastIdx < text.length) {
      parts.push({ type: "text", value: text.slice(lastIdx) });
    }

    // Build fragment to replace the text node
    const frag = doc.createDocumentFragment();
    for (const part of parts) {
      if (part.type === "text") {
        frag.appendChild(doc.createTextNode(part.value));
      } else {
        const span = doc.createElement("span");
        span.setAttribute("data-latex", extractLatex(part.value));
        frag.appendChild(span);
      }
    }
    node.replaceWith(frag);
  }
}

/**
 * Detects and converts web math elements (MathJax v2/v3, MathML in attributes or tags,
 * KaTeX, Wikipedia math, web math images, etc.) into TipTap math spans (<span data-latex>).
 */
function convertWebMathInHtml(doc) {
  const getTopMathContainer = (node) => {
    let container = node.closest(
      ".MathJax_Display, .MathJax_Preview, .mjx-chtml, .MathJax, mjx-container, .katex-display, .katex, .mwe-math-element"
    );
    if (!container) return node;
    let curr = container;
    while (curr.parentElement) {
      const parent = curr.parentElement;
      if (
        parent.classList?.contains("MJXc-display") ||
        parent.classList?.contains("MathJax_Display") ||
        parent.classList?.contains("mjx-display") ||
        parent.classList?.contains("katex-display") ||
        parent.tagName === "MJX-CONTAINER" ||
        parent.classList?.contains("MathJax")
      ) {
        curr = parent;
      } else {
        break;
      }
    }
    return curr;
  };

  const mathMLToCleanLatex = (mathmlInput) => {
    if (!mathmlInput) return "";
    let xmlStr = typeof mathmlInput === "string" ? mathmlInput : mathmlInput.outerHTML;
    if (xmlStr.includes("&lt;math")) {
      const dummy = doc.createElement("textarea");
      dummy.innerHTML = xmlStr;
      xmlStr = dummy.value;
    }
    try {
      if (typeof mathmlInput !== "string") {
        const ann = mathmlInput.querySelector('annotation[encoding="application/x-tex"]');
        if (ann && ann.textContent.trim()) {
          return ann.textContent.trim();
        }
      } else if (xmlStr.includes('annotation encoding="application/x-tex"')) {
        const match = xmlStr.match(/<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>/i);
        if (match && match[1].trim()) {
          return match[1].trim();
        }
      }
      const latex = MathMLToLaTeX.convert(xmlStr);
      return latex ? latex.replace(/\s+/g, " ").trim() : "";
    } catch (e) {
      console.error("MathML conversion error:", e);
      return "";
    }
  };

  const createMathSpan = (latex, isDisplay) => {
    const cleanLatex = extractLatex(latex).replace(/\s+/g, " ").trim();
    if (!cleanLatex) return null;
    const span = doc.createElement("span");
    span.setAttribute("data-latex", cleanLatex);
    if (isDisplay) {
      span.setAttribute("data-display", "true");
    }
    return span;
  };

  const removePreviewsAround = (container) => {
    const prev = container.previousElementSibling;
    if (prev && (prev.classList?.contains("MathJax_Preview") || prev.classList?.contains("MathJax_Hover_Frame"))) {
      prev.remove();
    }
    const next = container.nextElementSibling;
    if (next && (next.classList?.contains("MathJax_Preview") || next.classList?.contains("MathJax_Hover_Frame"))) {
      next.remove();
    }
    const parent = container.parentElement;
    if (parent) {
      parent.querySelectorAll(".MathJax_Preview").forEach((p) => p.remove());
    }
  };

  // 1. Process elements with data-mathml attribute (MathJax v2/v3 CHTML)
  const mathmlAttrElements = Array.from(doc.querySelectorAll("[data-mathml]"));
  for (const el of mathmlAttrElements) {
    if (!el.isConnected) continue;
    const mathmlStr = el.getAttribute("data-mathml");
    const latex = mathMLToCleanLatex(mathmlStr);
    if (latex) {
      const isDisplay =
        /display=["']block["']/i.test(mathmlStr) ||
        el.getAttribute("display") === "block" ||
        !!el.closest(".MJXc-display, .MathJax_Display, .mjx-display, [display='block']");
      const span = createMathSpan(latex, isDisplay);
      if (span) {
        const container = getTopMathContainer(el);
        removePreviewsAround(container);
        container.replaceWith(span);
      }
    }
  }

  // 2. Process MathJax script tags (<script type="math/tex">)
  const mathJaxScripts = Array.from(doc.querySelectorAll('script[type^="math/tex"]'));
  for (const script of mathJaxScripts) {
    if (!script.isConnected) continue;
    const scriptType = script.getAttribute("type") || "";
    const isDisplay = scriptType.includes("mode=display") || !!script.closest(".MathJax_Display");
    const latex = script.textContent.trim();
    if (latex) {
      const span = createMathSpan(latex, isDisplay);
      if (span) {
        const container = getTopMathContainer(script);
        removePreviewsAround(container);
        container.replaceWith(span);
      }
    }
  }

  // 3. Process KaTeX wrappers (.katex-display, .katex)
  const katexElements = Array.from(doc.querySelectorAll(".katex-display, .katex"));
  for (const katexEl of katexElements) {
    if (!katexEl.isConnected) continue;
    const ann = katexEl.querySelector('annotation[encoding="application/x-tex"]');
    const latex = ann ? ann.textContent.trim() : "";
    if (latex) {
      const isDisplay = katexEl.classList.contains("katex-display") || !!katexEl.querySelector('math[display="block"]');
      const span = createMathSpan(latex, isDisplay);
      if (span) {
        const container = getTopMathContainer(katexEl);
        container.replaceWith(span);
      }
    }
  }

  // 4. Process standalone <math> tags
  const mathNodes = Array.from(doc.querySelectorAll("math"));
  for (const mathNode of mathNodes) {
    if (!mathNode.isConnected) continue;
    const latex = mathMLToCleanLatex(mathNode);
    if (latex) {
      const isDisplay = mathNode.getAttribute("display") === "block";
      const span = createMathSpan(latex, isDisplay);
      if (span) {
        const container = getTopMathContainer(mathNode);
        container.replaceWith(span);
      }
    }
  }

  // 5. Process Wikipedia & Web Math Images (<img class="mwe-math-fallback-image-inline" alt="..."> or img[alt])
  const mathImgs = Array.from(doc.querySelectorAll("img[alt], .mwe-math-element"));
  for (const item of mathImgs) {
    if (!item.isConnected) continue;
    let altText = "";
    let targetEl = item;
    if (item.classList?.contains("mwe-math-element")) {
      const ann = item.querySelector('annotation[encoding="application/x-tex"]');
      const img = item.querySelector("img");
      altText = ann ? ann.textContent : (img ? img.getAttribute("alt") : "");
    } else if (item.tagName === "IMG") {
      altText = item.getAttribute("alt") || "";
    }
    altText = altText.trim();
    if (!altText) continue;

    const displayMatch = altText.match(/^\{\\displaystyle\s*([\s\S]+)\}$/);
    let latex = displayMatch ? displayMatch[1].trim() : altText;
    let isDisplay = !!displayMatch;

    const isLatex =
      isDisplay ||
      altText.startsWith("\\") ||
      altText.startsWith("{") ||
      /\\[a-zA-Z]/.test(latex);

    if (isLatex) {
      const span = createMathSpan(latex, isDisplay);
      if (span) {
        targetEl.replaceWith(span);
      }
    }
  }

  // 6. Clean up remaining MathJax / KaTeX / MathML residual elements
  doc.querySelectorAll(".MathJax_Preview, .MathJax_Hover_Frame, .MathJax_Error, .katex-html, .katex-mathml, .mjx-chtml, .MathJax_Display, .MathJax, mjx-container").forEach((el) => {
    if (el.isConnected) el.remove();
  });

  // Ensure any newly added display math spans are wrapped in paragraph blocks
  wrapDisplaySpansInParagraphs(doc);
}

/**
 * Transforms clipboard HTML to replace <math> nodes with TipTap math spans,
 * strip heading prefixes, remove <hr> / divider paragraphs, and convert
 * inline CSS styles (font-weight, font-style, text-decoration) into semantic tags.
 */
export function transformMathHtml(html) {
  if (!html) return html;

  try {
    const cleanedHtml = cleanMsOfficeHtml(html);
    const doc = new DOMParser().parseFromString(cleanedHtml, "text/html");

    // ── Word list paragraphs → <ul> / <ol> ──────────────────────────────
    transformWordListParagraphs(doc);

    // ── Word headings → <h1>, <h2>, <h3> ────────────────────────────────
    transformWordHeadings(doc);

    // ── Remove file:/// local temp images from Word clipboard ──────────
    doc.querySelectorAll("img[src^='file:///']").forEach((img) => img.remove());

    // ── Convert Web Math (MathJax v2/v3, MathML, KaTeX, Wikipedia, Web Images) ──
    convertWebMathInHtml(doc);

    // ── Convert inline CSS styles into semantic tags ───────────────────────
    const styledNodes = doc.querySelectorAll("[style]");
    styledNodes.forEach((node) => {
      const style = node.getAttribute("style") || "";

      const isBold = /font-weight\s*:\s*(bold|bolder|[6-9]\d{2})/i.test(style);
      const isItalic = /font-style\s*:\s*(italic|oblique)/i.test(style);
      const isUnderline = /text-decoration\s*:\s*[^;]*underline/i.test(style);
      const isStrikethrough = /text-decoration\s*:\s*[^;]*line-through/i.test(style);

      if (isBold && !node.closest("strong, b") && node.tagName !== "STRONG" && node.tagName !== "B" && !node.querySelector("strong, b")) {
        const strong = doc.createElement("strong");
        while (node.firstChild) strong.appendChild(node.firstChild);
        node.appendChild(strong);
      }

      if (isItalic && !node.closest("em, i") && node.tagName !== "EM" && node.tagName !== "I" && !node.querySelector("em, i")) {
        const em = doc.createElement("em");
        while (node.firstChild) em.appendChild(node.firstChild);
        node.appendChild(em);
      }

      if (isUnderline && !node.closest("u") && node.tagName !== "U" && !node.querySelector("u")) {
        const u = doc.createElement("u");
        while (node.firstChild) u.appendChild(node.firstChild);
        node.appendChild(u);
      }

      if (isStrikethrough && !node.closest("s, del, strike") && node.tagName !== "S" && node.tagName !== "DEL" && node.tagName !== "STRIKE" && !node.querySelector("s, del, strike")) {
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
        /\]\s*$/.test(next.textContent || "");
      if (hasLatexCmd || (startsFence && (/[\\^_{}]/.test(text) || nextClosesFence))) {
        headingEl.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
        const lhs = headingEl.textContent.trim().replace(/^\[\s*/, "");
        // The setext underline the heading came from encodes an operator:
        // H1 ("===") means "=", H2 ("---") means "-".
        const op = headingEl.tagName.toUpperCase() === "H2" ? "-" : "=";
        let rhsParts = [];
        let curr = headingEl.nextElementSibling;

        while (curr) {
          const siblingText = curr.textContent || "";
          const nextSib = curr.nextElementSibling;
          curr.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
          const cleanSibText = curr.textContent.trim();

          const closes = /\]\s*$/.test(cleanSibText);
          if (closes) {
            rhsParts.push(cleanSibText.replace(/\]\s*$/, "").trim());
            curr.remove();
            break;
          } else if (cleanSibText.endsWith("]")) {
            rhsParts.push(cleanSibText.slice(0, -1).trim());
            curr.remove();
            break;
          } else {
            rhsParts.push(cleanSibText);
            curr.remove();
            curr = nextSib;
          }
        }

        const rhs = rhsParts.join(" ").trim();
        let latex = (rhs ? `${lhs} ${op} ${rhs}` : lhs)
          .replace(/\s+/g, " ")
          .trim();
        latex = latex.replace(/^\[\s*/, "").replace(/\s*\]$/, "").trim();

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
      wrapDisplaySpansInParagraphs(doc);
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

    // ── Convert raw markdown math ($...$, $$...$$, \(...\), \[...\]) in text ──
    convertMarkdownMathInHtml(doc);

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
      let collapsed = t.textContent.replace(/[ \t\f\v]+/g, " ");
      if (atBlockStart) collapsed = collapsed.replace(/^[ \t]+/, "");
      if (atBlockEnd) collapsed = collapsed.replace(/[ \t]+$/, "");
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
