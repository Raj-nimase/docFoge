import { normalizeLatexPaste } from "./src/hooks/useMathPaste/mathUtils.js";
import { parseMarkdownMathToHtml, looksLikeMarkdownMath } from "./src/hooks/useMathPaste/markdownParser.js";

const testDoc = `
It can also contain complex equations such as:

[
\\text{Attention}(Q,K,V)=\\operatorname{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V
]

[
\\mathcal{L}_{CE}
================

-\\sum_{i=1}^{N}\\sum_{j=1}^{C}
y_{ij}\\log(\\hat y_{ij})
]

[
\\nabla_\\theta J(\\theta)
=======================

\\frac{1}{m}
\\sum_{i=1}^{m}
\\left(h_\\theta(x_i)-y_i\\right)x_i
]

[
A=U\\Sigma V^\\top
]

[
P(A|B)
======

\\frac{P(B|A)P(A)}{P(B)}
]

along with matrices such as

[
A=
\\begin{bmatrix}
1&2&3\\
4&5&6\\
7&8&9
\\end{bmatrix}
]
`;

console.log("looksLikeMarkdownMath:", looksLikeMarkdownMath(testDoc));
const norm = normalizeLatexPaste(testDoc);
console.log("=== NORMALIZED ===");
console.log(norm);
console.log("=== HTML ===");
const html = parseMarkdownMathToHtml(norm);
console.log(html);

const tests = [
  {
    name: "L_CE equation is ONE display formula block with =",
    pass: html.includes('data-latex="\\mathcal{L}_{CE} = -\\sum_{i=1}^{N}\\sum_{j=1}^{C} y_{ij}\\log(\\hat y_{ij})"')
  },
  {
    name: "nabla J(theta) equation is ONE display formula block with =",
    pass: html.includes('data-latex="\\nabla_\\theta J(\\theta) = \\frac{1}{m} \\sum_{i=1}^{m} \\left(h_\\theta(x_i)-y_i\\right)x_i"')
  },
  {
    name: "P(A|B) equation is ONE display formula block with =",
    pass: html.includes('data-latex="P(A|B) = \\frac{P(B|A)P(A)}{P(B)}"')
  },
  {
    name: "Matrix bmatrix row breaks \\\\ are preserved cleanly",
    pass: html.includes('\\\\') && html.includes('1&amp;2&amp;3 \\\\ 4&amp;5&amp;6 \\\\ 7&amp;8&amp;9')
  }
];

console.log("\n=== TEST RESULTS ===");
let allPassed = true;
for (const t of tests) {
  if (t.pass) {
    console.log(`✓ PASS: ${t.name}`);
  } else {
    console.log(`✗ FAIL: ${t.name}`);
    allPassed = false;
  }
}

if (!allPassed) {
  process.exit(1);
}
