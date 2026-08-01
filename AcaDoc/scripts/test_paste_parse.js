// Functional test: run the editor's paste parser (mmParse) against the real
// markdown produced by the PDF converter and report the node structure.
const fs = require('fs');
let js = fs.readFileSync('_paste_check.js', 'utf8');

// Expose the closure internals for testing: inject an export just before the
// end of the IIFE body.
const closeIdx = js.lastIndexOf('})();');
if (closeIdx === -1) { console.error('IIFE close not found'); process.exit(1); }
js = js.slice(0, closeIdx) +
  '\nwindow.__test = { mmParse: mmParse, mmLooksMarkdown: mmLooksMarkdown, mmLooksMathy: mmLooksMathy, mmWillConvert: mmWillConvert, mmInlineToNodes: mmInlineToNodes };\n' +
  js.slice(closeIdx);

// Minimal DOM/window stubs so the script body can run under Node.
const listeners = {};
global.window = {
  ReactNativeWebView: null,
  addEventListener() {},
};
global.document = {
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() {
    return { innerHTML: '', childNodes: [], appendChild() {}, setAttribute() {}, style: {} };
  },
  getElementById() { return null; },
  head: { appendChild() {} },
  body: { appendChild() {} },
};
global.MutationObserver = class { observe() {} disconnect() {} };

eval(js);
const T = global.window.__test;

const md = fs.readFileSync(process.argv[2] || '../../pdf-parser/out_semantic.md', 'utf8');

console.log('mmLooksMarkdown:', T.mmLooksMarkdown(md));
console.log('mmLooksMathy:', T.mmLooksMathy(md));
console.log('mmWillConvert:', T.mmWillConvert('', md));

const nodes = T.mmParse(md);
const counts = {};
let emptyParas = 0, boldMarks = 0, mathNodes = 0, images = 0;
function scan(n) {
  counts[n.type] = (counts[n.type] || 0) + 1;
  if (n.type === 'paragraph' && (!n.content || !n.content.length)) emptyParas++;
  if (n.type === 'text' && n.marks && n.marks.some(m => m.type === 'bold')) boldMarks++;
  if (n.type === 'image' && n.attrs) {
    if (n.attrs.src === 'katexmath') mathNodes++;
    else if (/^https?:/.test(n.attrs.src)) images++;
  }
  (n.content || []).forEach(scan);
}
nodes.forEach(scan);
console.log('top-level nodes:', nodes.length);
console.log('node counts:', JSON.stringify(counts));
console.log('bold text nodes:', boldMarks, '| katex nodes:', mathNodes, '| real images:', images, '| empty paras:', emptyParas);

// Show the first 12 top-level nodes as a structural outline
nodes.slice(0, 12).forEach((n, i) => {
  let label = n.type;
  if (n.type === 'heading') label += ` h${n.attrs.level} "${(n.content || []).map(c => c.text || '').join('').slice(0, 40)}"`;
  if (n.type === 'paragraph') label += ` "${(n.content || []).map(c => c.text || (c.attrs && c.attrs.alt ? '[math:' + c.attrs.alt.slice(0, 15) + ']' : '')).join('').slice(0, 60)}"`;
  if (n.type === 'image') label += ` src=${(n.attrs.src || '').slice(0, 40)}`;
  if (n.type === 'bulletList' || n.type === 'orderedList') label += ` (${(n.content || []).length} items)`;
  console.log(`  [${i}] ${label}`);
});
