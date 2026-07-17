// Helpers for resolving website image assets and slugifying strings.
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.resolve(__dirname, '../../../frontend/src/assets/website');

// Resolve an asset filename (as referenced by the data modules) to an absolute
// path on disk. Returns null if the file does not exist.
const resolveAsset = (fileName) => {
    if (!fileName) return null;
    const full = path.join(ASSETS_DIR, fileName);
    return fs.existsSync(full) ? full : null;
};

const slugify = (str) =>
    String(str)
        .toLowerCase()
        .trim()
        .replace(/\.[a-z0-9]+$/i, '')      // drop extension
        .replace(/[()]/g, '')               // drop parentheses
        .replace(/[^a-z0-9]+/g, '-')        // non-alnum -> hyphen
        .replace(/^-+|-+$/g, '');           // trim hyphens

module.exports = { ASSETS_DIR, resolveAsset, slugify };
