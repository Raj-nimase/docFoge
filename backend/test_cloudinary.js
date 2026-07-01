require('dotenv').config();
const { uploadImageBuffer } = require('./src/services/storageService');
const fs = require('fs');

async function testUpload() {
  try {
    // Create a tiny 1x1 pixel transparent PNG buffer
    const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    console.log('Attempting upload to Cloudinary...');
    const url = await uploadImageBuffer('test_user', buffer, 'image/png');
    console.log('Success! URL:', url);
  } catch (err) {
    console.error('Upload failed:', err.message);
  }
}

testUpload();
