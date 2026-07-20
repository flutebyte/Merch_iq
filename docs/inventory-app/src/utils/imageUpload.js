const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const COMPRESS_MAX_DIMENSION = 1600;
const COMPRESS_QUALITY = 0.82;
const COMPRESS_SKIP_BELOW_BYTES = 400 * 1024; // already small enough — not worth the CPU cost

// Phone cameras routinely produce 3-12MB photos. On the mobile data plans common
// among the SMBs this app targets, uploading those raw per product is slow, can
// time out on patchy connections, and burns through real data allowance. Downscale
// and re-encode as JPEG client-side before every upload; if the browser can't
// decode the file (e.g. some HEIC cases) or the result isn't actually smaller,
// fall back to the original so the upload still proceeds.
async function compressImage(file) {
  if (!file.type || !file.type.startsWith('image/') || file.size <= COMPRESS_SKIP_BELOW_BYTES) {
    return file;
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });

    const scale = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', COMPRESS_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name ? file.name.replace(/\.\w+$/, '.jpg') : 'photo.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch (_) {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadImage(file, token) {
  const uploadFile = await compressImage(file);

  const presignRes = await fetch(`${BASE_URL}/storage/presigned-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mimeType: uploadFile.type, sizeBytes: uploadFile.size }),
  });
  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to get upload URL');
  }
  const { uploadUrl, fileUrl, devMode } = await presignRes.json();

  if (devMode) {
    // Send raw binary — no base64 conversion, no JSON body size limits
    const uploadRes = await fetch(`${BASE_URL}/storage/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': uploadFile.type || 'image/jpeg',
        Authorization: `Bearer ${token}`,
      },
      body: uploadFile,
    });
    if (!uploadRes.ok) throw new Error('Upload failed');
    const { fileUrl: devFileUrl } = await uploadRes.json();
    return `${BASE_URL}${devFileUrl}`;
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': uploadFile.type },
    body: uploadFile,
  });
  if (!putRes.ok) throw new Error('Upload to storage failed');
  return fileUrl;
}
