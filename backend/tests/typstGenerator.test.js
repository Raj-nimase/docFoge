const test = require('node:test');
const assert = require('node:assert/strict');
const { generateProjectTypst, convertTipTapToTypst } = require('../src/services/typstGenerator');

const MEANDER_IMPORT = '#import "@preview/meander:0.4.4"';

test('typstGenerator - does not import meander when no wrapped images are present', () => {
  const project = {
    metadata: { title: 'Test Document' },
    chapters: [
      {
        title: 'Chapter 1',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello World' }]
          },
          {
            type: 'image',
            attrs: {
              src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              width: '50%',
              placement: 'none'
            }
          }
        ]
      }
    ]
  };

  const result = generateProjectTypst(project, 'test');
  assert.equal(result.typst.includes(MEANDER_IMPORT), false);
});

test('typstGenerator - imports meander when wrap-left image is present', () => {
  const project = {
    metadata: { title: 'Test Document' },
    chapters: [
      {
        title: 'Chapter 1',
        content: [
          {
            type: 'image',
            attrs: {
              src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              width: '50%',
              placement: 'wrap-left'
            }
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Wrapped text here' }]
          }
        ]
      }
    ]
  };

  const result = generateProjectTypst(project, 'test');
  assert.equal(result.typst.includes(MEANDER_IMPORT), true);
});

test('typstGenerator - convertTipTapToTypst wraps image with following paragraphs (wrap-left)', () => {
  const state = { figCount: 0 };
  const nodes = [
    {
      type: 'image',
      attrs: {
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        width: '40%',
        placement: 'wrap-left',
        alt: 'Sample Image'
      }
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'First wrapped paragraph.' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Second wrapped paragraph.' }]
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Next Section' }]
    }
  ];

  const typstOutput = convertTipTapToTypst(nodes, 'test_img', 0, state);

  assert.equal(typstOutput.includes('#meander.reflow({'), true);
  assert.equal(typstOutput.includes('#pagebreak(weak: true)'), true);
  assert.equal(typstOutput.includes('opt.placement.spacing(both: 0.65em)'), true);
  assert.equal(typstOutput.includes('placed(top + left,'), true);
  assert.equal(typstOutput.includes('container(margin: 1.5em)'), true);
  assert.equal(typstOutput.includes('First wrapped paragraph.'), true);
  assert.equal(typstOutput.includes('Second wrapped paragraph.'), true);
  assert.equal(typstOutput.includes('== Next Section'), true);
});

test('typstGenerator - convertTipTapToTypst wraps image with following paragraphs (wrap-right)', () => {
  const state = { figCount: 0 };
  const nodes = [
    {
      type: 'image',
      attrs: {
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        width: '40%',
        placement: 'wrap-right'
      }
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Right wrapped paragraph.' }]
    }
  ];

  const typstOutput = convertTipTapToTypst(nodes, 'test_img', 0, state);

  assert.equal(typstOutput.includes('#meander.reflow({'), true);
  assert.equal(typstOutput.includes('placed(top + right,'), true);
  assert.equal(typstOutput.includes('Right wrapped paragraph.'), true);
});

test('typstGenerator - convertTipTapToTypst uses editor width for wrap images', () => {
  const state = { figCount: 0 };
  const nodes = [
    {
      type: 'image',
      attrs: {
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        width: '80%',
        placement: 'wrap-left'
      }
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Wrapped beside a wide image.' }]
    }
  ];

  const typstOutput = convertTipTapToTypst(nodes, 'test_img', 0, state);

  assert.equal(typstOutput.includes('box(width: 80%'), true);
  assert.equal(typstOutput.includes('box(width: 45%'), false);
});

test('typstGenerator - convertTipTapToTypst falls back to aligned figure if no paragraphs follow wrapped image', () => {
  const state = { figCount: 0 };
  const nodesLeft = [
    {
      type: 'image',
      attrs: {
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        width: '40%',
        placement: 'wrap-left'
      }
    }
  ];

  const typstOutputLeft = convertTipTapToTypst(nodesLeft, 'test_img', 0, state);
  assert.equal(typstOutputLeft.includes('#meander.reflow({'), false);
  assert.equal(typstOutputLeft.includes('#figure('), true);
  assert.equal(typstOutputLeft.includes('#align(left)'), true);

  const nodesRight = [
    {
      type: 'image',
      attrs: {
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        width: '40%',
        placement: 'wrap-right'
      }
    }
  ];

  const typstOutputRight = convertTipTapToTypst(nodesRight, 'test_img', 0, state);
  assert.equal(typstOutputRight.includes('#meander.reflow({'), false);
  assert.equal(typstOutputRight.includes('#figure('), true);
  assert.equal(typstOutputRight.includes('#align(right)'), true);
});

test('typstGenerator - assigns labels to figures and tables and compiles reference nodes to @ref', () => {
  const state = { figCount: 0, tblCount: 0 };
  const nodes = [
    {
      type: 'table',
      attrs: { caption: 'API Requirements' },
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'text', text: 'Data' }]
            }
          ]
        }
      ]
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'As shown in ' },
        {
          type: 'reference',
          attrs: { targetId: 'tbl-1', targetType: 'table', label: 'Table 1: API Requirements', refCode: 'tbl-1' }
        },
        { type: 'text', text: '.' }
      ]
    }
  ];

  const typstOutput = convertTipTapToTypst(nodes, 'test_img', 0, state);
  assert.equal(typstOutput.includes('<tbl-1>'), true);
  assert.equal(typstOutput.includes('@tbl-1'), true);
});

test('typstGenerator - compiles [@Figure 1] and [@Table 1] text tags directly to @fig-1 and @tbl-1', () => {
  const state = { figCount: 0, tblCount: 0 };
  const nodes = [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Refer to [@Figure 1] and [@Table 2] for details.' }
      ]
    }
  ];

  const typstOutput = convertTipTapToTypst(nodes, 'test_img', 0, state);
  assert.equal(typstOutput.includes('@fig-1'), true);
  assert.equal(typstOutput.includes('@tbl-2'), true);
});

