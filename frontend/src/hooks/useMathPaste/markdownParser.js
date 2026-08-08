import { convUnicodeMath, sanitizeLatex, isUnclosedLatex } from "./mathUtils.js";

// Escape prose so it is safe inside a LaTeX \text{…}; normalise a few unit
// glyphs to ASCII and drop remaining non-ASCII (the '·' in "N·m", etc.).
function mmTextEscape(s) {
  return (s || "")
    .replace(/[·⋅∙]/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/×/g, "x")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"');
}

function mmIsVar(s) {
  s = (s || "").trim();
  s = s.replace(/^\(+(.*)\)+$/, "$1").trim();
  return (
    /^[A-Za-z](_[A-Za-z0-9]+|\^[A-Za-z0-9]+|_\{[^}]+\}|\^\{[^}]+\})?$/.test(
      s,
    ) ||
    /^\\[a-zA-Z]+(_[A-Za-z0-9]+|\^[A-Za-z0-9]+|_\{[^}]+\}|\^\{[^}]+\})?$/.test(s) ||
    /^(R\^2|R_adj\^2|R2)$/i.test(s)
  );
}
function mmWordy(s) {
  if (!s) return 0;
  // Strip LaTeX macro commands (\command) so names like \mathbb, \left, \right, \frac, \partial, etc. are not counted as prose words
  const clean = s.replace(/\\[a-zA-Z]+/g, "");
  const m = clean.match(/[A-Za-z]{3,}/g);
  return m ? m.length : 0;
}
function mmMathScore(L) {
  const hasStruct = /\^\{|_\{|\\[a-zA-Z]/.test(L);
  const hasOps = /[=+×÷±√]|[-](?=[0-9a-zA-Z(])/.test(L);
  return hasStruct || (hasOps && mmWordy(L) <= 3);
}
function mmDefLine(s) {
  const cleanS = (s || "")
    .trim()
    .replace(/^([*\-+•◦▪]|(?:\d+|[a-zA-Z])[.)])\s+/, "");
  let eq = cleanS.indexOf("=");
  let sep = "=";
  if (eq <= 0) {
    eq = cleanS.indexOf(":");
    sep = ":";
  }
  if (eq <= 0) return null;
  if (
    cleanS.charAt(eq + 1) === "=" ||
    "<>!".indexOf(cleanS.charAt(eq - 1)) !== -1
  )
    return null; // ==, <=, >=, !=
  let lhs = cleanS.slice(0, eq).trim();
  const rhs = cleanS.slice(eq + 1).trim();
  if (!lhs || !rhs) return null;

  // Reject LHS containing Markdown formatting (bold **, italic *, code `, etc.)
  if (/\*\*|\*|__|`/.test(lhs)) return null;

  lhs = lhs.replace(/^\(+(.*)\)+$/, "$1").trim();

  // Strip any leading/trailing math delimiters from LHS (e.g. $N_s$ -> N_s)
  while (true) {
    const start = lhs;
    if (lhs.startsWith("$$") && lhs.endsWith("$$")) {
      lhs = lhs.slice(2, -2).trim();
    } else if (lhs.startsWith("$") && lhs.endsWith("$")) {
      lhs = lhs.slice(1, -1).trim();
    } else if (lhs.startsWith("\\(") && lhs.endsWith("\\)")) {
      lhs = lhs.slice(2, -2).trim();
    } else if (lhs.startsWith("\\[") && lhs.endsWith("\\]")) {
      lhs = lhs.slice(2, -2).trim();
    }
    if (lhs === start) break;
  }

  const lhsOk =
    mmIsVar(lhs) ||
    (/\\[a-zA-Z]/.test(lhs) && mmWordy(lhs) <= 3) ||
    (/[\^_]/.test(lhs) && mmWordy(lhs) <= 1);
  if (!lhsOk) return null;
  if (mmWordy(rhs) < 1 || mmMathScore(rhs)) return null;
  return { lhs, sep, rhs };
}

function mmLooksMathy(text) {
  return (
    /[\\]/.test(text) ||
    /[\^_]\s*[{0-9a-zA-Z]/.test(text) ||
    /\$\$?[^$]+\$\$?/.test(text) ||
    /[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/.test(text) ||
    /[√∑∏∫∞±≤≥≠×÷∈∂]/.test(text)
  );
}

function mmCleanText(s) {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}

function mmHasLatex(s) {
  if (!s) return false;
  return (
    /[\\^_]|[\u0008\u000B\u000C\u0009]/.test(s) ||
    /^(R\^2|R_adj\^2|R2|\beta|\alpha|\gamma|\delta|\epsilon|\varepsilon|\theta|\sigma|\mu|\lambda|\phi|\psi|\omega|y|x)$/i.test(s.trim())
  );
}

function mmMatchBalanced(str, open, oc, cc) {
  let depth = 0;
  for (let j = open; j < str.length; j++) {
    const ch = str[j];
    if (ch === "\\") {
      j++;
      continue;
    }
    if (ch === oc) depth++;
    else if (ch === cc) {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

// Scan a line into text / inline-math tokens ($…$, \(…\), and (latex)/[latex]).
function mmScanInline(str) {
  if (!str) return [];
  // Restore control characters from JS string escapes
  str = str
    .replace(/\u0008([a-zA-Z])/g, "\\b$1")
    .replace(/\u000B([a-zA-Z])/g, "\\v$1")
    .replace(/\u000C([a-zA-Z])/g, "\\f$1")
    .replace(/\u0009([a-zA-Z])/g, "\\t$1")
    .replace(/\u000D(?!\n)([a-zA-Z])/g, "\\r$1");

  const tokens = [];
  let buf = "";
  let i = 0;
  const pushText = (t) => {
    const textToPush = t !== undefined ? t : buf;
    if (textToPush) {
      tokens.push({ t: "text", v: textToPush });
      if (t === undefined) buf = "";
    }
  };
  while (i < str.length) {
    const c = str[i],
      n = str[i + 1];
    if (c === "\\" && n === "(") {
      const e = str.indexOf("\\)", i + 2);
      if (e !== -1) {
        pushText();
        tokens.push({ t: "math", v: str.slice(i + 2, e).trim() });
        i = e + 2;
        continue;
      }
    }
    if (c === "\\" && n === "[") {
      const e = str.indexOf("\\]", i + 2);
      if (e !== -1) {
        pushText();
        tokens.push({ t: "math", v: str.slice(i + 2, e).trim() });
        i = e + 2;
        continue;
      }
    }
    if (c === "$") {
      const dbl = n === "$";
      const d = dbl ? "$$" : "$";
      const e = str.indexOf(d, i + d.length);
      if (e !== -1) {
        pushText();
        let mathVal = str.slice(i + d.length, e).trim();
        while (mathVal.startsWith("$") && mathVal.endsWith("$")) {
          mathVal = mathVal.slice(1, -1).trim();
        }
        tokens.push({ t: "math", v: mathVal, display: dbl });
        i = e + d.length;
        continue;
      }
    }
    if (c === "(" && str[i - 1] !== "\\") {
      const e = mmMatchBalanced(str, i, "(", ")");
      if (e !== -1) {
        let inner = str.slice(i + 1, e);
        // If inner content contains explicit math delimiters ($, \(, \[]), do NOT treat parens as math wrapper
        if (!inner.includes("$") && !inner.includes("\\(") && !inner.includes("\\[")) {
          let isDoubleParen = false;
          if (inner.startsWith("(") && inner.endsWith(")")) {
            inner = inner.slice(1, -1).trim();
            isDoubleParen = true;
          }

          if (mmHasLatex(inner) || mmIsVar(inner)) {
            pushText();
            if (isDoubleParen) {
              tokens.push({ t: "text", v: "(" });
              tokens.push({ t: "math", v: inner.trim() });
              tokens.push({ t: "text", v: ")" });
            } else if (mmIsVar(inner) && !inner.includes("=")) {
              tokens.push({ t: "text", v: "(" });
              tokens.push({ t: "math", v: inner.trim() });
              tokens.push({ t: "text", v: ")" });
            } else {
              tokens.push({ t: "math", v: inner.trim() });
            }
            i = e + 1;
            continue;
          }
        }
      }
    }
    if (c === "[" && str[i - 1] !== "\\") {
      const e = mmMatchBalanced(str, i, "[", "]");
      if (e !== -1) {
        const inner = str.slice(i + 1, e);
        if (!inner.includes("$") && !inner.includes("\\(") && !inner.includes("\\[") && mmHasLatex(inner)) {
          pushText();
          tokens.push({ t: "math", v: inner.trim() });
          i = e + 1;
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

function mmFindClose(s, delim) {
  if (delim === "]") {
    for (let j = 0; j < s.length; j++)
      if (s[j] === "]" && s[j - 1] !== "\\") return j;
    return -1;
  }
  return s.indexOf(delim);
}

function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mathSpan(latex, display) {
  return `<span data-latex="${escapeAttr(sanitizeLatex(latex))}"${display ? ' data-display="true"' : ""}></span>`;
}

// Convert markdown bold/italic/strikethrough/underline/code in text into tags
function mmInlineMd(escaped) {
  if (!escaped) return "";
  return escaped
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w\\])\*(?=\S)(.*?)(?<=\S)\*/g, "$1<em>$2</em>")
    .replace(/~~(.*?)~~/g, "<s>$1</s>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>")
    .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, "<u>$1</u>");
}

// A line's inline content → HTML (formatted text interleaved with inline math and images).
function mmInlineToHtml(raw) {
  if (!raw) return "";
  let html = mmInlineMd(escapeHtml(raw));
  // Convert Markdown images ![alt](src) into <img> HTML elements
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    return `<img src="${src}" alt="${alt}" />`;
  });
  return html;
}

// Does this plain text read like a markdown-with-math formula sheet worth
// parsing with parseMarkdownMathToHtml? (Has a display fence, or is multi-line
// LaTeX with a legend line, or contains images.)
function stripHeadingPrefix(text) {
  let cleaned = mmCleanText(text);
  // Strip digit prefixes followed by optional dot/paren and space: e.g. "1. ", "4.1 ", "10.2) "
  cleaned = cleaned.replace(/^\s*\d+(?:\.\d+)*[.)]?\s+/, "");
  // Strip letter/roman prefixes followed by dot/paren and space: e.g. "a) ", "A. ", "ix) ", "IV. "
  cleaned = cleaned.replace(
    /^\s*(?:[a-zA-Z]|[iI][vV]|[vV]?[iI]{1,3}|[iI][xX])\s*[.)]?\s+/,
    "",
  );
  return cleaned.trim();
}

export function looksLikeMarkdownMath(text) {
  if (!text) return false;
  const clean = text.replace(/<\/?mark(?:\s+[^>]*)?>/gi, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const hasFence = /^[ \t]*(\[|\\\[|\$\$)[ \t]*$/m.test(clean);
  const hasLatexCmd = /\\[a-zA-Z]{2,}/.test(clean);
  const hasInlineMath = /\$[^\n$]+\$/m.test(clean) || /\\\(.+\\\)/m.test(clean);
  const hasDisplayMath =
    /\\\[.+\\\]/s.test(clean) || /\$\$[\s\S]+\$\$/.test(clean);
  const hasMathSymbols = /[√∑∏∫∞±≤≥≠×÷∈∂]/.test(clean);
  const hasImages = /!\[([^\]]*)\]\(([^)]+)\)/.test(clean);
  const hasTable = /^\s*\|.*\|/m.test(clean) && /\|?[\s:|\\-]*-[\s:|\\-]*\|?/.test(clean);

  return (
    hasFence || hasLatexCmd || hasInlineMath || hasDisplayMath || hasMathSymbols || hasImages || hasTable
  );
}

// ── Markdown pipe-table helpers ──────────────────────────────────────────────
// A table row contains at least one pipe character; the separator row is only dashes/colons/pipes/
// spaces and contains at least one dash ("| --- | :--: |").
function isTableRow(l) {
  return l.includes("|") && l.trim().length > 1;
}
function isTableSep(l) {
  return /^\s*\|?[\s:|\\-]*-[\s:|\\-]*\|?\s*$/.test(l) && l.includes("-");
}
// Split "| a | b |" into ["a", "b"] while ignoring pipes inside math ($...$, $$...$$) and code blocks.
function splitTableRow(l) {
  let s = l.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);

  const cells = [];
  let currentCell = "";
  let inMath = false;
  let inDoubleMath = false;
  let inCode = false;
  let i = 0;

  while (i < s.length) {
    const char = s[i];
    const nextChar = s[i + 1];

    if (char === "\\" && (nextChar === "|" || nextChar === "$" || nextChar === "`")) {
      currentCell += char + nextChar;
      i += 2;
      continue;
    }

    if (char === "`" && !inMath && !inDoubleMath) {
      inCode = !inCode;
      currentCell += char;
      i++;
      continue;
    }

    if (char === "$" && !inCode) {
      if (nextChar === "$") {
        inDoubleMath = !inDoubleMath;
        currentCell += "$$";
        i += 2;
        continue;
      } else {
        inMath = !inMath;
        currentCell += "$";
        i++;
        continue;
      }
    }

    if (char === "|" && !inMath && !inDoubleMath && !inCode) {
      cells.push(currentCell.trim());
      currentCell = "";
      i++;
      continue;
    }

    currentCell += char;
    i++;
  }
  cells.push(currentCell.trim());

  return cells;
}

// Main parser: pasted markdown-with-math → HTML (headings, lists, tables, math).
export function parseMarkdownMathToHtml(text) {
  if (!text) return "<p></p>";

  // Pre-processing cleanup
  let cleanText = text
    .replace(/<\/?mark(?:\s+[^>]*)?>/gi, "")
    .replace(/\$([^$]+)\$\s*[’']/g, "$$1'$$")
    .replace(/\$([^$]+)\$\s+’/g, "$$1'$$")
    .replace(/\^\{\$([^$]+)\$\}/g, "^$1")
    .replace(/_\{\$([^$]+)\$\}/g, "_$1")
    .replace(
      /\^(?:\{([^{}]+)\}|([a-zA-Z\\]+))\s*_\{?([a-zA-Z0-9_]+)\}?\s*\/\s*_\{\(([^()]+)\)\}/g,
      (m, g1, g2, g3, g4) =>
        `\\frac{${(g1 || g2).trim()}_{${g3.trim()}}}{${g4.trim()}}`
    )
    .replace(
      /\^(?:\{([^{}]+)\}|([a-zA-Z\\]+))\s*_\{?([a-zA-Z0-9_]+)\}?/g,
      (m, g1, g2, g3) => `${(g1 || g2).trim()}_{${g3.trim()}}`
    );

  const rawLines = cleanText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  // Pre-pass: Renumber broken/corrupted ordered list markers sequentially (1., 1., 3. → 1., 2., 3.)
  const lines = [];
  let currNum = 0;
  for (let idx = 0; idx < rawLines.length; idx++) {
    const l = rawLines[idx];
    const tr = l.trim();
    const m = l.match(/^([ \t]*)\d+[.)][ \t]+(.*)$/);
    if (m) {
      currNum++;
      lines.push(`${m[1]}${currNum}. ${m[2]}`);
    } else {
      let hasNextList = false;
      for (let j = idx + 1; j < Math.min(idx + 6, rawLines.length); j++) {
        if (/^[ \t]*\d+[.)][ \t]+/.test(rawLines[j])) {
          hasNextList = true;
          break;
        }
      }
      if (!hasNextList && tr !== "" && !/^[ \t]*[-*+]|^\$\$|^\\\[/.test(tr)) {
        currNum = 0;
      }
      lines.push(l);
    }
  }

  // Math token storage
  const mathTokens = new Map();
  let tokenCounter = 0;
  const createMathToken = (htmlVal) => {
    const token = `__MATH_TOKEN_${tokenCounter++}__`;
    mathTokens.set(token, htmlVal);
    return token;
  };

  const tokenizeInlineMathInLine = (str) => {
    if (!str) return "";
    const tokens = mmScanInline(str);
    let res = "";
    for (const tk of tokens) {
      if (tk.t === "math") {
        const span = mathSpan(tk.v, tk.display);
        res += createMathToken(span);
      } else {
        res += tk.v;
      }
    }
    return res;
  };

  // Phase 1: Math Formula Tokenization Pass
  const processedLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      processedLines.push(line);
      i++;
      continue;
    }

    // Pass through code block fence lines without tokenizing math inside
    if (trimmed.startsWith("```")) {
      processedLines.push(line);
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        processedLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        processedLines.push(lines[i]);
        i++;
      }
      continue;
    }

    // 1. Single-line display math fence
    const singleLineMatch = trimmed.match(
      /^(?:\[|\\\[|\$\$)\s*(.+?)\s*(?:\]|\\\]|\$\$)$/
    );
    if (
      singleLineMatch &&
      !singleLineMatch[1].includes("$$") &&
      !singleLineMatch[1].includes("\\]") &&
      !/^\d+[.)]/.test(singleLineMatch[1])
    ) {
      const spanHtml = mathSpan(
        singleLineMatch[1].replace(/={3,}/g, "=").trim(),
        true
      );
      processedLines.push(createMathToken(spanHtml));
      i++;
      continue;
    }

    // 2. Multi-line display math fence ([ , \[ , $$)
    let openDelim = null,
      closeDelim = null;
    if (trimmed === "[") {
      openDelim = "[";
      closeDelim = "]";
    } else if (trimmed === "\\[") {
      openDelim = "\\[";
      closeDelim = "\\]";
    } else if (trimmed === "$$") {
      openDelim = "$$";
      closeDelim = "$$";
    }
    if (openDelim) {
      const fenceLines = [];
      i++;
      while (i < lines.length) {
        let cl = lines[i];
        let trimmedCl = cl.trim();
        const isCloser =
          (closeDelim === "]" && (trimmedCl === "]" || trimmedCl === "\\]")) ||
          (closeDelim === "\\]" &&
            (trimmedCl === "\\]" || trimmedCl === "]")) ||
          (closeDelim === "$$" && trimmedCl === "$$");

        if (isCloser) {
          i++;
          break;
        }

        if (trimmedCl) {
          fenceLines.push(trimmedCl);
        }
        i++;
      }

      if (fenceLines.length > 0) {
        const combinedLatex = convUnicodeMath(
          fenceLines
            .join(" ")
            .replace(/={2,}/g, "=")
            .replace(/\s+/g, " ")
            .trim()
        );
        const spanHtml = mathSpan(combinedLatex, true);
        processedLines.push(createMathToken(spanHtml));
      }
      continue;
    }

    // 3. ATX heading body looking like LaTeX
    const hm = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      const headingBody = hm[2].trim();
      if (/\\[a-zA-Z]{2,}/.test(headingBody) && mmWordy(headingBody) <= 3) {
        const spanHtml = mathSpan(convUnicodeMath(headingBody), true);
        processedLines.push(createMathToken(spanHtml));
        i++;
        continue;
      }
    }

    // Check if line is a list item
    const isListItem = /^(\s*)(?:([*\-+•◦▪])|(\d+)[.)]|([a-zA-Z])[.)])\s+/.test(
      line
    );

    // 4. Standalone definition / legend line (non-list item)
    if (!isListItem) {
      const dfn = mmDefLine(trimmed);
      if (dfn) {
        const lhsMath = mathSpan(dfn.lhs, false);
        const dfnHtml =
          dfn.sep === ":"
            ? `${lhsMath}: ${tokenizeInlineMathInLine(dfn.rhs)}`
            : mathSpan(
                dfn.lhs + " = \\text{" + mmTextEscape(dfn.rhs) + "}",
                false
              );
        processedLines.push(createMathToken(dfnHtml));
        i++;
        continue;
      }
    }

    // 5. Multi-line or single-line explicit LaTeX formula block
    const isLatexLine = (l) => {
      const tr = (l || "").trim();
      if (!tr) return false;
      if (tr.includes("|")) return false;
      if (/^\s*[*+\-•◦▪]\s/.test(tr) || /^\s*\d+[.)]\s/.test(tr)) return false;
      if (/^\*[a-zA-Z]/.test(tr)) return false;
      if (/^[\[\]$$]/.test(tr)) return false;
      if (/^[=]{3,}$/.test(tr) || /^[-]{3,}$/.test(tr)) return false;
      if (mmWordy(tr) > 3) return false;
      if (
        /^\s*\\(text|frac|dfrac|tfrac|mathrm|mathbf|mathit|sum|prod|int|alpha|beta|theta|sigma|mu|lambda|phi|psi|omega|infty|pm|times|div|leq|geq|neq|partial|nabla|left|right|begin|end|underbrace|overbrace|mathbf)\b/.test(
          tr
        )
      )
        return true;
      if (/^[\\{}]/.test(tr)) return true;
      if (/^[=+\-/×÷]\s*(\\|\{|\w)/.test(tr) || /^=\s*$/.test(tr)) return true;
      if (
        tr.includes("\\") &&
        /\\[a-zA-Z]{2,}/.test(tr) &&
        !tr.includes("http")
      )
        return true;
      return false;
    };

    if (!isListItem && isLatexLine(trimmed)) {
      const latexBlock = [trimmed];
      let currentInEnv = false;
      let state = isUnclosedLatex(trimmed, currentInEnv);
      currentInEnv = state.inEnv;
      i++;

      while (i < lines.length && isLatexLine(lines[i])) {
        const nextTrimmed = lines[i].trim();
        const isContinuation =
          state.unclosed ||
          /^[})\],{=+\-/×÷]/.test(nextTrimmed) ||
          /^\s*\\(right|end)\b/.test(nextTrimmed);

        if (isContinuation) {
          latexBlock.push(nextTrimmed);
          state = isUnclosedLatex(nextTrimmed, currentInEnv);
          currentInEnv = state.inEnv;
          i++;
        } else {
          break;
        }
      }
      const combinedLatex = convUnicodeMath(
        latexBlock.join(" ").replace(/\s+/g, " ").trim()
      );
      const spanHtml = mathSpan(combinedLatex, true);
      processedLines.push(createMathToken(spanHtml));
      continue;
    }

    // 6. Explicit-LaTeX line fallback (non-list item)
    if (!isListItem) {
      const convLine = convUnicodeMath(trimmed);
      const isFullyWrapped =
        (trimmed.startsWith("$$") && trimmed.endsWith("$$")) ||
        (trimmed.startsWith("$") && trimmed.endsWith("$")) ||
        (trimmed.startsWith("\\(") && trimmed.endsWith("\\)")) ||
        (trimmed.startsWith("\\[") && trimmed.endsWith("\\]"));
      const hasInlineDelim =
        trimmed.includes("$") ||
        trimmed.includes("\\(") ||
        trimmed.includes("\\[");
      const isMixedLine = hasInlineDelim && !isFullyWrapped;

      const hasExplicitLatex =
        /\\[a-zA-Z]+/.test(trimmed) && mmWordy(trimmed) <= 3 && !isMixedLine;
      if (
        !isMixedLine &&
        (hasExplicitLatex ||
          (convLine !== trimmed &&
            mmMathScore(convLine) &&
            mmWordy(convLine) <= 4))
      ) {
        const spanHtml = mathSpan(convLine.replace(/\s+/g, " ").trim(), true);
        processedLines.push(createMathToken(spanHtml));
        i++;
        continue;
      }
    }

    // 7. Tokenize inline math in line text
    processedLines.push(tokenizeInlineMathInLine(line));
    i++;
  }

  // Phase 2: Markdown Conversion Pass
  let html = "";
  const listStack = [];
  const flushList = () => {
    while (listStack.length > 0) {
      html += `</li></${listStack.pop().type}>`;
    }
  };

  i = 0;
  while (i < processedLines.length) {
    const line = processedLines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      if (listStack.length > 0) {
        let nextIdx = i + 1;
        while (
          nextIdx < processedLines.length &&
          processedLines[nextIdx].trim() === ""
        ) {
          nextIdx++;
        }
        if (nextIdx < processedLines.length) {
          const nextLine = processedLines[nextIdx];
          const isNextList = /^(\s*)(?:([*\-+•◦▪])|(\d+)[.)]|([a-zA-Z])[.)])\s+(.*)$/.test(
            nextLine
          );
          if (isNextList) {
            i++;
            continue;
          }
        }
      }
      flushList();
      i++;
      continue;
    }

    // Horizontal rule or orphaned setext underline
    if (/^[-*_]{3,}$/.test(trimmed) || /^={3,}$/.test(trimmed)) {
      flushList();
      i++;
      continue;
    }

    // Markdown code block fence
    if (trimmed.startsWith("```")) {
      if (listStack.length === 0) {
        flushList();
      }
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      i++;
      while (
        i < processedLines.length &&
        !processedLines[i].trim().startsWith("```")
      ) {
        codeLines.push(processedLines[i]);
        i++;
      }
      if (
        i < processedLines.length &&
        processedLines[i].trim().startsWith("```")
      ) {
        i++;
      }
      while (codeLines.length > 0 && codeLines[0].trim() === "") {
        codeLines.shift();
      }
      while (
        codeLines.length > 0 &&
        codeLines[codeLines.length - 1].trim() === ""
      ) {
        codeLines.pop();
      }
      const codeContent = escapeHtml(codeLines.join("\n"));
      html += `<pre><code${
        lang ? ` class="language-${escapeAttr(lang)}"` : ""
      }>${codeContent}</code></pre>`;
      continue;
    }

    // Pipe table
    if (
      isTableRow(line) &&
      i + 1 < processedLines.length &&
      isTableSep(processedLines[i + 1])
    ) {
      flushList();
      const header = splitTableRow(line);
      const cols = header.length;
      i += 2;
      const body = [];
      while (
        i < processedLines.length &&
        isTableRow(processedLines[i]) &&
        !isTableSep(processedLines[i])
      ) {
        body.push(splitTableRow(processedLines[i]));
        i++;
      }
      const fit = (row) => {
        const r = row.slice(0, cols);
        while (r.length < cols) r.push("");
        return r;
      };
      const cell = (c, tag) =>
        `<${tag}><p>${mmInlineToHtml(c || "")}</p></${tag}>`;
      let t =
        "<table><tbody><tr>" +
        fit(header)
          .map((c) => cell(c, "th"))
          .join("") +
        "</tr>";
      for (const row of body)
        t +=
          "<tr>" +
          fit(row)
            .map((c) => cell(c, "td"))
            .join("") +
          "</tr>";
      t += "</tbody></table>";
      html += t;
      continue;
    }

    // Setext heading
    if (
      i + 1 < processedLines.length &&
      trimmed.length > 0 &&
      !mmLooksMathy(trimmed) &&
      !/^\\[a-zA-Z]/.test(trimmed) &&
      !trimmed.startsWith("__MATH_TOKEN_")
    ) {
      const nextTrimmed = processedLines[i + 1].trim();
      if (/^={3,}$/.test(nextTrimmed) || /^-{3,}$/.test(nextTrimmed)) {
        flushList();
        const lvl = nextTrimmed[0] === "=" ? 1 : 2;
        const cleaned = stripHeadingPrefix(trimmed);
        html += `<h${Math.min(lvl, 3)}>${mmInlineToHtml(cleaned)}</h${Math.min(
          lvl,
          3
        )}>`;
        i += 2;
        continue;
      }
    }

    // Standalone Markdown Image
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      flushList();
      const alt = escapeAttr(imgMatch[1]);
      const src = escapeAttr(imgMatch[2]);
      html += `<p><img src="${src}" alt="${alt}" /></p>`;
      i++;
      continue;
    }

    // Markdown ATX heading
    const hm = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      flushList();
      const lvl = Math.min(hm[1].length, 3);
      const cleaned = stripHeadingPrefix(hm[2]);
      html += `<h${lvl}>${mmInlineToHtml(cleaned)}</h${lvl}>`;
      i++;
      continue;
    }

    // List item check
    const lm = line.match(
      /^(\s*)(?:([*\-+•◦▪])|(\d+)[.)]|([a-zA-Z])[.)])\s+(.*)$/
    );
    if (lm) {
      const indent = lm[1].replace(/\t/g, "    ").length;
      const type = lm[2] ? "ul" : "ol";
      const content = lm[5].trim();

      while (
        listStack.length > 0 &&
        indent < listStack[listStack.length - 1].indent
      ) {
        html += `</li></${listStack.pop().type}>`;
      }

      if (
        listStack.length === 0 ||
        indent > listStack[listStack.length - 1].indent
      ) {
        listStack.push({ type, indent });
        html += `<${type}>`;
      } else if (indent === listStack[listStack.length - 1].indent) {
        if (listStack[listStack.length - 1].type !== type) {
          html += `</li></${listStack.pop().type}>`;
          listStack.push({ type, indent });
          html += `<${type}>`;
        } else {
          html += `</li>`;
        }
      }

      const itemDfn = mmDefLine(content);
      if (itemDfn) {
        const lhsMath = mathSpan(itemDfn.lhs, false);
        const itemHtml =
          itemDfn.sep === ":"
            ? `${lhsMath}: ${mmInlineToHtml(itemDfn.rhs)}`
            : mathSpan(
                itemDfn.lhs + " = \\text{" + mmTextEscape(itemDfn.rhs) + "}",
                false
              );
        html += `<li><p>${itemHtml}</p>`;
      } else {
        html += `<li><p>${mmInlineToHtml(content)}</p>`;
      }
      i++;
      continue;
    }

    // Plain paragraph (or display math token line)
    flushList();
    const leadInMatch = trimmed.match(
      /^([A-Z][A-Za-z0-9\s\-/]{1,35}:)\s+(.*)$/
    );
    if (leadInMatch) {
      const label = escapeHtml(leadInMatch[1]);
      const rest = leadInMatch[2];
      html += `<p><strong>${label}</strong> ${mmInlineToHtml(rest)}</p>`;
    } else {
      html += `<p>${mmInlineToHtml(trimmed)}</p>`;
    }
    i++;
  }
  flushList();

  // Phase 3: Restore Math Tokens
  for (const [token, spanHtml] of mathTokens.entries()) {
    html = html.replaceAll(token, spanHtml);
  }

  return html || "<p></p>";
}

