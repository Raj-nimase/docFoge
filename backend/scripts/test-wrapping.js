const path = require('path');
const fs = require('fs');
const os = require('os');
const { generateProjectTypst } = require('../src/services/typstGenerator');
const { compileTypst, cleanupJob } = require('../src/services/typstRunner');

async function main() {
  console.log('--- Testing Typst Image Text Wrapping Integration ---');

  const dummyProject = {
    id: 'test-wrap-project',
    metadata: {
      title: 'Wrap Content Validation Test',
      author: 'DocForge Test'
    },
    chapters: [
      {
        id: 'chap-1',
        title: 'Wrapping Demonstration',
        content: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Wrap Content Test' }]
            },
            {
              type: 'image',
              attrs: {
                src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                alt: 'Test Pixel',
                placement: 'wrap-left',
                width: '30%'
              }
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'This is a sample paragraph that should wrap around the left-aligned image. ' +
                        'The Typst generator wraps this paragraph using the @preview/meander package. ' +
                        'We are verifying that the generated Typst syntax is valid and compiles cleanly. ' +
                        `[Run ID: ${Date.now()}]`
                }
              ]
            }
          ]
        }
      }
    ]
  };

  const jobId = `test_wrap_${Date.now()}`;
  const imagePrefix = 'test_wrap';

  // Step 1: Generate Typst code
  console.log('Generating Typst code...');
  const { typst, images, safe, reason } = generateProjectTypst(dummyProject, imagePrefix);

  if (!safe) {
    throw new Error(`Typst safety check failed: ${reason}`);
  }

  if (!typst.includes('meander.reflow')) {
    throw new Error('Generated Typst code does not contain meander.reflow command.');
  }

  console.log('Generated Typst successfully. Checking image assets...');

  // Step 2: Save extracted image assets to OS temp dir
  const TMP_DIR = path.join(os.tmpdir(), 'docforge');
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const extraFiles = [];
  if (images && images.length > 0) {
    for (const img of images) {
      const imgPath = path.join(TMP_DIR, img.filename);
      extraFiles.push(img.filename);
      if (img.base64) {
        fs.writeFileSync(imgPath, Buffer.from(img.base64, 'base64'));
      }
    }
  }

  // Step 3: Compile Typst source using real typst.exe via compileTypst
  console.log('Compiling document with Typst runner...');
  const { pdfPath, typPath, cached } = await compileTypst(typst, jobId);

  console.log(`Compilation finished. PDF produced at: ${pdfPath} (cached: ${cached})`);

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file was not found at ${pdfPath}`);
  }

  // Step 4: Verify cleanup
  console.log('Cleaning up temporary job files...');
  cleanupJob(jobId, extraFiles);

  const typFileExists = typPath ? fs.existsSync(typPath) : false;
  if (typFileExists) {
    throw new Error(`Cleanup failed: Temporary .typ file still exists at ${typPath}`);
  }

  console.log('Typst compilation with meander.reflow successful!');
}

main().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
