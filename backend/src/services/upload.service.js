const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');
const s3Client = require('../config/s3');
const env = require('../config/env');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
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

    return {
        url: `/uploads/${file.filename}`,
        fileName: file.filename,
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

module.exports = {
    buildFileResult,
    deleteUploadedFile,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE
};
