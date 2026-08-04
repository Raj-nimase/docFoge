import katex from 'katex';

/**
 * Hardcoded before/after samples for the hero demo loop.
 * Each sample is a list of blocks: `raw` is the messy text typed into the
 * left pane, `render` is the formatted block revealed on the A4 preview.
 * Preview block i appears once typing passes ~60% of its raw text, so the
 * page reads as if it is formatting itself live.
 */

function renderMath(latex) {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: true });
  } catch {
    return latex;
  }
}

const SAMPLES = [
  {
    id: 'chapter',
    file: 'chapter-1.docx',
    blocks: [
      {
        raw: 'chapter 1: introduction\n\n',
        render: { type: 'h1', lines: ['CHAPTER ONE', 'INTRODUCTION'] },
      },
      {
        raw: '1.1 background of the study\n',
        render: { type: 'h2', text: '1.1 Background of the Study' },
      },
      {
        raw: 'the rapid growth of machine learning has transformed how researchers approach data-driven problems across disciplines.\n\n',
        render: {
          type: 'p',
          text: 'The rapid growth of machine learning has transformed how researchers approach data-driven problems across disciplines.',
        },
      },
      {
        raw: '1.2 statement of the problem\n',
        render: { type: 'h2', text: '1.2 Statement of the Problem' },
      },
      {
        raw: 'despite these advances, few tools address the formatting burden placed on students.',
        render: {
          type: 'p',
          text: 'Despite these advances, few tools address the formatting burden placed on students.',
        },
      },
    ],
  },
  {
    id: 'math',
    file: 'methodology.md',
    blocks: [
      {
        raw: '3.2 loss function\n',
        render: { type: 'h2', text: '3.2 Loss Function' },
      },
      {
        raw: 'the model minimises the cross-entropy loss\n\n',
        render: { type: 'p', text: 'The model minimises the cross-entropy loss' },
      },
      {
        raw: '$$L(\\theta) = -\\frac{1}{N}\\sum_{i=1}^{N} y_i \\log \\hat{y}_i$$\n\n',
        render: {
          type: 'math',
          html: renderMath('L(\\theta) = -\\frac{1}{N}\\sum_{i=1}^{N} y_i \\log \\hat{y}_i'),
          eqNumber: '(3.1)',
        },
      },
      {
        raw: 'where N is the number of training samples.',
        render: {
          type: 'p',
          text: 'where N is the number of training samples.',
        },
      },
    ],
  },
  {
    id: 'table',
    file: 'results.md',
    blocks: [
      {
        raw: '4.3 model comparison\n',
        render: { type: 'h2', text: '4.3 Model Comparison' },
      },
      {
        raw: 'results on the held-out test set:\n\n',
        render: { type: 'p', text: 'Results on the held-out test set are summarised below.' },
      },
      {
        raw: '| model | accuracy | f1 |\n|---|---|---|\n| baseline | 84.2 | 0.81 |\n| proposed | 91.7 | 0.90 |',
        render: {
          type: 'table',
          caption: 'Table 4.1: Comparison of model performance',
          head: ['Model', 'Accuracy (%)', 'F1'],
          rows: [
            ['Baseline', '84.2', '0.81'],
            ['Proposed', '91.7', '0.90'],
          ],
        },
      },
    ],
  },
];

// Derived data: full raw string + the char count at which each preview
// block becomes visible (~60% of the way through typing that block).
for (const sample of SAMPLES) {
  let offset = 0;
  for (const block of sample.blocks) {
    block.revealAt = offset + Math.ceil(block.raw.length * 0.6);
    offset += block.raw.length;
  }
  sample.fullRaw = sample.blocks.map((b) => b.raw).join('');
}

export default SAMPLES;
