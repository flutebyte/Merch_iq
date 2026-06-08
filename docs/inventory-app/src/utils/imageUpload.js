const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export async function uploadImage(file, token) {
  const presignRes = await fetch(`${BASE_URL}/storage/presigned-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
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
        'Content-Type': file.type || 'image/jpeg',
        Authorization: `Bearer ${token}`,
      },
      body: file,
    });
    if (!uploadRes.ok) throw new Error('Upload failed');
    const { fileUrl: devFileUrl } = await uploadRes.json();
    return `${BASE_URL}${devFileUrl}`;
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error('Upload to storage failed');
  return fileUrl;
}
