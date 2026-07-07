const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'dist', 'index.html');
const outputPath = path.join(__dirname, '..', 'app', 'editor', '_customHtml.ts');

if (!fs.existsSync(htmlPath)) {
  console.error('Error: dist/index.html not found! Run npm run build first.');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');

// Escape backslashes, backticks, and template literal placeholders
const escapedHtml = html
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\${/g, '\\${');

const tsContent = `export const CUSTOM_EDITOR_HTML = \`${escapedHtml}\`;\n`;

fs.writeFileSync(outputPath, tsContent, 'utf8');
console.log('Successfully generated customHtml.ts!');
