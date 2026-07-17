const path = require('path');
const fs = require('fs');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../../config/s3');
const env = require('../../config/env');
const GalleryAlbum = require('../../models/GalleryAlbum');
const GalleryImage = require('../../models/GalleryImage');
const { AppError } = require('../../middleware/errorHandler');
const { extractImagesFromZip } = require('../../utils/zipExtractor');
const HTTP_STATUS = require('../../constants/httpStatus');

const MIME_MAP = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
};

const uploadBufferToS3 = async (buffer, ext, folder) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const key = `${folder}/${uniqueSuffix}${ext}`;
    const contentType = MIME_MAP[ext] || 'image/jpeg';

    await s3Client.send(new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType
        // No ACL: bucket has ACLs disabled; public read is granted via bucket policy.
    }));

    const url = `https://${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
    return { url, fileName: key };
};

const saveBufferLocally = (buffer, ext, folder) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fileName = `${uniqueSuffix}${ext}`;
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', folder);

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    return { url: `/uploads/${folder}/${fileName}`, fileName };
};

const uploadImageBuffer = async (buffer, ext, folder) => {
    const isS3 = !!(env.AWS_S3_BUCKET_NAME && env.AWS_ACCESS_KEY_ID);
    if (isS3) {
        return uploadBufferToS3(buffer, ext, folder);
    }
    return saveBufferLocally(buffer, ext, folder);
};

const importZip = async (albumId, zipBuffer) => {
    const album = await GalleryAlbum.findById(albumId);
    if (!album) throw new AppError('Album not found', HTTP_STATUS.NOT_FOUND);

    const { images: extracted, skipped } = extractImagesFromZip(zipBuffer);

    const existingCount = await GalleryImage.countDocuments({ album: albumId });

    let uploaded = 0;
    let failed = 0;
    const uploadedImages = [];
    const failedFiles = [];

    for (let i = 0; i < extracted.length; i++) {
        const { name, ext, buffer } = extracted[i];
        try {
            const fileResult = await uploadImageBuffer(buffer, ext, 'gallery/zip-imports');

            const imageDoc = await GalleryImage.create({
                album: albumId,
                image: { url: fileResult.url, fileName: fileResult.fileName },
                caption: '',
                altText: path.basename(name, ext),
                displayOrder: existingCount + i + 1,
                isActive: true
            });

            uploadedImages.push(imageDoc);
            uploaded++;
        } catch (err) {
            failed++;
            failedFiles.push({ name, reason: err.message });
        }
    }

    return {
        uploaded,
        skipped: skipped.length,
        failed,
        skippedFiles: skipped,
        failedFiles,
        images: uploadedImages
    };
};

module.exports = { importZip };
