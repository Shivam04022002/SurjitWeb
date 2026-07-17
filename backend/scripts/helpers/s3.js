// Idempotent S3 image uploader for migrations.
// - Uses a DETERMINISTIC key derived from the album/folder + source filename,
//   so re-running the migration never creates duplicate objects.
// - Checks HeadObject first: if the object already exists, its URL is reused
//   without re-uploading.
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { S3Client, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { slugify } = require('./assets');

const BUCKET = process.env.AWS_S3_BUCKET_NAME;
const REGION = process.env.AWS_REGION || 'ap-south-1';
const BASE_URL =
    process.env.AWS_S3_BASE_URL ||
    (BUCKET ? `https://${BUCKET}.s3.${REGION}.amazonaws.com` : '');

const isConfigured = Boolean(BUCKET && process.env.AWS_ACCESS_KEY_ID);

const s3 = isConfigured
    ? new S3Client({
        region: REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    })
    : null;

const MIME = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml'
};

const buildKey = (folder, sourceFileName) => {
    const ext = path.extname(sourceFileName).toLowerCase() || '.jpg';
    return `migration/${folder}/${slugify(sourceFileName)}${ext}`;
};

// Upload a local file to S3 idempotently. Returns { url, fileName, size } or
// null when S3 is not configured / the source file is missing.
const uploadImage = async (localPath, folder, sourceFileName) => {
    if (!isConfigured) return null;
    if (!localPath || !fs.existsSync(localPath)) return null;

    const key = buildKey(folder, sourceFileName || path.basename(localPath));
    const size = fs.statSync(localPath).size;
    const url = `${BASE_URL}/${key}`;

    // Reuse if the object already exists.
    try {
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        return { url, fileName: key, size, reused: true };
    } catch (err) {
        if (!(err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404)) {
            // A real error (perms, network) — surface it.
            if (err.$metadata?.httpStatusCode !== 404) throw err;
        }
    }

    const ext = path.extname(key).toLowerCase();
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: fs.createReadStream(localPath),
        ContentType: MIME[ext] || 'application/octet-stream',
        ContentLength: size
    }));

    return { url, fileName: key, size, reused: false };
};

module.exports = { uploadImage, isConfigured, BUCKET, BASE_URL };
