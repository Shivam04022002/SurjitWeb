const { DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');
const s3Client = require('../config/s3');
const env = require('../config/env');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Extension per type, for images the server writes itself. Multer takes the
// extension from the uploaded filename; a generated image has no filename, only
// a media type.
const EXTENSIONS = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const buildFileResult = (file) => {
    const isS3 = !!(env.AWS_S3_BUCKET_NAME && env.AWS_ACCESS_KEY_ID);

    if (isS3) {
        return {
            url: file.location,
            fileName: file.key,
            size: file.size
        };
    }

    // Local disk. The path is taken relative to the uploads root rather than
    // from file.filename alone, because uploads are written into per-module
    // folders (reports/, gallery/images/, …) and dropping the folder leaves a
    // url that 404s and a fileName that deletion cannot resolve. On S3 the key
    // above already carries the folder, which is why this only shows locally.
    const uploadsRoot = path.join(__dirname, '..', 'uploads');
    const relative = path.relative(uploadsRoot, file.path).split(path.sep).join('/');

    return {
        url: `/uploads/${relative}`,
        fileName: relative,
        size: file.size
    };
};

const deleteFromS3 = async (fileKey) => {
    if (!fileKey || !env.AWS_S3_BUCKET_NAME) return;

    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: env.AWS_S3_BUCKET_NAME,
            Key: fileKey
        }));
    } catch (err) {
        // Non-critical — log but don't throw
    }
};

const deleteLocalFile = (fileName) => {
    if (!fileName) return;
    try {
        const filePath = path.join(__dirname, '..', 'uploads', fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        // Non-critical
    }
};

const deleteUploadedFile = async (fileNameOrKey) => {
    if (!fileNameOrKey) return;

    const isS3 = !!(env.AWS_S3_BUCKET_NAME && env.AWS_ACCESS_KEY_ID);
    if (isS3) {
        await deleteFromS3(fileNameOrKey);
    } else {
        deleteLocalFile(fileNameOrKey);
    }
};

// Stores an image the server itself produced, rather than one a browser sent.
//
// Every other image here arrives through multer, which writes it and hands back
// a file to describe. A scheduled blog has no request behind it: the image is
// generated in-process, so it is written the same way multer would — same
// folder, same naming, same S3-or-disk decision — and described by the same
// buildFileResult, so what reaches the Blog model is indistinguishable from an
// uploaded one.
const storeImageBuffer = async (buffer, { mimeType = 'image/png', folder = 'blog', fieldName = 'featuredImage' } = {}) => {
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
        throw new Error('storeImageBuffer needs a non-empty buffer');
    }
    const extension = EXTENSIONS[mimeType] || '.png';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const isS3 = !!(env.AWS_S3_BUCKET_NAME && env.AWS_ACCESS_KEY_ID);

    if (isS3) {
        const key = `${folder}/${uniqueSuffix}${extension}`;
        await s3Client.send(new PutObjectCommand({
            Bucket: env.AWS_S3_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: mimeType
        }));
        return {
            url: `https://${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${key}`,
            fileName: key,
            size: buffer.length
        };
    }

    const uploadPath = path.join(__dirname, '..', 'uploads', folder);
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    const name = `${fieldName}-${uniqueSuffix}${extension}`;
    fs.writeFileSync(path.join(uploadPath, name), buffer);

    return {
        url: `/uploads/${folder}/${name}`,
        fileName: `${folder}/${name}`,
        size: buffer.length
    };
};

module.exports = {
    buildFileResult,
    deleteUploadedFile,
    storeImageBuffer,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE
};
