import { api } from './client';

export const storageApi = {
  getPresignedUpload: (mimeType, sizeBytes, purpose, token) =>
    api.post('/storage/presigned-upload', { mimeType, sizeBytes, purpose }, token),

  uploadFile: async (uploadUrl, file) => {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) throw new Error('Upload failed');
  },
};
