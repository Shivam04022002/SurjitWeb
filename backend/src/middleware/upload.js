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
    all: /jpeg|jpg|png|webp|gif|svg|pdf|doc|docx/
};

const fileFilter = (allowedTypes) => (req, file, cb) => {
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
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

    return multer({
        storage,
        limits: { fileSize: maxSize },
        fileFilter: fileFilter(allowedFileTypes[fileTypes] || allowedFileTypes.all)
    });
};

module.exports = { createUpload, MAX_FILE_SIZE };
