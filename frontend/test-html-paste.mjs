import { JSDOM } from "jsdom";
const dom = new JSDOM("");
globalThis.DOMParser = dom.window.DOMParser;
globalThis.document = dom.window.document;
globalThis.NodeFilter = dom.window.NodeFilter;

import { transformMathHtml } from "./src/hooks/useMathPaste/htmlParser.js";
import fs from "fs";

const rawFile = fs.readFileSync("../backend/clipboard_debug.txt", "utf-8");
const startIdx = rawFile.lastIndexOf("<!--StartFragment-->");
const endIdx = rawFile.indexOf("<!--EndFragment-->", startIdx);
const originalHtml = rawFile.slice(startIdx, endIdx + "<!--EndFragment-->".length);

console.log("=== TRANSFORMING HTML ===");
const result = transformMathHtml(originalHtml);
console.log("=== RESULT HTML ===");
console.log(result);

const tests = [
  {
    name: "Web MathJax equation N_s = 120f / P is converted to display math span",
    pass: result.includes('data-latex="N_{s} = \\frac{120 f}{P}"') || result.includes('data-latex="N_{s} = \\frac{120f}{P}"') || result.includes('data-latex="N_s = \\frac{120f}{P}"')
  },
  {
    name: "MathJax display attribute data-display=\"true\" is present",
    pass: result.includes('data-display="true"')
  },
  {
    name: "No MathJax DOM elements (mjx-chtml, MathJax_Preview) remain",
    pass: !result.includes('mjx-chtml') && !result.includes('MathJax_Preview')
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
