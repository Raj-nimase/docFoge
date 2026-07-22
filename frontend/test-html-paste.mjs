import { JSDOM } from "jsdom";
const dom = new JSDOM("");
globalThis.DOMParser = dom.window.DOMParser;
globalThis.document = dom.window.document;
globalThis.NodeFilter = dom.window.NodeFilter;

import { transformMathHtml } from "./src/hooks/useMathPaste/htmlParser.js";
import fs from "fs";

const rawFile = fs.readFileSync("../backend/clipboard_debug.txt", "utf-8");
const startIdx = rawFile.indexOf("<!--StartFragment-->");
const endIdx = rawFile.indexOf("<!--EndFragment-->");
const originalHtml = rawFile.slice(startIdx, endIdx + "<!--EndFragment-->".length);

console.log("=== TRANSFORMING HTML ===");
const result = transformMathHtml(originalHtml);
console.log("=== RESULT HTML ===");
console.log(result);

const tests = [
  {
    name: "L_CE equation is fully reconstructed into a single display math block",
    pass: result.includes('data-latex="\\mathcal{L}_{CE} = -\\sum_{i=1}^{N}\\sum_{j=1}^{C} y_{ij}\\log(\\hat y_{ij})"')
  },
  {
    name: "J(theta) equation is fully reconstructed into a single display math block",
    pass: result.includes('data-latex="\\nabla_\\theta J(\\theta) = \\frac{1}{m} \\sum_{i=1}^{m} \\left(h_\\theta(x_i)-y_i\\right)x_i"')
  },
  {
    name: "P(A|B) equation is fully reconstructed into a single display math block",
    pass: result.includes('data-latex="P(A|B) = \\frac{P(B|A)P(A)}{P(B)}"')
  },
  {
    name: "No raw bullet point containing \\sum_{i=1}^{N} remains",
    pass: !result.includes('<li>\\sum_{i=1}^{N}') && !result.includes('<li>-\\sum_{i=1}^{N}')
  }
];

console.log("\n=== HTML PASTE TEST RESULTS ===");
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
