/**
 * storageService.js — Cloudinary image upload and management abstraction.
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
 * Extract Cloudinary public_id from a full Cloudinary URL.
 * Matches /upload/(?:v\d+/)?(.+?)\.[a-z0-9]+$/i
 * Example: https://res.cloudinary.com/demo/image/upload/v1234567/docforge/user1/proj1/img.png -> docforge/user1/proj1/img
 * @param {string} url
 * @returns {string|null}
 */
function extractPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i);
  return match ? match[1] : null;
}

/**
 * Upload an image buffer to Cloudinary.
 * @param {string} userId      - The authenticated user's ID (used for folder namespacing).
 * @param {string} [projectId] - Optional project ID for folder namespacing.
 * @param {Buffer} buffer      - Raw image bytes.
 * @param {string} mimeType    - e.g. 'image/png'
 * @returns {Promise<string>}  - The secure HTTPS URL of the uploaded image.
 */
async function uploadImageBuffer(userId, projectId, buffer, mimeType) {
  // Support legacy 3-argument calls: (userId, buffer, mimeType)
  if (Buffer.isBuffer(projectId)) {
    mimeType = buffer;
    buffer = projectId;
    projectId = null;
  }

  const resourceType = 'image';
  const folder = projectId ? `docforge/${userId}/${projectId}` : `docforge/${userId}/general`;
  const tags = projectId ? [userId, projectId] : [userId];

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder,
        tags,
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

/**
 * Delete a single image from Cloudinary given its URL.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function deleteImageByUrl(url) {
  const publicId = extractPublicIdFromUrl(url);
  if (!publicId) return false;
  await cloudinary.uploader.destroy(publicId);
  return true;
}

/**
 * Delete all Cloudinary images and folder for a specific user project.
 * @param {string} userId
 * @param {string} projectId
 * @returns {Promise<boolean>}
 */
async function deleteProjectImages(userId, projectId) {
  if (!userId || !projectId) return false;
  const prefix = `docforge/${userId}/${projectId}`;
  try {
    await cloudinary.api.delete_resources_by_prefix(prefix);
  } catch (err) {
    console.warn(`[storageService] delete_resources_by_prefix failed for ${prefix}:`, err.message);
  }
  try {
    await cloudinary.api.delete_folder(prefix);
  } catch (err) {
    console.warn(`[storageService] delete_folder failed for ${prefix}:`, err.message);
  }
  return true;
}

module.exports = {
  uploadImageBuffer,
  deleteImageByUrl,
  deleteProjectImages,
  extractPublicIdFromUrl,
};

