// Extracts the imageCaptionJS template literal from GlobalEditor.tsx,
// unescapes it, and syntax-checks the resulting injected JS.
const fs = require('fs');
const src = fs.readFileSync('components/GlobalEditor.tsx', 'utf8');
const marker = 'const imageCaptionJS = `';
const start = src.indexOf(marker);
if (start === -1) { console.error('marker not found'); process.exit(1); }
let i = start + marker.length, out = '';
while (i < src.length) {
  const c = src[i];
  if (c === '\\') { out += c + src[i + 1]; i += 2; continue; }
  if (c === '`') break;
  out += c; i++;
}
// Unescape template-literal escapes: \` -> `, \${ -> ${, \\ -> \
const js = out.replace(/\\`/g, '`').replace(/\\\$/g, '$').replace(/\\\\/g, '\\');
fs.writeFileSync('_paste_check.js', js);
try {
  new Function(js);
  console.log('imageCaptionJS: syntax OK,', js.length, 'chars');
} catch (e) {
  console.error('SYNTAX ERROR:', e.message);
  process.exit(1);
}
