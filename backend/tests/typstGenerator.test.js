const test = require('node:test');
const assert = require('node:assert/strict');
const { generateProjectTypst, convertTipTapToTypst } = require('../src/services/typstGenerator');

test('typstGenerator - does not import wrap-it when no wrapped images are present', () => {
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
  assert.equal(result.typst.includes('#import "@preview/wrap-it:0.1.1": wrap-content'), false);
});

test('typstGenerator - imports wrap-it when wrap-left image is present', () => {
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
  assert.equal(result.typst.includes('#import "@preview/wrap-it:0.1.1": wrap-content'), true);
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

  assert.equal(typstOutput.includes('#wrap-content('), true);
  assert.equal(typstOutput.includes('align: left'), true);
  assert.equal(typstOutput.includes('column-gutter: 1.5em'), true);
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

  assert.equal(typstOutput.includes('#wrap-content('), true);
  assert.equal(typstOutput.includes('align: right'), true);
  assert.equal(typstOutput.includes('Right wrapped paragraph.'), true);
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
  assert.equal(typstOutputLeft.includes('#wrap-content('), false);
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
  assert.equal(typstOutputRight.includes('#wrap-content('), false);
  assert.equal(typstOutputRight.includes('#figure('), true);
  assert.equal(typstOutputRight.includes('#align(right)'), true);
});
