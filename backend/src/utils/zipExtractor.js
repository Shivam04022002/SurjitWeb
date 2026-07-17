const AdmZip = require('adm-zip');
const path = require('path');

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const IGNORED_FILES = ['ds_store', 'thumbs.db'];
const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15 MB

const isIgnored = (name) => {
    const lower = name.toLowerCase();
    if (lower.startsWith('.')) return true;
    if (lower.startsWith('__macosx')) return true;
    return IGNORED_FILES.includes(lower);
};

const isSupportedImage = (name) => {
    const ext = path.extname(name).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
};

/**
 * Extracts all supported image entries from a ZIP buffer.
 * Returns array of { name, ext, buffer } objects.
 * Skips hidden files, unsupported formats, oversized images, and __MACOSX entries.
 */
const extractImagesFromZip = (zipBuffer) => {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const images = [];
    const skipped = [];

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        const entryName = entry.entryName;
        const baseName = path.basename(entryName);

        // Skip system/hidden files
        if (isIgnored(baseName) || entryName.toLowerCase().includes('__macosx/')) {
            skipped.push({ name: entryName, reason: 'ignored' });
            continue;
        }

        // Skip unsupported formats
        if (!isSupportedImage(baseName)) {
            skipped.push({ name: entryName, reason: 'unsupported_format' });
            continue;
        }

        // Skip oversized files
        if (entry.header.size > MAX_IMAGE_SIZE) {
            skipped.push({ name: entryName, reason: 'exceeds_size_limit' });
            continue;
        }

        const ext = path.extname(baseName).toLowerCase();
        const buffer = entry.getData();

        images.push({ name: baseName, entryName, ext, buffer });
    }

    return { images, skipped };
};

module.exports = { extractImagesFromZip, SUPPORTED_EXTENSIONS, MAX_IMAGE_SIZE };
