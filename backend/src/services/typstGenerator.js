
const crypto = require('crypto');

let imageCounter = 0;
let extractedImages = [];

/**
 * Escapes characters that have special meaning in Typst and removes/normalizes bad unicode
 */
function escapeTypst(text) {
  if (typeof text !== 'string') return '';
  
  let str = text;
  
  // Remove emojis and zero-width chars (common causes of compilation errors)
  str = str.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
  str = str.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
  str = str.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
  str = str.replace(/[\u{1F700}-\u{1F77F}]/gu, '');
  str = str.replace(/[\u{1F780}-\u{1F7FF}]/gu, '');
  str = str.replace(/[\u{1F800}-\u{1F8FF}]/gu, '');
  str = str.replace(/[\u{1F900}-\u{1F9FF}]/gu, '');
  str = str.replace(/[\u{1FA00}-\u{1FA6F}]/gu, '');
  str = str.replace(/[\u{1FA70}-\u{1FAFF}]/gu, '');
  str = str.replace(/[\u{2600}-\u{26FF}]/gu, '');
  str = str.replace(/[\u{2700}-\u{27BF}]/gu, '');
  str = str.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Normalize quotes and dashes
  str = str.replace(/[“”]/g, '"');
  str = str.replace(/[‘’]/g, "'");
  str = str.replace(/—/g, '---');
  str = str.replace(/–/g, '--');

  // Escape Typst special characters: # $ * _ @ < > \ ` [ ]
  const specialChars = /[#$*_@<>\\`\[\]]/g;
  str = str.replace(specialChars, (c) => '\\' + c);

  return str;
}

/**
 * Strips numeric/alpha prefixes from headings to prevent double-numbering if numbering is enabled
 */
function stripAllPrefixes(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/^(\d+\.)+\s+/, '')
    .replace(/^[A-Z]\.\s+/, '')
    .replace(/^[ivxIVX]+\.\s+/, '')
    .trim();
}

const TYPST_MATH_KEYWORDS = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'varpi', 'rho', 'varrho', 'sigma', 'varsigma',
  'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
  'sum', 'product', 'integral', 'infinity', 'times', 'div', 'plus', 'minus', 'approx', 'dot', 'hat',
  'arrow', 'macron', 'frac', 'sqrt', 'bold', 'upright', 'italic', 'cases', 'mat', 'op', 'in', 'notin',
  'subset', 'supset', 'emptyset', 'forall', 'exists', 'nabla', 'partial', 'gcd', 'lcm', 'min', 'max',
  'sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lim', 'det', 'dim', 'ker', 'hom', 'arg',
  'deg', 'exp', 'mid', 'parallel', 'equiv', 'propto', 'sim', 'simeq', 'top', 'bot', 'star', 'circ',
  'bullet', 'degree', 'prime', 'diff', 'delim', 'align', 'left', 'right', 'center', 'width', 'height', 'dots'
]);

function fixTypstMathIdentifiers(str) {
  const parts = str.split(/("[^"]*")/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part; // Quoted string literal
    return part.replace(/(?<![A-Za-z])[A-Za-z]{2,}(?![A-Za-z])/g, (match) => {
      if (TYPST_MATH_KEYWORDS.has(match)) return match;
      return match.split('').join(' ');
    });
  }).join('');
}

/**
 * Convert standard LaTeX math to Typst math markup
 */
function latexMathToTypst(latexStr) {
  if (!latexStr) return '';
  let t = latexStr;

  // 1. Delimiters (\left and \right) MUST be processed BEFORE operator regexes like \leq
  t = t.replace(/\\left\s*\(/g, '(');
  t = t.replace(/\\right\s*\)/g, ')');
  t = t.replace(/\\left\s*\[/g, '[');
  t = t.replace(/\\right\s*\]/g, ']');
  t = t.replace(/\\left\s*\\\{/g, '{');
  t = t.replace(/\\right\s*\\\}/g, '}');
  t = t.replace(/\\left\s*\|/g, '|');
  t = t.replace(/\\right\s*\|/g, '|');
  t = t.replace(/\\left\s*\./g, '');
  t = t.replace(/\\right\s*\./g, '');
  t = t.replace(/\\left\b/g, '');
  t = t.replace(/\\right\b/g, '');

  // 2. Fractions with balanced brace parsing (handles nested braces inside numerator/denominator)
  let maxLoop = 20;
  while (t.includes('\\frac') && maxLoop-- > 0) {
    const idx = t.indexOf('\\frac');
    let cursor = idx + 5;
    while (cursor < t.length && /\s/.test(t[cursor])) cursor++;
    if (t[cursor] === '{') {
      const numEnd = findMatchingBrace(t, cursor);
      if (numEnd !== -1) {
        let denStart = numEnd + 1;
        while (denStart < t.length && /\s/.test(t[denStart])) denStart++;
        if (t[denStart] === '{') {
          const denEnd = findMatchingBrace(t, denStart);
          if (denEnd !== -1) {
            const num = t.slice(cursor + 1, numEnd);
            const den = t.slice(denStart + 1, denEnd);
            t = t.slice(0, idx) + `frac(${num}, ${den})` + t.slice(denEnd + 1);
            continue;
          }
        }
      }
    }
    t = t.replace('\\frac', 'frac');
  }

  // 3. Square roots with balanced brace parsing
  maxLoop = 20;
  while (t.includes('\\sqrt') && maxLoop-- > 0) {
    const idx = t.indexOf('\\sqrt');
    let cursor = idx + 5;
    let opt = '';
    if (t[cursor] === '[') {
      const optEnd = t.indexOf(']', cursor);
      if (optEnd !== -1) {
        opt = t.slice(cursor + 1, optEnd);
        cursor = optEnd + 1;
      }
    }
    while (cursor < t.length && /\s/.test(t[cursor])) cursor++;
    if (t[cursor] === '{') {
      const argEnd = findMatchingBrace(t, cursor);
      if (argEnd !== -1) {
        const arg = t.slice(cursor + 1, argEnd);
        t = t.slice(0, idx) + (opt ? `root(${opt}, ${arg})` : `sqrt(${arg})`) + t.slice(argEnd + 1);
        continue;
      }
    }
    t = t.replace('\\sqrt', 'sqrt');
  }

  // 4. Subscripts & superscripts
  t = t.replace(/\^\{([^{}]*)\}/g, '^($1)');
  t = t.replace(/_\{([^{}]*)\}/g, '_($1)');

  // 5. Operators & Relational symbols (using \b word boundary so \left is never corrupted)
  t = t.replace(/\\leq\b|\\le\b/g, '<=');
  t = t.replace(/\\geq\b|\\ge\b/g, '>=');
  t = t.replace(/\\neq\b|\\ne\b/g, '!=');
  t = t.replace(/\\sum\b/g, 'sum');
  t = t.replace(/\\prod\b/g, 'product');
  t = t.replace(/\\int\b/g, 'integral');
  t = t.replace(/\\infty\b/g, 'infinity');
  t = t.replace(/\\times\b/g, 'times');
  t = t.replace(/\\div\b/g, 'div');
  t = t.replace(/\\pm\b/g, 'plus.minus');
  t = t.replace(/\\approx\b/g, 'approx');
  t = t.replace(/\\cdot\b/g, 'dot');
  t = t.replace(/\\ldots\b/g, 'dots.h');
  t = t.replace(/\\cdots\b/g, 'dots.c');
  t = t.replace(/\\vdots\b/g, 'dots.v');
  t = t.replace(/\\ddots\b/g, 'dots.down');
  t = t.replace(/\\dots\b/g, 'dots');
  t = t.replace(/\\rightarrow\b|\\to\b/g, 'arrow.r');
  t = t.replace(/\\leftarrow\b/g, 'arrow.l');
  t = t.replace(/\\Rightarrow\b/g, 'arrow.r.double');
  t = t.replace(/\\partial\b/g, 'partial');
  t = t.replace(/\\nabla\b/g, 'nabla');

  // 6. Greek letters
  t = t.replace(/\\(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)\b/g, '$1');

  // 7. Text & Fonts
  t = t.replace(/\\text\s*\{([^{}]*)\}/g, '"$1"');
  t = t.replace(/\\mathbf\s*\{([^{}]*)\}/g, 'bold($1)');
  t = t.replace(/\\mathrm\s*\{([^{}]*)\}/g, 'upright($1)');
  t = t.replace(/\\mathit\s*\{([^{}]*)\}/g, 'italic($1)');
  t = t.replace(/\\hat\s*\{([^{}]*)\}/g, 'hat($1)');
  t = t.replace(/\\bar\s*\{([^{}]*)\}/g, 'macron($1)');
  t = t.replace(/\\vec\s*\{([^{}]*)\}/g, 'arrow($1)');
  t = t.replace(/\\dot\s*\{([^{}]*)\}/g, 'dot($1)');

  // 8. Matrices and cases
  t = t.replace(/\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}/gs, (m, c) => `mat(delim: "[", ${c.replace(/\\\\/g, ';').replace(/&/g, ',')})`);
  t = t.replace(/\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}/gs, (m, c) => `mat(delim: "(", ${c.replace(/\\\\/g, ';').replace(/&/g, ',')})`);
  t = t.replace(/\\begin\{cases\}(.*?)\\end\{cases\}/gs, (m, c) => `cases(${c.replace(/\\\\/g, ';').replace(/&/g, ',')})`);
  t = t.replace(/\\begin\{aligned\}(.*?)\\end\{aligned\}/gs, '$1');

  // 9. Clean up any remaining stray LaTeX backslashes before words
  t = t.replace(/\\([a-zA-Z]+)/g, '$1');

  return fixTypstMathIdentifiers(t);
}

/**
 * Handle image extraction for base64 or remote URLs
 */
function extractImageData(src, prefix) {
  if (!src) return null;
  
  imageCounter++;
  const ext = src.startsWith('data:image/jpeg') ? 'jpg' : 'png';
  const filename = `${prefix}_img_${imageCounter}.${ext}`;
  
  if (src.startsWith('data:image')) {
    const base64Data = src.split(',')[1];
    extractedImages.push({
      filename,
      base64: base64Data
    });
    return filename;
  } else if (src.startsWith('http')) {
    extractedImages.push({
      filename,
      url: src
    });
    return filename;
  }
  return null;
}

/**
 * Helper to find matching closing brace '}' for a opening brace '{' at startIdx, supporting nested braces.
 */
function findMatchingBrace(str, startIdx) {
  if (startIdx < 0 || startIdx >= str.length || str[startIdx] !== '{') return -1;
  let depth = 0;
  for (let i = startIdx; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Process text nodes to detect inline/display math delimiters ($...$, $$...$$, \(...\), \[...\]) 
 * or raw LaTeX math commands (\frac{...}{...}, \sqrt{...}) supporting nested braces before escaping general text.
 */
function processTextNodeWithMath(text) {
  if (typeof text !== 'string' || !text) return '';

  let result = '';
  let i = 0;

  while (i < text.length) {
    // 1. Display Math: $$...$$ or \[...\]
    if (text.startsWith('$$', i)) {
      const endIdx = text.indexOf('$$', i + 2);
      if (endIdx !== -1) {
        const inner = text.slice(i + 2, endIdx);
        const typstMath = latexMathToTypst(inner).trim();
        result += `\n$ ${typstMath} $\n`;
        i = endIdx + 2;
        continue;
      }
    }
    if (text.startsWith('\\[', i)) {
      const endIdx = text.indexOf('\\]', i + 2);
      if (endIdx !== -1) {
        const inner = text.slice(i + 2, endIdx);
        const typstMath = latexMathToTypst(inner).trim();
        result += `\n$ ${typstMath} $\n`;
        i = endIdx + 2;
        continue;
      }
    }

    // 2. Inline Math: $...$ or \(...\)
    if (text[i] === '$' && (i === 0 || text[i - 1] !== '\\')) {
      const endIdx = text.indexOf('$', i + 1);
      if (endIdx !== -1 && !text.slice(i + 1, endIdx).includes('\n')) {
        const inner = text.slice(i + 1, endIdx);
        const typstMath = latexMathToTypst(inner).trim();
        result += `$${typstMath}$`;
        i = endIdx + 1;
        continue;
      }
    }
    if (text.startsWith('\\(', i)) {
      const endIdx = text.indexOf('\\)', i + 2);
      if (endIdx !== -1) {
        const inner = text.slice(i + 2, endIdx);
        const typstMath = latexMathToTypst(inner).trim();
        result += `$${typstMath}$`;
        i = endIdx + 2;
        continue;
      }
    }

    // 3. Standalone \frac{num}{den} with balanced nested braces
    if (text.startsWith('\\frac', i)) {
      let cursor = i + 5;
      while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
      if (text[cursor] === '{') {
        const numEnd = findMatchingBrace(text, cursor);
        if (numEnd !== -1) {
          let denStart = numEnd + 1;
          while (denStart < text.length && /\s/.test(text[denStart])) denStart++;
          if (text[denStart] === '{') {
            const denEnd = findMatchingBrace(text, denStart);
            if (denEnd !== -1) {
              const fullFrac = text.slice(i, denEnd + 1);
              const typstMath = latexMathToTypst(fullFrac).trim();
              result += `$${typstMath}$`;
              i = denEnd + 1;
              continue;
            }
          }
        }
      }
    }

    // 4. Standalone \sqrt{arg} or \sqrt[n]{arg} with balanced nested braces
    if (text.startsWith('\\sqrt', i)) {
      let cursor = i + 5;
      if (text[cursor] === '[') {
        const optEnd = text.indexOf(']', cursor);
        if (optEnd !== -1) cursor = optEnd + 1;
      }
      while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
      if (text[cursor] === '{') {
        const argEnd = findMatchingBrace(text, cursor);
        if (argEnd !== -1) {
          const fullSqrt = text.slice(i, argEnd + 1);
          const typstMath = latexMathToTypst(fullSqrt).trim();
          result += `$${typstMath}$`;
          i = argEnd + 1;
          continue;
        }
      }
    }

    // 5. Default: escape single character
    result += escapeTypst(text[i]);
    i++;
  }

  return result;
}

/**
 * Core TipTap to Typst converter function
 */
function convertTipTapToTypst(nodes, imagePrefix, headingShift = 0, state = { lastOrderedEnd: 0, lastWasContinuation: false, chNum: 0, figCount: 0, tblCount: 0 }, isTopLevel = true) {
  if (!nodes || !Array.isArray(nodes)) return '';

  let output = '';

  for (const node of nodes) {
    if (node.type === 'paragraph') {
      const content = convertTipTapToTypst(node.content, imagePrefix, headingShift, state, false);
      if (isTopLevel && content.trim()) {
        state.lastOrderedEnd = 0;
        state.lastWasContinuation = false;
      }
      output += `${content}\n\n`;
    } else if (node.type === 'heading') {
      if (isTopLevel) {
        state.lastOrderedEnd = 0;
        state.lastWasContinuation = false;
      }
      let headingContent = convertTipTapToTypst(node.content, imagePrefix, headingShift, state, false).trim();
      headingContent = stripAllPrefixes(headingContent);
      
      let level = (node.attrs?.level || 1) + headingShift;
      if (level < 1) level = 1;
      if (level > 6) level = 6;
      
      if (level === 1 && !node.attrs?.isFrontMatter) {
        state.chNum = (state.chNum || 0) + 1;
        state.figCount = 0;
        state.tblCount = 0;
      }

      output += `${'='.repeat(level)} ${headingContent}\n\n`;
    } else if (node.type === 'bulletList') {
      if (isTopLevel) {
        state.lastOrderedEnd = 0;
        state.lastWasContinuation = false;
      }
      if (node.content) {
        node.content.forEach(li => {
          const content = convertTipTapToTypst(li.content, imagePrefix, headingShift, state, false).trim();
          const lines = content.split('\n');
          const formatted = lines.map((line, idx) => (idx === 0 ? `- ${line}` : line.trim() ? `  ${line}` : '')).join('\n');
          output += `${formatted}\n`;
        });
      }
      output += '\n';
    } else if (node.type === 'orderedList') {
      if (node.content && node.content.length > 0) {
        let startNum = 1;
        if (state.lastOrderedEnd > 0 && state.lastWasContinuation) {
          startNum = state.lastOrderedEnd + 1;
        }

        // Always emit #set enum(start: startNum) to reset Typst's global enum counter for new/continued lists
        output += `#set enum(start: ${startNum})\n`;

        let itemCount = 0;
        node.content.forEach(li => {
          itemCount++;
          const content = convertTipTapToTypst(li.content, imagePrefix, headingShift, state, false).trim();
          const lines = content.split('\n');
          const formatted = lines.map((line, idx) => (idx === 0 ? `+ ${line}` : line.trim() ? `  ${line}` : '')).join('\n');
          output += `${formatted}\n`;
        });

        if (isTopLevel) {
          state.lastOrderedEnd = startNum + itemCount - 1;
          state.lastWasContinuation = true;
        }
      }
      output += '\n';
    } else if (node.type === 'taskList') {
      if (isTopLevel) {
        state.lastOrderedEnd = 0;
        state.lastWasContinuation = false;
      }
      if (node.content) {
        node.content.forEach(item => {
          const checked = item.attrs?.checked ? 'x' : ' ';
          const content = convertTipTapToTypst(item.content, imagePrefix, headingShift, state, false).trim();
          const lines = content.split('\n');
          const formatted = lines.map((line, idx) => (idx === 0 ? `- [${checked}] ${line}` : line.trim() ? `  ${line}` : '')).join('\n');
          output += `${formatted}\n`;
        });
      }
      output += '\n';
    } else if (node.type === 'codeBlock') {
      const code = node.content?.map(n => n.text || '').join('') || '';
      const lang = node.attrs?.language || '';
      const backtickMatches = code.match(/`{3,}/g);
      let fence = '```';
      if (backtickMatches) {
        const maxLen = Math.max(...backtickMatches.map(m => m.length));
        fence = '`'.repeat(maxLen + 1);
      }
      output += fence + lang + '\n' + code + '\n' + fence + '\n\n';
    } else if (node.type === 'blockquote') {
      const content = convertTipTapToTypst(node.content, imagePrefix, headingShift, state, false);
      output += `#block(stroke: (left: 2pt + gray), inset: (left: 10pt, y: 0pt))[${content}]\n\n`;
    } else if (node.type === 'callout' || node.type === 'notice') {
      const content = convertTipTapToTypst(node.content, imagePrefix, headingShift, state, false).trim();
      output += `#rect(width: 100%, inset: 10pt, radius: 4pt, fill: rgb("#f0f4f8"), stroke: 0.5pt + rgb("#cbd5e1"))[${content}]\n\n`;
    } else if (node.type === 'table') {
      const rows = node.content || [];
      if (rows.length > 0) {
        let numCols = 1;
        rows.forEach(row => {
          if (row.content && row.content.length > numCols) {
            numCols = row.content.length;
          }
        });

        const colStats = Array.from({ length: numCols }, () => ({
          maxLen: 0,
          sumLen: 0,
          count: 0,
          maxWordLen: 0,
          hasParagraph: false
        }));

        const explicitColWidths = Array(numCols).fill(null);

        rows.forEach(row => {
          row.content?.forEach((cell, cIdx) => {
            if (cIdx >= numCols) return;
            const text = (cell.content?.map(n => n.text || '').join('') || '').trim();
            const len = text.length;
            colStats[cIdx].maxLen = Math.max(colStats[cIdx].maxLen, len);
            colStats[cIdx].sumLen += len;
            colStats[cIdx].count += 1;
            
            if (text.includes('\n') || len > 50) {
              colStats[cIdx].hasParagraph = true;
            }

            const words = text.split(/\s+/);
            words.forEach(w => {
              colStats[cIdx].maxWordLen = Math.max(colStats[cIdx].maxWordLen, w.length);
            });

            if (Array.isArray(cell.attrs?.colwidth) && cell.attrs.colwidth[0]) {
              explicitColWidths[cIdx] = cell.attrs.colwidth[0];
            }
          });
        });

        const colDefsArr = [];
        const hasAnyExplicit = explicitColWidths.some(w => w && w > 0);

        if (hasAnyExplicit) {
          explicitColWidths.forEach(w => {
            if (w && w > 0) {
              colDefsArr.push(`${w}fr`);
            } else {
              colDefsArr.push('1fr');
            }
          });
        } else {
          const longColIndices = [];
          colStats.forEach((stat, idx) => {
            if (stat.maxLen > 25 || stat.hasParagraph) {
              longColIndices.push(idx);
            }
          });

          if (longColIndices.length === 0) {
            for (let i = 0; i < numCols; i++) colDefsArr.push('auto');
          } else if (longColIndices.length === numCols) {
            colStats.forEach(stat => {
              if (stat.maxLen > 100) colDefsArr.push('2fr');
              else colDefsArr.push('1fr');
            });
          } else {
            colStats.forEach(stat => {
              if (stat.maxLen > 25 || stat.hasParagraph) {
                colDefsArr.push('1fr');
              } else {
                colDefsArr.push('auto');
              }
            });
          }
        }

        const colDefs = colDefsArr.join(', ');

        let headerRowIndexCount = 0;
        for (const row of rows) {
          const isHeaderRow = row.content && row.content.length > 0 && row.content.every(cell => cell.type === 'tableHeader');
          if (isHeaderRow) {
            headerRowIndexCount++;
          } else {
            break;
          }
        }

        let tableBodyContent = '';
        let headerContent = '';

        rows.forEach((row, rIdx) => {
          const isHeader = rIdx < headerRowIndexCount;
          let rowStr = '';

          row.content?.forEach(cell => {
            const cellText = convertTipTapToTypst(cell.content, imagePrefix, headingShift, state, false).trim().replace(/\n{2,}/g, '\n');
            const colspan = cell.attrs?.colspan || 1;
            const rowspan = cell.attrs?.rowspan || 1;

            let formattedCell = isHeader ? `[*${cellText}*]` : `[${cellText}]`;

            if (colspan > 1 || rowspan > 1) {
              const attrs = [];
              if (colspan > 1) attrs.push(`colspan: ${colspan}`);
              if (rowspan > 1) attrs.push(`rowspan: ${rowspan}`);
              formattedCell = `table.cell(${attrs.join(', ')})${formattedCell}`;
            }

            rowStr += `  ${formattedCell},\n`;
          });

          if (isHeader) {
            headerContent += rowStr;
          } else {
            tableBodyContent += rowStr;
          }
        });

        const tableStyle = node.attrs?.tableStyle || 'modern';
        const alignMode = node.attrs?.align || 'center';
        const insetMode = node.attrs?.inset || 'normal';

        let insetStr = '(x: 8pt, y: 6pt)';
        if (insetMode === 'compact') insetStr = '(x: 5pt, y: 4pt)';
        else if (insetMode === 'spacious') insetStr = '(x: 12pt, y: 8pt)';

        let strokeCode = 'stroke: 0.5pt + rgb("#cbd5e1")';
        let fillCode = 'fill: (x, y) => if y == 0 { rgb("#f1f5f9") } else { none }';

        if (tableStyle === 'booktabs') {
          strokeCode = 'stroke: none';
          fillCode = 'fill: none';
        } else if (tableStyle === 'zebra') {
          strokeCode = 'stroke: 0.5pt + rgb("#cbd5e1")';
          fillCode = 'fill: (x, y) => if y == 0 { rgb("#e2e8f0") } else if calc.even(y) { rgb("#f8fafc") } else { none }';
        } else if (tableStyle === 'borderless') {
          strokeCode = 'stroke: none';
          fillCode = 'fill: (x, y) => if y == 0 { rgb("#f1f5f9") } else { none }';
        } else if (tableStyle === 'custom') {
          const bColor = node.attrs?.borderColor || '#cbd5e1';
          const bWidth = node.attrs?.borderWidth || '0.5pt';
          const hFill = node.attrs?.headerFill || '#f1f5f9';
          strokeCode = bWidth === 'none' ? 'stroke: none' : `stroke: ${bWidth} + rgb("${bColor}")`;
          fillCode = `fill: (x, y) => if y == 0 { rgb("${hFill}") } else { none }`;
        }

        let fullTableCode = '';
        if (tableStyle === 'booktabs') {
          if (headerContent) {
            fullTableCode = `table(\n  columns: (${colDefs}),\n  align: (col, row) => if row == 0 { center + horizon } else { left + top },\n  stroke: none,\n  inset: ${insetStr},\n  table.hline(stroke: 1.5pt),\n  table.header(\n    repeat: true,\n${headerContent}  ),\n  table.hline(stroke: 0.8pt),\n${tableBodyContent}  table.hline(stroke: 1.5pt)\n)`;
          } else {
            fullTableCode = `table(\n  columns: (${colDefs}),\n  align: (col, row) => if row == 0 { center + horizon } else { left + top },\n  stroke: none,\n  inset: ${insetStr},\n  table.hline(stroke: 1.5pt),\n${tableBodyContent}  table.hline(stroke: 1.5pt)\n)`;
          }
        } else {
          if (headerContent) {
            fullTableCode = `table(\n  columns: (${colDefs}),\n  align: (col, row) => if row == 0 { center + horizon } else { left + top },\n  ${fillCode},\n  ${strokeCode},\n  inset: ${insetStr},\n  table.header(\n    repeat: true,\n${headerContent}  ),\n${tableBodyContent})`;
          } else {
            fullTableCode = `table(\n  columns: (${colDefs}),\n  align: (col, row) => if row == 0 { center + horizon } else { left + top },\n  ${fillCode},\n  ${strokeCode},\n  inset: ${insetStr},\n${tableBodyContent})`;
          }
        }

        state.tblCount = (state.tblCount || 0) + 1;
        const rawTableCaption = (node.attrs?.caption || node.attrs?.title || '').trim();
        const captionArg = rawTableCaption ? `caption: [${escapeTypst(rawTableCaption)}]` : `caption: []`;
        const figCode = `#figure(\n  align(${alignMode})[${fullTableCode}],\n  ${captionArg}\n)`;

        output += `#align(${alignMode})[\n${figCode}\n]\n\n`;
      }
    } else if (node.type === 'horizontalRule') {
      output += `#line(length: 100%)\n\n`;
    } else if (node.type === 'hardBreak') {
      output += `\\\n`;
    } else if (node.type === 'math') {
      const mathStr = node.attrs?.latex || '';
      const isDisplay = node.attrs?.display || false;
      const typstMath = latexMathToTypst(mathStr).trim();
      if (isDisplay) {
        output += `\n$ ${typstMath} $\n`;
      } else {
        output += `$${typstMath}$`;
      }
    } else if (node.type === 'footnote') {
      const fnContent = convertTipTapToTypst(node.content, imagePrefix, headingShift, state, false).trim();
      output += `#footnote[${fnContent}]`;
    } else if (node.type === 'image') {
      const filename = extractImageData(node.attrs?.src, imagePrefix);
      if (filename) {
        state.figCount = (state.figCount || 0) + 1;
        const rawImageCaption = (node.attrs?.title || node.attrs?.alt || '').trim();
        const captionArg = rawImageCaption ? `caption: [${escapeTypst(rawImageCaption)}]` : `caption: []`;
        output += `#figure(image("${filename}", width: 80%), ${captionArg})\n\n`;
      }
    } else if (node.type === 'text') {
      let t = processTextNodeWithMath(node.text || '');
      
      if (node.marks) {
        const hasCode = node.marks.find(m => m.type === 'code');
        if (hasCode) {
          t = `\`${node.text || ''}\``;
        } else {
          node.marks.forEach(mark => {
            if (mark.type === 'bold') t = `*${t}*`;
            if (mark.type === 'italic') t = `_${t}_`;
            if (mark.type === 'underline') t = `#underline[${t}]`;
            if (mark.type === 'strike') t = `#strike[${t}]`;
            if (mark.type === 'subscript') t = `#sub[${t}]`;
            if (mark.type === 'superscript') t = `#super[${t}]`;
            if (mark.type === 'link' && mark.attrs?.href) {
              t = `#link("${escapeTypst(mark.attrs.href)}")[${t}]`;
            }
            if (mark.type === 'textStyle' && mark.attrs?.color) {
              t = `#text(fill: rgb("${mark.attrs.color}"))[${t}]`;
            }
            if (mark.type === 'highlight' && mark.attrs?.color) {
              t = `#highlight(fill: rgb("${mark.attrs.color}"))[${t}]`;
            }
          });
        }
      }
      output += t;
    } else {
      if (isTopLevel) {
        state.lastWasContinuation = false;
      }
    }
  }

  return output;
}

/**
 * Audits Typst markup for security vulnerabilities (macro injections, file system reads)
 */
function auditTypstSource(typst) {
  const dangerousPatterns = [
    /#read\(/i,
    /#csv\(/i,
    /#json\(/i,
    /#xml\(/i,
    /#yaml\(/i,
    /#plugin\(/i,
    /#sys\./i,
    /#eval\(/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(typst)) {
      return { safe: false, reason: `Unsafe Typst macro detected: ${pattern}` };
    }
  }
  return { safe: true };
}

/**
 * Normalizes paper size string for Typst
 */
function normalizePageSize(size) {
  if (!size) return 'a4';
  const s = String(size).toLowerCase().trim();
  if (s === 'a4paper' || s === 'a4') return 'a4';
  if (s === 'letterpaper' || s === 'letter' || s === 'us-letter') return 'us-letter';
  if (s === 'legalpaper' || s === 'legal' || s === 'us-legal') return 'us-legal';
  if (s === 'a5paper' || s === 'a5') return 'a5';
  if (s === 'executivepaper' || s === 'executive') return 'executive';
  return s;
}

/**
 * Generates full Typst source from project metadata and content
 */
function generateProjectTypst(project, imagePrefix = 'img') {
  imageCounter = 0;
  extractedImages = [];
  
  const {
    pageSize = 'a4',
    fontSize = '12pt',
    lineSpacing = '1.5',
    fontFamily = 'Times New Roman',
    marginTop = '2.5cm',
    marginBottom = '2.5cm',
    marginLeft = '3.5cm',
    marginRight = '1.25cm',
    enableHeader = false,
    enableFooter = false,
    headerLeft = '',
    headerCenter = '',
    headerRight = '',
    footerLeft = '',
    footerCenter = '',
    footerRight = '',
    headerRule = false,
    footerRule = false,
    enableListOfFigures = false,
    enableListOfTables = false,
    title = 'Document',
    authors = [],
    guide = '',
    department = '',
    institution = '',
    year = '',
    abstract = '',
    keywords = ''
  } = project.metadata || {};

  const enableChapterNumbers =
    project.settings?.enableChapterNumbers !== false &&
    project.metadata?.enableChapterNumbers !== false;

  const templateId = project.templateId || 'blank';
  let typst = '';

  // Safe author list formatting
  let authorList = '';
  if (Array.isArray(authors) && authors.length > 0) {
    authorList = authors
      .map(a => {
        if (typeof a === 'string') return escapeTypst(a);
        if (a && typeof a === 'object' && a.name) return escapeTypst(a.name);
        return '';
      })
      .filter(Boolean)
      .join(', ');
  } else if (typeof authors === 'string' && authors.trim()) {
    authorList = escapeTypst(authors.trim());
  }

  // 1. Preamble & Document Setup
  typst += `#set document(title: "${escapeTypst(title)}")\n`;

  // Template-specific page configuration
  let pagePaper = normalizePageSize(pageSize);
  let pageMargin = `(top: ${marginTop}, bottom: ${marginBottom}, left: ${marginLeft}, right: ${marginRight})`;
  let pageColumns = 1;
  let fontName = fontFamily || 'Times New Roman';

  if (templateId === 'ieee-paper') {
    pagePaper = 'us-letter';
    pageMargin = `(x: 0.68in, top: 0.75in, bottom: 1in)`;
    pageColumns = 2;
    if (!project.metadata?.fontFamily) fontName = 'New Computer Modern';
  } else if (templateId === 'diploma-project-report') {
    pagePaper = 'a4';
    pageMargin = `(top: 2.2cm, bottom: 2.2cm, left: 3.5cm, right: 1.25cm)`;
    if (!project.metadata?.fontFamily) fontName = 'Times New Roman';
  } else if (templateId === 'thesis') {
    pagePaper = 'a4';
    pageMargin = `(top: 2.5cm, bottom: 2.5cm, left: 3.5cm, right: 2.5cm)`;
    if (!project.metadata?.fontFamily) fontName = 'New Computer Modern';
  } else if (templateId === 'assignment') {
    pagePaper = 'a4';
    pageMargin = `(top: 2cm, bottom: 2cm, left: 2cm, right: 2cm)`;
  }

  const isHeaderActive = Boolean(enableHeader);
  const isFooterActive = enableFooter !== false;
  const isHeaderRule = headerRule !== false || templateId === 'diploma-project-report';
  const isFooterRule = footerRule !== false || templateId === 'diploma-project-report';

  // Header & Footer Typst layout code using grid and stack
  let headerCode = '';
  if (isHeaderActive) {
    const hLeft = escapeTypst(headerLeft || title);
    const hCenter = escapeTypst(headerCenter || '');
    const hRight = escapeTypst(headerRight || '');
    const hGrid = `grid(columns: (1fr, 1fr, 1fr), align(left)[${hLeft}], align(center)[${hCenter}], align(right)[${hRight}])`;
    if (isHeaderRule) {
      headerCode = `stack(spacing: 0.4em, ${hGrid}, line(length: 100%, stroke: 0.5pt + black))`;
    } else {
      headerCode = hGrid;
    }
  }

  let footerCode = '';
  if (isFooterActive) {
    const fLeft = escapeTypst(footerLeft || '');
    const fCenter = footerCenter ? escapeTypst(footerCenter) : '#counter(page).display("1")';
    const fRight = escapeTypst(footerRight || '');
    const fGrid = `grid(columns: (1fr, 1fr, 1fr), align(left)[${fLeft}], align(center)[${fCenter}], align(right)[${fRight}])`;
    if (isFooterRule) {
      footerCode = `stack(spacing: 0.4em, line(length: 100%, stroke: 0.5pt + black), ${fGrid})`;
    } else {
      footerCode = fGrid;
    }
  }

  typst += `#set page(
  paper: "${pagePaper}",
  margin: ${pageMargin},
  columns: ${pageColumns},
  header: none,
  footer: none
)\n\n`;

  // Text & Line Spacing Settings
  let effFontSize = fontSize;
  if (templateId === 'ieee-paper') effFontSize = '10pt';
  else if (templateId === 'diploma-project-report') effFontSize = '12pt';

  if (fontName) {
    typst += `#set text(font: "${fontName}", size: ${effFontSize})\n`;
  } else {
    typst += `#set text(size: ${effFontSize})\n`;
  }

  // Double spacing for diploma-project-report (leading ~1.3em), else use user setting
  let spacingNum = parseFloat(lineSpacing) || 1.5;
  if (templateId === 'diploma-project-report') spacingNum = 2.0;
  const leadingVal = (0.65 * spacingNum).toFixed(3);
  typst += `#set par(leading: ${leadingVal}em, spacing: 1.2em, justify: true)\n`;
  typst += `#show figure: set block(breakable: true)\n\n`;

  // Heading Styles & Numbering per Template
  if (templateId === 'ieee-paper') {
    typst += `#set heading(numbering: "I.A.1.")\n\n`;
    typst += `
#show heading.where(level: 1): it => block(
  above: 1.5em, below: 0.8em,
  align(center, text(size: 10pt, weight: "bold", smallcaps(it.body)))
)
#show heading.where(level: 2): it => block(
  above: 1.2em, below: 0.6em,
  text(size: 10pt, style: "italic", it.body)
)
#show heading.where(level: 3): it => block(
  above: 1em, below: 0.4em,
  text(size: 10pt, style: "italic", it.body)
)
\n`;
  } else if (templateId === 'assignment') {
    if (enableChapterNumbers) {
      typst += `#set heading(numbering: "1.")\n`;
    }
    typst += `
#show heading.where(level: 1): it => block(
  above: 1.4em, below: 0.8em,
  text(size: 16pt, weight: "bold", upper(it.body))
)
#show heading.where(level: 2): it => block(
  above: 1.2em, below: 0.6em,
  text(size: 13pt, weight: "bold", it.body)
)
\n`;
  } else if (templateId === 'diploma-project-report') {
    // MSBTE / Academic Report Layout (Chapter=14pt, Section/Subsection=12pt)
    if (enableChapterNumbers) {
      typst += `#set heading(numbering: "1.1")\n`;
    }
    typst += `
#show heading.where(level: 1): it => block(
  above: 2.8em, below: 1.8em, width: 100%,
  {
    if it.numbering != none {
      let num = counter(heading).display()
      align(center)[
        #text(font: "${fontName}", size: 14pt, weight: "bold")[CHAPTER #num] \
        #v(0.4em)
        #text(font: "${fontName}", size: 14pt, weight: "bold")[#upper(it.body)]
      ]
    } else {
      align(center)[
        #text(font: "${fontName}", size: 14pt, weight: "bold")[#upper(it.body)]
      ]
    }
  }
)
#show heading.where(level: 2): it => block(
  above: 1.8em, below: 0.8em,
  {
    if it.numbering != none {
      let num = counter(heading).display()
      text(font: "${fontName}", size: 12pt, weight: "bold")[#num #h(0.6em) #upper(it.body)]
    } else {
      text(font: "${fontName}", size: 12pt, weight: "bold")[#upper(it.body)]
    }
  }
)
#show heading.where(level: 3): it => block(
  above: 1.4em, below: 0.6em,
  {
    if it.numbering != none {
      let num = counter(heading).display()
      text(font: "${fontName}", size: 12pt, weight: "bold")[#num #h(0.6em) #it.body]
    } else {
      text(font: "${fontName}", size: 12pt, weight: "bold")[#it.body]
    }
  }
)
#show heading.where(level: 4): it => block(
  above: 1.2em, below: 0.5em,
  {
    if it.numbering != none {
      let num = counter(heading).display()
      text(font: "${fontName}", size: 12pt, weight: "bold")[#num #h(0.6em) #it.body]
    } else {
      text(font: "${fontName}", size: 12pt, weight: "bold")[#it.body]
    }
  }
)
\n`;
  } else {
    if (enableChapterNumbers) {
      typst += `#set heading(numbering: "1.1")\n`;
    }
    typst += `
#show heading.where(level: 1): it => block(
  above: 2.8em, below: 1.8em,
  {
    if it.numbering != none {
      let num = counter(heading).display()
      text(size: 20pt, weight: "bold")[CHAPTER #num: #upper(it.body)]
    } else {
      text(size: 20pt, weight: "bold", it.body)
    }
  }
)
#show heading.where(level: 2): it => block(
  above: 1.8em, below: 0.8em,
  {
    if it.numbering != none {
      let num = counter(heading).display()
      text(size: 16pt, weight: "bold")[#num #it.body]
    } else {
      text(size: 16pt, weight: "bold", it.body)
    }
  }
)
#show heading.where(level: 3): it => block(
  above: 1.4em, below: 0.6em,
  {
    if it.numbering != none {
      let num = counter(heading).display()
      text(size: 13.5pt, weight: "bold")[#num #it.body]
    } else {
      text(size: 13.5pt, weight: "bold", it.body)
    }
  }
)
#show heading.where(level: 4): it => block(
  above: 1.2em, below: 0.5em,
  {
    if it.numbering != none {
      let num = counter(heading).display()
      text(size: 12pt, weight: "semibold")[#num #it.body]
    } else {
      text(size: 12pt, weight: "semibold", it.body)
    }
  }
)
\n`;
  }

  // 2. Cover / Title Page Generation based on Template Type
  if (templateId === 'ieee-paper') {
    // IEEE Header Block across full width
    typst += `#place(top + center, scope: "parent", float: true)[\n`;
    typst += `  #align(center)[\n`;
    typst += `    #v(1em)\n`;
    typst += `    #text(size: 24pt, weight: "regular")[${escapeTypst(title)}]\n`;
    if (authorList) {
      typst += `    #v(1em)\n    #text(size: 11pt, style: "italic")[${authorList}]\n`;
    }
    if (institution || department) {
      typst += `    #v(0.5em)\n    #text(size: 10pt)[${escapeTypst(department)}${department && institution ? ', ' : ''}${escapeTypst(institution)}]\n`;
    }
    typst += `    #v(1.5em)\n`;
    typst += `  ]\n`;

    if (abstract) {
      typst += `  #block(width: 100%, inset: (x: 1em))[\n`;
      typst += `    #text(weight: "bold")[#emph[Abstract]—] #emph[${escapeTypst(abstract)}]\n`;
      if (keywords) {
        typst += `    #v(0.5em)\n`;
        typst += `    #text(weight: "bold")[#emph[Keywords]—] ${escapeTypst(keywords)}\n`;
      }
      typst += `  ]\n`;
      typst += `  #v(2em)\n`;
    }
    typst += `]\n\n`;

  } else if (templateId === 'assignment') {
    // Compact Top Banner for Assignments (no separate pagebreak)
    typst += `#block(width: 100%, stroke: 0.5pt + gray, inset: 12pt, radius: 4pt)[\n`;
    typst += `  #grid(columns: (1fr, 1fr),\n`;
    typst += `    align(left)[\n`;
    typst += `      #text(size: 16pt, weight: "bold")[${escapeTypst(title)}]\n`;
    if (department) typst += `      #v(0.3em)\n      #text(size: 10pt, weight: "semibold")[Subject: ${escapeTypst(department)}]\n`;
    typst += `    ],\n`;
    typst += `    align(right)[\n`;
    if (authorList) typst += `      #text(size: 11pt, weight: "bold")[${authorList}]\n`;
    if (institution) typst += `      #v(0.2em)\n      #text(size: 9pt)[${escapeTypst(institution)}]\n`;
    if (year) typst += `      #v(0.2em)\n      #text(size: 9pt)[${escapeTypst(year)}]\n`;
    typst += `    ]\n`;
    typst += `  )\n`;
    typst += `]\n#v(1.5em)\n\n`;

  } else if (templateId === 'thesis') {
    // Formal Thesis Cover Page
    typst += `#align(center)[\n`;
    typst += `  #v(2em)\n`;
    typst += `  #text(size: 24pt, weight: "bold")[${escapeTypst(title)}]\n`;
    typst += `  #v(3em)\n`;
    typst += `  #text(size: 12pt, style: "italic")[A THESIS SUBMITTED IN PARTIAL FULFILLMENT OF THE REQUIREMENTS FOR THE DEGREE OF]\n`;
    typst += `  #v(1em)\n`;
    if (department) typst += `  #text(size: 14pt, weight: "bold")[${escapeTypst(department)}]\n`;
    typst += `  #v(3em)\n`;
    if (authorList) typst += `  #text(size: 13pt)[Submitted by:]\n  #v(0.5em)\n  #text(size: 15pt, weight: "bold")[${authorList}]\n`;
    typst += `  #v(3em)\n`;
    if (guide) typst += `  #text(size: 13pt)[Under the Supervision of:]\n  #v(0.5em)\n  #text(size: 14pt, weight: "bold")[${escapeTypst(guide)}]\n`;
    typst += `  #v(4em)\n`;
    if (institution) typst += `  #text(size: 16pt, weight: "bold")[${escapeTypst(institution)}]\n`;
    if (year) typst += `  #v(1.5em)\n  #text(size: 13pt)[${escapeTypst(year)}]\n`;
    typst += `]\n#pagebreak()\n\n`;

  } else if (templateId === 'diploma-project-report') {
    // MSBTE / Diploma Project Report Cover Page
    typst += `#align(center)[\n`;
    typst += `  #v(1em)\n`;
    typst += `  #text(size: 14pt, style: "italic")[A PROJECT REPORT ON]\n`;
    typst += `  #v(1em)\n`;
    typst += `  #text(size: 22pt, weight: "bold")[${escapeTypst(title)}]\n`;
    typst += `  #v(2.5em)\n`;
    typst += `  #text(size: 11pt)[SUBMITTED IN PARTIAL FULFILLMENT OF THE REQUIREMENTS FOR DIPLOMA]\n`;
    typst += `  #v(3em)\n`;
    if (authorList) typst += `  #text(size: 12pt)[SUBMITTED BY]\n  #v(0.5em)\n  #text(size: 14pt, weight: "bold")[${authorList}]\n`;
    typst += `  #v(2.5em)\n`;
    if (guide) typst += `  #text(size: 12pt)[UNDER THE GUIDANCE OF]\n  #v(0.5em)\n  #text(size: 14pt, weight: "bold")[${escapeTypst(guide)}]\n`;
    typst += `  #v(3em)\n`;
    if (department) typst += `  #text(size: 14pt, weight: "bold")[${escapeTypst(department)}]\n`;
    if (institution) typst += `  #text(size: 16pt, weight: "bold")[${escapeTypst(institution)}]\n`;
    if (year) typst += `  #v(1.5em)\n  #text(size: 12pt)[ACADEMIC YEAR: ${escapeTypst(year)}]\n`;
    typst += `]\n#pagebreak()\n\n`;

  } else if (templateId !== 'blank') {
    // Generic Title Page
    typst += `#align(center)[\n`;
    typst += `  #v(2em)\n`;
    typst += `  #text(size: 20pt, weight: "bold")[${escapeTypst(title)}]\n`;
    typst += `  #v(3em)\n`;
    if (authorList) typst += `  #text(size: 14pt)[Submitted by: ${authorList}]\n`;
    typst += `  #v(3em)\n`;
    if (guide) typst += `  #text(size: 14pt)[Under the guidance of: ${escapeTypst(guide)}]\n`;
    typst += `  #v(4em)\n`;
    if (department) typst += `  #text(size: 16pt, weight: "bold")[${escapeTypst(department)}]\n`;
    if (institution) typst += `  #text(size: 18pt, weight: "bold")[${escapeTypst(institution)}]\n`;
    if (year) typst += `  #v(2em)\n  #text(size: 14pt)[${escapeTypst(year)}]\n`;
    typst += `]\n#pagebreak()\n\n`;
  }

  // 3. Front Matter
  let renderedToc = false;

  if (Array.isArray(project.frontMatter) && project.frontMatter.length > 0) {
    project.frontMatter.forEach(section => {
      const { id, label, content } = section;
      const isTitlePage = id === 'title_page' || (label && String(label).toLowerCase().trim() === 'title page');
      const isTocSection = id === 'toc' || (label && String(label).toLowerCase().includes('table of contents'));
      
      if (isTitlePage) {
        // Skip title_page in frontMatter loop; cover/title page is already rendered by Section 2
        return;
      }
      
      const isCertificate = id === 'certificate' || (label && String(label).toLowerCase().trim() === 'certificate') || content?.isCertificateCanvas;

      if (isCertificate) {
        let certBody = '';
        if (content && content.body && Array.isArray(content.body) && content.body.length > 0) {
          certBody = convertTipTapToTypst(content.body, imagePrefix);
        } else if (content && content.content && Array.isArray(content.content) && content.content.length > 0) {
          certBody = convertTipTapToTypst(content.content, imagePrefix);
        } else {
          certBody = `This is to certify that the project report entitled *"${escapeTypst(title)}"* submitted by *${escapeTypst(authorList || '[Candidate Name]')}* in partial fulfillment of the requirements for the award of Diploma / Degree in *${escapeTypst(department || 'Engineering')}* at *${escapeTypst(institution || '[Institution Name]')}* is an authentic record of work carried out under my supervision.`;
        }

        typst += `#page(margin: (top: 2cm, bottom: 2cm, left: 2.5cm, right: 2.5cm))[\n`;
        typst += `  #rect(width: 100%, height: 100%, stroke: 1.5pt + black, inset: 18pt)[\n`;
        typst += `    #align(center)[\n`;
        typst += `      #v(0.8em)\n`;
        typst += `      #text(size: 16pt, weight: "bold")[${escapeTypst(institution || 'INSTITUTION NAME')}]\n`;
        if (department) {
          typst += `      #v(0.4em)\n`;
          typst += `      #text(size: 13pt, weight: "semibold")[Department of ${escapeTypst(department)}]\n`;
        }
        typst += `      #v(1.8em)\n`;
        typst += `      #text(size: 22pt, weight: "bold")[#underline[${escapeTypst(label || 'CERTIFICATE')}]]\n`;
        typst += `      #v(2em)\n`;
        typst += `      #align(left)[\n`;
        typst += `        #set par(leading: 0.9em, justify: true)\n`;
        typst += `        #text(size: 12pt)[${certBody}]\n`;
        typst += `      ]\n`;
        typst += `      #v(3.5em)\n`;
        typst += `      #grid(columns: (1fr, 1fr),\n`;
        typst += `        align(center)[\n`;
        typst += `          #line(length: 70%, stroke: 0.5pt + black)\n`;
        typst += `          #v(0.3em)\n`;
        typst += `          #text(size: 11pt, weight: "bold")[Project Guide]\n`;
        if (guide) typst += `          #v(0.2em)\n          #text(size: 10pt)[(${escapeTypst(guide)})]\n`;
        typst += `        ],\n`;
        typst += `        align(center)[\n`;
        typst += `          #line(length: 70%, stroke: 0.5pt + black)\n`;
        typst += `          #v(0.3em)\n`;
        typst += `          #text(size: 11pt, weight: "bold")[Head of Department]\n`;
        typst += `        ]\n`;
        typst += `      )\n`;
        typst += `    ]\n`;
        typst += `  ]\n`;
        typst += `]\n#pagebreak()\n\n`;
      } else if (isTocSection) {
        typst += `#heading(level: 1, numbering: none)[${escapeTypst(label || 'Table of Contents')}]\n`;
        typst += `#outline(title: none, indent: auto)\n#pagebreak()\n\n`;
        renderedToc = true;
      } else {
        // Regular front matter (Abstract, Acknowledgement, etc.)
        typst += `#heading(level: 1, numbering: none)[${escapeTypst(label)}]\n`;
        let fmText = '';
        if (content && content.content && Array.isArray(content.content)) {
          fmText = convertTipTapToTypst(content.content, imagePrefix);
        } else if (content && Array.isArray(content)) {
          fmText = convertTipTapToTypst(content, imagePrefix);
        } else if (typeof content === 'string' && content.trim()) {
          fmText = processTextNodeWithMath(content);
        } else if (label && String(label).toLowerCase().includes('abstract') && abstract) {
          fmText = processTextNodeWithMath(abstract);
        }
        typst += `${fmText}\n#pagebreak()\n\n`;
      }
    });
  }

  // 4. TOC and Lists
  if (project.templateId !== 'blank') {
    if (!renderedToc) {
      typst += `#heading(level: 1, numbering: none)[Table of Contents]\n`;
      typst += `#outline(title: none, indent: auto)\n#pagebreak()\n\n`;
    }
    
    if (enableListOfFigures) {
      typst += `#heading(level: 1, numbering: none)[List of Figures]\n`;
      typst += `#outline(title: none, target: figure.where(kind: image))\n#pagebreak()\n\n`;
    }
    
    if (enableListOfTables) {
      typst += `#heading(level: 1, numbering: none)[List of Tables]\n`;
      typst += `#outline(title: none, target: figure.where(kind: table))\n#pagebreak()\n\n`;
    }
  }

  // 5. Chapters - Enable Headers & Page Numbering Footers
  typst += `#set page(\n`;
  typst += `  header-ascent: 1.2em,\n`;
  typst += `  footer-descent: 1.2em,\n`;
  if (isHeaderActive && headerCode) {
    typst += `  header: context {\n    ${headerCode}\n  },\n`;
  } else {
    typst += `  header: none,\n`;
  }
  if (isFooterActive && footerCode) {
    typst += `  footer: context {\n    ${footerCode}\n  }\n`;
  } else if (isFooterActive) {
    typst += `  footer: context {\n    align(center)[#counter(page).display("1")]\n  }\n`;
  } else {
    typst += `  footer: none\n`;
  }
  typst += `)\n\n`;

  if (Array.isArray(project.chapters) && project.chapters.length > 0) {
    project.chapters.forEach((chapter, index) => {
      const cleanTitle = stripAllPrefixes(chapter.title || 'Chapter');

      // Extract content nodes from TipTap JSON (object with .content array)
      let contentNodes = [];
      if (chapter.content && chapter.content.content && Array.isArray(chapter.content.content)) {
        contentNodes = chapter.content.content;
      } else if (Array.isArray(chapter.content)) {
        contentNodes = chapter.content;
      }
      if (contentNodes.length > 0 && contentNodes[0].type === 'heading') {
        const firstHeadingText = stripAllPrefixes(contentNodes[0].content?.map(n => n.text).join('') || '');
        if (firstHeadingText.toLowerCase() === cleanTitle.toLowerCase()) {
          contentNodes = contentNodes.slice(1);
        }
      }
      
      // Determine minimum heading level used in chapter
      let minLevel = 99;
      const findMinHeading = (nodes) => {
        for (const n of nodes) {
          if (n.type === 'heading' && n.attrs?.level < minLevel) {
            minLevel = n.attrs.level;
          }
          if (n.content && Array.isArray(n.content)) findMinHeading(n.content);
        }
      };
      findMinHeading(contentNodes);
      
      // We want the min level to map to 2 (since 1 is chapter title)
      const shift = minLevel === 99 ? 0 : 2 - minLevel;
      
      // Emit level 1 heading with clean title — the #show rule auto-formats as "CHAPTER N: TITLE"
      typst += `#heading(level: 1)[${escapeTypst(cleanTitle)}]\n\n`;
      const chapterState = {
        lastOrderedEnd: 0,
        lastWasContinuation: false,
        chNum: index + 1,
        figCount: 0,
        tblCount: 0,
      };
      typst += convertTipTapToTypst(contentNodes, imagePrefix, shift, chapterState);
      if (index < project.chapters.length - 1) {
        typst += `\n#pagebreak()\n\n`;
      }
    });
  }

  const audit = auditTypstSource(typst);

  return {
    typst,
    images: extractedImages,
    safe: audit.safe,
    reason: audit.reason
  };
}

module.exports = {
  generateProjectTypst,
  convertTipTapToTypst
};
