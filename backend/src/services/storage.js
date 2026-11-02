const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

// Local fallback so the prototype runs without a Cloudinary account.
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const saveImage = async (buffer, { folder = 'items', mimetype = 'image/jpeg' } = {}) => {
  if (isCloudinaryConfigured) {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `findit/${folder}`,
          transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
        },
        (err, res) => (err ? reject(err) : resolve(res))
      ).end(buffer);
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  const name = `${crypto.randomUUID()}.${EXT[mimetype] || 'jpg'}`;
  const dir = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buffer);
  return { url: `/uploads/${folder}/${name}`, publicId: `local:${folder}/${name}` };
};

// Saves a "data:image/jpeg;base64,..." string (e.g. the annotated image).
const saveDataUrl = async (dataUrl, folder) => {
  const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  return saveImage(Buffer.from(match[2], 'base64'), { folder, mimetype: match[1] });
};

// Reads the bytes of an image we stored earlier (used to re-run AI analysis).
const loadImage = async (image) => {
  if (!image?.url) return null;
  if (image.publicId?.startsWith('local:')) {
    const rel = image.publicId.slice('local:'.length);
    const full = path.join(UPLOAD_ROOT, rel);
    if (!full.startsWith(UPLOAD_ROOT)) return null;
    return fs.readFile(full);
  }
  // Only URLs we generated ourselves are ever fetched (never user input).
  if (image.url.startsWith('https://res.cloudinary.com/')) {
    const res = await axios.get(image.url, { responseType: 'arraybuffer', timeout: 20000 });
    return Buffer.from(res.data);
  }
  return null;
};

const deleteImage = async (image) => {
  if (!image?.publicId) return;
  try {
    if (image.publicId.startsWith('local:')) {
      const full = path.join(UPLOAD_ROOT, image.publicId.slice('local:'.length));
      if (full.startsWith(UPLOAD_ROOT)) await fs.unlink(full);
    } else if (isCloudinaryConfigured) {
      await cloudinary.uploader.destroy(image.publicId);
    }
  } catch (_) {
    // Missing files are not worth failing a request over.
  }
};

module.exports = { saveImage, saveDataUrl, loadImage, deleteImage, UPLOAD_ROOT };
