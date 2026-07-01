/**
 * storageService.js — Cloudinary image upload abstraction.
 * Reads credentials from env vars:
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload an image buffer to Cloudinary.
 * @param {string} userId      - The authenticated user's ID (used for folder namespacing).
 * @param {Buffer} buffer      - Raw image bytes.
 * @param {string} mimeType    - e.g. 'image/png'
 * @returns {Promise<string>}  - The secure HTTPS URL of the uploaded image.
 */
async function uploadImageBuffer(userId, buffer, mimeType) {
  const resourceType = 'image';
  const folder = `docforge/${userId}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder,
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(new Error(error.message || 'Cloudinary upload failed'));
        resolve(result.secure_url);
      },
    );

    uploadStream.end(buffer);
  });
}

module.exports = { uploadImageBuffer };
