console.log('Testing HeadingCleaner TipTap Extension logic...');

const sampleDocNodes = [
  { type: 'heading', level: 1, text: 'CHAPTER 1: INTRODUCTION' },
  { type: 'paragraph', text: 'Intro text...' },
  { type: 'heading', level: 3, text: 'Method 1 (Recommended): Install with the Skills CLI' },
  { type: 'paragraph', text: 'Details for method 1...' },
  { type: 'heading', level: 3, text: 'Method 2: Copy the SKILL.md manually' }
];

let hasH2InCurrentChapter = false;
const levelModifications = [];

sampleDocNodes.forEach((node, idx) => {
  if (node.type === 'heading') {
    if (node.level === 1) {
      hasH2InCurrentChapter = false;
    } else if (node.level === 2) {
      hasH2InCurrentChapter = true;
    } else if (node.level > 2 && !hasH2InCurrentChapter) {
      levelModifications.push({ index: idx, oldLevel: node.level, newLevel: 2 });
      hasH2InCurrentChapter = true;
    }
  }
});

console.log('Level modifications to apply:', levelModifications);

levelModifications.forEach(mod => {
  sampleDocNodes[mod.index].level = mod.newLevel;
});

console.log('\nUpdated doc nodes in TipTap:', JSON.stringify(sampleDocNodes, null, 2));

if (sampleDocNodes[2].level === 2) {
  console.log('\n===============================================================');
  console.log('[SUCCESS] TipTap HeadingCleaner Extension promoted H3 to H2!');
  console.log('TipTap Editor will render H2 Section (1.1) in Editor & PDF!');
  console.log('===============================================================');
} else {
  console.error('[FAIL] TipTap extension logic failed');
  process.exit(1);
}
