/**
 * Compress an image File/Blob before upload using HTML5 Canvas.
 * Resizes to maxDimension (1600px max edge by default) and encodes to image/webp at 0.82 quality.
 * Skips SVGs and files under 100 KB.
 *
 * @param {File|Blob} file - The original image file
 * @param {number} [maxDimension=1600] - Max width or height in pixels
 * @param {number} [quality=0.82] - Target WebP quality (0.0 to 1.0)
 * @returns {Promise<File|Blob>} Compressed File/Blob, or original file if skipped/unsupported
 */
export async function compressImageForUpload(file, maxDimension = 1600, quality = 0.82) {
  if (!file || !(file instanceof Blob) || typeof window === 'undefined') {
    return file;
  }

  // Skip SVGs
  const isSvg = file.type === 'image/svg+xml' || (file.name && file.name.toLowerCase().endsWith('.svg'));
  if (isSvg) {
    return file;
  }

  // Skip files < 100 KB (100 * 1024 bytes)
  if (file.size < 100 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // If compression didn't actually reduce size, return original file
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }

          try {
            const baseName = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'compressed';
            const compressedFile = new File([blob], `${baseName}.webp`, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } catch (_) {
            resolve(blob);
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
