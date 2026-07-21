const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const fs = require('fs');
const s3Client = require('../config/s3');
const env = require('../config/env');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const allowedFileTypes = {
    images: /jpeg|jpg|png|webp|gif|svg/,
    documents: /pdf|doc|docx/,
    // Annual reports are PDF only — deliberately narrower than `documents`,
    // which also permits doc/docx.
    pdf: /pdf/,
    // Gallery albums hold images and videos side by side.
    media: /jpeg|jpg|png|webp|gif|svg|mp4|webm|ogg|mov|quicktime/,
    all: /jpeg|jpg|png|webp|gif|svg|pdf|doc|docx/
};

const matches = (allowedTypes, file) => {
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    // Both must agree, so a renamed executable claiming a PDF mime type — or a
    // real PDF mime type on a .exe — is rejected either way.
    return extname && mimetype;
};

// `allowedTypes` is either one regex for every field, or a map of field name to
// regex when a single upload mixes kinds (a PDF report plus an image
// thumbnail, say). An unlisted field in map mode is rejected.
const fileFilter = (allowedTypes) => (req, file, cb) => {
    const rule = allowedTypes instanceof RegExp
        ? allowedTypes
        : allowedTypes[file.fieldname];

    if (!rule) {
        return cb(new Error(`Unexpected upload field: ${file.fieldname}`));
    }

    if (matches(rule, file)) {
        return cb(null, true);
    }
    cb(new Error('File type not allowed'));
};

const getS3Storage = (folder = 'uploads') => {
    return multerS3({
        s3: s3Client,
        bucket: env.AWS_S3_BUCKET_NAME,
        // No ACL: bucket uses "Bucket owner enforced" (ACLs disabled).
        // Public read is granted via a bucket policy instead.
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const ext = path.extname(file.originalname);
            cb(null, `${folder}/${uniqueSuffix}${ext}`);
        }
    });
};

const getLocalStorage = (folder = 'uploads') => {
    const uploadPath = path.join(__dirname, '..', 'uploads', folder);
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    return multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const ext = path.extname(file.originalname);
            cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        }
    });
};

const createUpload = (options = {}) => {
    const { folder = 'uploads', fileTypes = 'all', maxSize = MAX_FILE_SIZE } = options;

    const storage = env.AWS_S3_BUCKET_NAME && env.AWS_ACCESS_KEY_ID
        ? getS3Storage(folder)
        : getLocalStorage(folder);

    // `fileTypes` is normally a key into allowedFileTypes. It may instead be a
    // map of field name to key, for one upload that mixes kinds.
    const rule = typeof fileTypes === 'object' && fileTypes !== null
        ? Object.fromEntries(
            Object.entries(fileTypes).map(([field, key]) => [field, allowedFileTypes[key] || allowedFileTypes.all])
        )
        : (allowedFileTypes[fileTypes] || allowedFileTypes.all);

    return multer({
        storage,
        limits: { fileSize: maxSize },
        fileFilter: fileFilter(rule)
    });
};

module.exports = { createUpload, MAX_FILE_SIZE };
