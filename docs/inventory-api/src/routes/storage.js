const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB per spec §16.2

function makeS3Client() {
  if (!process.env.S3_ACCESS_KEY_ID) return null;
  return new S3Client({
    region:   process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId:     process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

router.post('/presigned-upload', async (req, res, next) => {
  try {
    const { mimeType, sizeBytes, purpose = 'product-photo' } = req.body;

    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ error: 'unsupported file type', allowed: ALLOWED_MIME_TYPES });
    }
    if (!sizeBytes || sizeBytes > MAX_SIZE_BYTES) {
      return res.status(400).json({ error: 'file too large', maxBytes: MAX_SIZE_BYTES });
    }

    const s3 = makeS3Client();
    if (!s3 || !process.env.S3_BUCKET) {
      // Dev mode — no real storage configured; return a placeholder URL
      const fileId = uuidv4();
      return res.json({
        uploadUrl: null,
        fileUrl:   `/dev-uploads/${fileId}`,
        fileId,
        devMode:   true,
      });
    }

    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const key = `${purpose}/${req.brandId}/${uuidv4()}.${ext}`;
    const cmd = new PutObjectCommand({
      Bucket:      process.env.S3_BUCKET,
      Key:         key,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });

    res.json({
      uploadUrl,
      fileUrl: `https://${process.env.S3_BUCKET}/${key}`,
      fileId:  key,
    });
  } catch (err) { next(err); }
});

module.exports = router;
